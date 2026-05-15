/**
 * EVM adapter for Ethereum-compatible chains
 * Implements basic block scanning with ethers.js
 */

import { ethers } from 'ethers'
import type {
  Chain,
  TransferEvent,
  Protocol
} from '../types/index.js'
import { getChainConfig } from '../types/chains.js'
import { ChainAdapterError, createRPCError } from '../types/errors.js'
import {
  BaseAdapter,
  type NetworkRPCCapabilities,
  type BlockScanRequest,
  type BlockScanResult
} from './base-adapter.js'
import type { RPCManager } from '../rpc/index.js'
import { createLogger, LogCategory } from '@payin/shared'


/**
 * EVM network capabilities by provider
 */
const EVM_CAPABILITIES: Record<string, NetworkRPCCapabilities> = {
  'ethereum-mainnet': {
    supportsMultiContractFiltering: true,
    supportsMultiAddressFiltering: false,   // Ethereum only supports single address filtering
    maxContractsPerFilter: 10,
    maxAddressesPerFilter: 1,
    supportsBatchRequests: true
  },
  'ethereum-sepolia': {
    supportsMultiContractFiltering: true,
    supportsMultiAddressFiltering: false,
    maxContractsPerFilter: 10,
    maxAddressesPerFilter: 1,
    supportsBatchRequests: true
  },
  'polygon-mainnet': {
    supportsMultiContractFiltering: true,
    supportsMultiAddressFiltering: true,    // Polygon supports multi-address filtering
    maxContractsPerFilter: 20,
    maxAddressesPerFilter: 50,
    supportsBatchRequests: true
  },
  'polygon-amoy': {
    supportsMultiContractFiltering: true,
    supportsMultiAddressFiltering: true,
    maxContractsPerFilter: 20,
    maxAddressesPerFilter: 50,
    supportsBatchRequests: true
  },
  'base-mainnet': {
    supportsMultiContractFiltering: true,
    supportsMultiAddressFiltering: true,
    maxContractsPerFilter: 15,
    maxAddressesPerFilter: 30,
    supportsBatchRequests: true
  },
  'base-sepolia': {
    supportsMultiContractFiltering: true,
    supportsMultiAddressFiltering: true,
    maxContractsPerFilter: 15,
    maxAddressesPerFilter: 30,
    supportsBatchRequests: true
  }
}

/**
 * ERC-20 Transfer event signature
 */
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/**
 * EVM adapter implementation
 */
export class EVMAdapter extends BaseAdapter {
  private readonly logger = createLogger(LogCategory.MONITOR)
  private readonly rpcManager: RPCManager
  private provider?: ethers.JsonRpcProvider

  constructor(chain: Chain, rpcManager: RPCManager) {
    super(chain, 'evm' as Protocol)
    this.rpcManager = rpcManager
    this.validateChain()
  }

  /**
   * Validate chain is EVM compatible
   */
  private validateChain(): void {
    const chainConfig = getChainConfig(this.chain)
    if (chainConfig.protocol !== 'evm') {
      throw new ChainAdapterError(
        `Chain ${this.chain} is not EVM compatible`,
        this.chain
      )
    }
  }


  /**
   * Get network capabilities
   */
  getCapabilities(): NetworkRPCCapabilities {
    return EVM_CAPABILITIES[this.chain] || {
      supportsMultiContractFiltering: true,
      supportsMultiAddressFiltering: false,
      maxContractsPerFilter: 10,
      maxAddressesPerFilter: 1,
      supportsBatchRequests: true
    }
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('EVM adapter using RPC Manager', { chain: this.chain })

      // Test connection via RPC Manager
      const blockNumber = await this.rpcManager.makeRequest(this.chain, {
        method: 'eth_blockNumber',
        params: []
      })
      const block = parseInt(blockNumber, 16)
      this.logger.info('EVM adapter initialized successfully', {
        chain: this.chain,
        blockNumber: block,
        mode: 'rpc-manager'
      })
    } catch (error) {
      const rpcError = createRPCError(
        `Failed to initialize EVM adapter for ${this.chain}`,
        this.chain,
        'RPC Manager',
        error as Error
      )
      throw rpcError
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlockNumber(): Promise<number> {
    try {
      // Use RPC Manager
      const blockHex = await this.rpcManager.makeRequest(this.chain, {
        method: 'eth_blockNumber',
        params: []
      })

      // Validate response
      if (!blockHex || typeof blockHex !== 'string') {
        throw new Error(`Invalid block number response: ${JSON.stringify(blockHex)}`)
      }

      const blockNumber = parseInt(blockHex, 16)

      // Check for NaN
      if (isNaN(blockNumber) || !isFinite(blockNumber)) {
        throw new Error(`Invalid block number parsed from hex: ${blockHex} -> ${blockNumber}`)
      }

      return blockNumber
    } catch (error) {
      throw createRPCError(
        `Failed to get current block number for ${this.chain}`,
        this.chain,
        'RPC Manager',
        error as Error
      )
    }
  }

  /**
   * Scan blocks for transfer events
   */
  async scanBlocks(request: BlockScanRequest): Promise<BlockScanResult> {
    const startTime = Date.now()

    try {
      const transfers = await this.getTransferEvents(
        request.fromBlock,
        request.toBlock,
        request.contracts,
        request.addresses
      )

      const responseTime = Date.now() - startTime
      
      if (transfers.length > 0) {
        this.logger.info('Block scan completed with transfers', {
          chain: this.chain,
          fromBlock: request.fromBlock,
          toBlock: request.toBlock,
          transferCount: transfers.length,
          responseTime
        })
      }
      
      return {
        success: true,
        fromBlock: request.fromBlock,
        toBlock: request.toBlock,
        transfers,
        responseTime
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = `Failed to scan blocks ${request.fromBlock}-${request.toBlock} on ${this.chain}: ${(error as Error).message}`

      this.logger.error('Block scan failed', {
        chain: this.chain,
        fromBlock: request.fromBlock,
        toBlock: request.toBlock,
        error: (error as Error).message,
        responseTime
      })
      
      return {
        success: false,
        fromBlock: request.fromBlock,
        toBlock: request.toBlock,
        transfers: [],
        error: errorMessage,
        responseTime
      }
    }
  }

  /**
   * Get transfer events using contract-level batch filtering
   */
  private async getTransferEvents(
    fromBlock: number,
    toBlock: number,
    contracts: readonly string[],
    targetAddresses: readonly string[]
  ): Promise<TransferEvent[]> {
    if (contracts.length === 0) {
      return []
    }

    this.logger.debug('Getting transfer events', {
      chain: this.chain,
      fromBlock,
      toBlock,
      contracts: contracts.slice(0, 5), // Log first 5 contracts to avoid noise
      contractCount: contracts.length,
      targetAddresses: targetAddresses.slice(0, 5), // Log first 5 addresses
      targetAddressCount: targetAddresses.length
    })

    const capabilities = this.getCapabilities()
    const allTransfers: TransferEvent[] = []
    
    // Batch process contracts to stay within network limits
    for (let i = 0; i < contracts.length; i += capabilities.maxContractsPerFilter) {
      const contractBatch = contracts.slice(i, i + capabilities.maxContractsPerFilter)
      const batchNumber = Math.floor(i / capabilities.maxContractsPerFilter) + 1
      const totalBatches = Math.ceil(contracts.length / capabilities.maxContractsPerFilter)
      
      this.logger.debug('Processing contract batch', {
        chain: this.chain,
        batchNumber,
        totalBatches,
        contractCount: contractBatch.length,
        contracts: contractBatch
      })
      
      try {
        const batchTransfers = await this.getBatchTransferEvents(
          fromBlock,
          toBlock,
          contractBatch,
          targetAddresses
        )
        allTransfers.push(...batchTransfers)
        this.logger.debug('Batch processing completed', {
          chain: this.chain,
          batchNumber,
          transferCount: batchTransfers.length
        })
      } catch (error) {
        this.logger.error('Batch processing failed', {
          chain: this.chain,
          batchNumber,
          error: (error as Error).message
        })
        // Continue with next batch rather than failing completely
        continue
      }
    }

    this.logger.info('Transfer events retrieved', {
      chain: this.chain,
      totalTransfers: allTransfers.length,
      batchesProcessed: Math.ceil(contracts.length / capabilities.maxContractsPerFilter)
    })
    return allTransfers
  }

  /**
   * Get transfer events for a batch of contracts using single JSON-RPC call
   */
  private async getBatchTransferEvents(
    fromBlock: number,
    toBlock: number,
    contracts: readonly string[],
    targetAddresses: readonly string[]
  ): Promise<TransferEvent[]> {
    if (contracts.length === 0) {
      return []
    }

    // Use contract-level filtering for optimal performance
    const filter: ethers.Filter = {
      address: [...contracts], // Convert readonly array to mutable
      topics: [TRANSFER_EVENT_SIGNATURE],
      fromBlock,
      toBlock
    }

    this.logger.debug('EVM filter configuration', {
      chain: this.chain,
      filter: {
        address: filter.address,
        topics: filter.topics,
        fromBlock: filter.fromBlock,
        toBlock: filter.toBlock
      }
    })

    // Make eth_getLogs request
    const ethLogsRequest = {
      method: 'eth_getLogs',
      params: [{
        address: filter.address,
        topics: filter.topics,
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock: `0x${toBlock.toString(16)}`
      }]
    }

    // Use RPC Manager for eth_getLogs
    const result = await this.rpcManager.makeRequest(this.chain, ethLogsRequest)

    // Convert raw logs to ethers.Log format
    const logs: ethers.Log[] = result.map((rawLog: any) => ({
      ...rawLog,
      blockNumber: parseInt(rawLog.blockNumber, 16),
      transactionIndex: parseInt(rawLog.transactionIndex, 16),
      logIndex: parseInt(rawLog.logIndex, 16)
    }))
    
    const transfers: TransferEvent[] = []

    for (const log of logs) {
      try {
        const transfer = await this.parseTransferLog(log)
        
        this.logger.debug('Transfer parsed', {
          chain: this.chain,
          from: transfer.from,
          to: transfer.to,
          amount: transfer.amount,
          contract: transfer.contract,
          transactionHash: transfer.transactionHash,
          blockNumber: transfer.blockNumber
        })
        
        // Filter by target addresses if specified (case-insensitive comparison)
        const matchesTarget = targetAddresses.length === 0 ||
          targetAddresses.some(addr => addr.toLowerCase() === transfer.to.toLowerCase())

        if (matchesTarget) {
          this.logger.info('✅ Transfer matched', {
            chain: this.chain,
            to: transfer.to,
            amount: transfer.amount,
            txHash: transfer.transactionHash
          })
          transfers.push(transfer)
        } else {
          // This is expected and normal, as eth_getLogs fetches for all addresses in a contract.
          // Filtered silently to reduce log noise.
        }
        
      } catch (error) {
        this.logger.warn('Failed to parse log', {
          chain: this.chain,
          error: (error as Error).message,
          logData: {
            address: log.address,
            topics: log.topics,
            data: log.data
          }
        })
        continue
      }
    }

    this.logger.debug('Batch transfer matching completed', {
      chain: this.chain,
      matchingTransfers: transfers.length,
      totalLogsProcessed: logs.length
    })
    return transfers
  }

  /**
   * Parse transfer log to TransferEvent
   */
  private async parseTransferLog(log: ethers.Log): Promise<TransferEvent> {
    // Parse Transfer(address indexed from, address indexed to, uint256 value)
    if (!log.topics || log.topics.length !== 3) {
      this.logger.error('❌ PARSE ERROR: Invalid Transfer log format', {
        chain: this.chain,
        txHash: log.transactionHash,
        topics: log.topics,
        topicsLength: log.topics?.length
      });
      throw new Error('Invalid Transfer log format')
    }

    const from = ethers.getAddress('0x' + log.topics[1]!.slice(26))  // Remove padding
    const to = ethers.getAddress('0x' + log.topics[2]!.slice(26))    // Remove padding
    const amount = ethers.getBigInt(log.data).toString()

    // Get block timestamp
    let timestamp = Date.now() // Fallback
    try {
      const block = await this.provider!.getBlock(log.blockNumber)
      timestamp = (block?.timestamp ?? Math.floor(Date.now() / 1000)) * 1000
    } catch {
      // Use current time if block fetch fails
    }

    // Handle both RPC Manager format (logIndex field) and ethers format (index field)
    const logIndexValue = (log as any).logIndex !== undefined ? (log as any).logIndex : log.index;
    
    return {
      chain: this.chain,
      contract: log.address,
      to,
      from,
      amount,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: logIndexValue,
      eventIndex: logIndexValue,  // For EVM chains, eventIndex maps to logIndex
      timestamp
    }
  }

  /**
   * Check if adapter is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.rpcManager) {
      return false
    }

    // 健康检查优化：更宽松的超时和重试机制
    const maxRetries = 2
    const timeoutMs = 10000 // 增加到10秒，对polygon等慢速网络更友好
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await Promise.race([
          this.rpcManager.makeRequest(this.chain, {
            method: 'eth_blockNumber',
            params: []
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), timeoutMs)
          )
        ])
        return true
      } catch (error) {
        this.logger.debug('Health check attempt failed', {
          chain: this.chain,
          attempt: attempt + 1,
          maxRetries,
          error: error instanceof Error ? error.message : String(error)
        })
        
        // 最后一次尝试失败才返回false
        if (attempt === maxRetries - 1) {
          return false
        }
        
        // 重试前短暂等待
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return false
  }

  /**
   * Get transaction receipt for confirmation
   */
  async getTransactionReceipt(transactionHash: string): Promise<{
    blockNumber: number;
    transactionHash: string;
    status: boolean;
    gasUsed?: number;
    logs?: any[];
  } | null> {
    try {
      const receipt = await this.rpcManager.makeRequest(this.chain, {
        method: 'eth_getTransactionReceipt',
        params: [transactionHash]
      })
      
      if (!receipt) {
        return null
      }
      
      // Convert hex values to decimal and return a consistent format
      return {
        blockNumber: parseInt(receipt.blockNumber, 16),
        transactionHash: receipt.transactionHash,
        status: parseInt(receipt.status, 16) === 1,
        gasUsed: parseInt(receipt.gasUsed, 16),
        logs: receipt.logs ? [...receipt.logs] : []
      }
    } catch (error) {
      this.logger.error('Failed to get transaction receipt', {
        chain: this.chain,
        transactionHash,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Clean up adapter resources
   */
  async destroy(): Promise<void> {
    // The RPCManager is managed externally and should not be destroyed here.
    this.logger.info('EVM adapter destroyed', { chain: this.chain })
  }
}
