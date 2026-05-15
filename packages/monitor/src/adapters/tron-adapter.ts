/**
 * Tron adapter for Tron blockchain
 * Implements basic block scanning with TronWeb
 */

import { TronWeb } from 'tronweb'
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
 * Tron network capabilities
 */
const TRON_CAPABILITIES: NetworkRPCCapabilities = {
  supportsMultiContractFiltering: true,   // Tron supports multi-contract filtering
  supportsMultiAddressFiltering: true,    // Tron supports multi-address filtering
  maxContractsPerFilter: 20,
  maxAddressesPerFilter: 50,
  supportsBatchRequests: true
}

/**
 * TRC-20 Transfer event signature
 */
const TRC20_TRANSFER_SIGNATURE = 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/**
 * Tron adapter implementation
 */
export class TronAdapter extends BaseAdapter {
  private readonly logger = createLogger(LogCategory.MONITOR)
  private tronWeb: any | null = null
  private readonly rpcManager: RPCManager

  constructor(chain: Chain, rpcManager: RPCManager) {
    super(chain, 'tron' as Protocol)
    this.rpcManager = rpcManager
    this.validateChain()
  }

  /**
   * Validate chain is Tron compatible
   */
  private validateChain(): void {
    const chainConfig = getChainConfig(this.chain)
    if (chainConfig.protocol !== 'tron') {
      throw new ChainAdapterError(
        `Chain ${this.chain} is not Tron compatible`,
        this.chain
      )
    }
  }

  /**
   * Get network capabilities
   */
  getCapabilities(): NetworkRPCCapabilities {
    return TRON_CAPABILITIES
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    try {
      // Determine the correct TronGrid URL based on chain
      const tronGridUrl = this.chain === 'tron-nile'
        ? 'https://nile.trongrid.io'
        : 'https://api.trongrid.io'

      // Initialize TronWeb with the correct network URL
      this.tronWeb = new TronWeb({
        fullHost: tronGridUrl
      })

      // RPC Manager based initialization
      this.logger.info('Tron adapter using RPC Manager', { chain: this.chain, tronWebHost: tronGridUrl })

      // Test connection via RPC Manager using JSON-RPC compatible method
      const blockNumberHex = await this.rpcManager.makeRequest(this.chain, {
        method: 'eth_blockNumber',
        params: []
      })
      const blockNumber = parseInt(blockNumberHex, 16)
      this.logger.info('Tron adapter initialized successfully', {
        chain: this.chain,
        blockNumber
      })
      
    } catch (error) {
      const rpcError = createRPCError(
        `Failed to initialize Tron adapter for ${this.chain}`,
        this.chain,
        'RPC Manager',
        error as Error
      )
      throw rpcError
    }
  }

  /**
   * Get current block number using JSON-RPC
   */
  async getCurrentBlockNumber(): Promise<number> {
    try {
      // Use RPC Manager for JSON-RPC call
      const blockNumberHex = await this.rpcManager.makeRequest(this.chain, {
        method: 'eth_blockNumber',
        params: []
      })

      // Validate response
      if (!blockNumberHex || typeof blockNumberHex !== 'string') {
        throw new Error(`Invalid block number response: ${JSON.stringify(blockNumberHex)}`)
      }

      const blockNumber = parseInt(blockNumberHex, 16)

      // Check for NaN
      if (isNaN(blockNumber) || !isFinite(blockNumber)) {
        throw new Error(`Invalid block number parsed from hex: ${blockNumberHex} -> ${blockNumber}`)
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
      this.logger.debug('Starting block scan', {
        chain: this.chain,
        fromBlock: request.fromBlock,
        toBlock: request.toBlock,
        contractCount: request.contracts.length,
        addressCount: request.addresses.length
      })
      
      const transfers = await this.getTransferEvents(
        request.fromBlock,
        request.toBlock,
        request.contracts,
        request.addresses
      )

      const responseTime = Date.now() - startTime

      this.logger.info('Block scan completed successfully', {
        chain: this.chain,
        fromBlock: request.fromBlock,
        toBlock: request.toBlock,
        transferCount: transfers.length,
        responseTime
      })
      
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
        if (batchTransfers.length > 0) {
          this.logger.debug('Batch processing completed', {
            chain: this.chain,
            batchNumber,
            transferCount: batchTransfers.length
          })
        }
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

    if (allTransfers.length > 0) {
      this.logger.info('Transfer events retrieved', {
        chain: this.chain,
        totalTransfers: allTransfers.length,
        batchesProcessed: Math.ceil(contracts.length / capabilities.maxContractsPerFilter)
      })
    }
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

    // Convert all contracts to TronGrid-compatible hex format
    const contractAddressesHex = contracts.map(addr => this.convertToTronGridFormat(addr))
    
    this.logger.debug('Getting batch transfer events', {
      chain: this.chain,
      contractsHex: contractAddressesHex,
      targetAddresses
    })

    // TRC-20 Transfer event signature (same as ERC-20)
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    
    // Prepare eth_getLogs parameters for batch contract query
    const logsParams = {
      address: contractAddressesHex, // Multiple contracts in single call!
      fromBlock: '0x' + fromBlock.toString(16),
      toBlock: '0x' + toBlock.toString(16),
      topics: [
        transferTopic, // Transfer(address,address,uint256)
        null, // from address (any)
        null  // to address (any) - we'll filter in code
      ]
    }
    
    this.logger.debug('Making JSON-RPC eth_getLogs call', {
      chain: this.chain,
      contractCount: contracts.length,
      fromBlock,
      toBlock,
      method: 'single-call-batch'
    })
    
    // Use RPC Manager for JSON-RPC call
    const result = await this.rpcManager.makeRequest(this.chain, {
      method: 'eth_getLogs',
      params: [logsParams]
    })
    const data = { result }
    
    this.logger.debug('JSON-RPC response received', {
      chain: this.chain,
      rawLogCount: data.result?.length || 0
    })
    
    const transfers: TransferEvent[] = []
    
    if (data.result && Array.isArray(data.result)) {
      for (const log of data.result) {
        try {
          // Parse the log entry
          const contractBase58 = this.convertHexToBase58(log.address)
          const fromAddress = this.parseAddressFromTopic(log.topics[1])
          const toAddress = this.parseAddressFromTopic(log.topics[2])
          const amount = this.parseAmountFromData(log.data)
          
          // Filter by target addresses if specified
          if (targetAddresses.length > 0 && !targetAddresses.includes(toAddress)) {
            this.logger.debug('Skipping transfer - not in target list', {
              chain: this.chain,
              toAddress,
              targetAddresses
            })
            continue
          }
          
          const transfer: TransferEvent = {
            chain: this.chain,
            contract: contractBase58,
            to: toAddress,
            from: fromAddress,
            amount: amount,
            transactionHash: log.transactionHash,
            blockNumber: parseInt(log.blockNumber, 16),
            logIndex: parseInt(log.logIndex || '0x0', 16),
            eventIndex: parseInt(log.logIndex || '0x0', 16), // For Tron, eventIndex maps to logIndex
            timestamp: Date.now()
          }
          
          transfers.push(transfer)
          // console.log(`   ✅ Parsed transfer: ${transfer.amount} from ${transfer.from} to ${transfer.to} (contract: ${transfer.contract})`)
          
        } catch (parseError) {
          this.logger.warn('Failed to parse Tron log', {
            chain: this.chain,
            error: (parseError as Error).message,
            logData: { address: log.address, topics: log.topics, data: log.data }
          })
        }
      }
    }
    
    return transfers
  }


  /**
   * Convert Tron Base58 address to TronGrid-compatible hex format (20-byte Ethereum format)
   */
  private convertToTronGridFormat(base58Address: string): string {
    try {
      if (base58Address.startsWith('0x')) {
        return base58Address // Already hex format
      }
      
      // Use TronWeb to convert Base58 to hex, then format for TronGrid
      const tronHex = this.tronWeb!.address.toHex(base58Address) // e.g., 41eca9bc828a3005b9a3b909f2cc5c2a54794de05f
      
      // TronGrid needs 20-byte Ethereum format: remove Tron prefix 41, keep 20 bytes, add 0x prefix
      const ethFormatHex = '0x' + tronHex.slice(2).slice(-40) // Remove 41 prefix, take last 40 chars, add 0x
      
      this.logger.debug('Address format conversion', {
        chain: this.chain,
        base58Address,
        tronHex,
        ethFormatHex
      })
      return ethFormatHex
    } catch (error) {
      this.logger.warn('Address conversion failed', {
        chain: this.chain,
        base58Address,
        error: (error as Error).message
      })
      throw new Error(`Invalid Tron address: ${base58Address}`)
    }
  }

  /**
   * Convert TronGrid hex format back to Tron Base58 address
   */
  private convertHexToBase58(hexAddress: string): string {
    try {
      if (!hexAddress.startsWith('0x')) {
        return hexAddress // Assume already Base58
      }
      
      // Convert from TronGrid format back to Tron format: add Tron prefix 41
      const tronHex = '41' + hexAddress.slice(2)
      
      // Use TronWeb to convert back to Base58
      const base58Address = this.tronWeb!.address.fromHex(tronHex)
      
      this.logger.debug('Hex to Base58 conversion', {
        chain: this.chain,
        hexAddress,
        tronHex,
        base58Address
      })
      return base58Address
    } catch (error) {
      this.logger.warn('Hex to Base58 conversion failed', {
        chain: this.chain,
        hexAddress,
        error: (error as Error).message
      })
      // Fallback - return original hex format
      return hexAddress
    }
  }

  /**
   * Pad address to 32 bytes for event topics
   */
  private padToTopic(address: string): string {
    // Remove 0x prefix and pad to 32 bytes (64 hex chars)
    const hex = address.startsWith('0x') ? address.slice(2) : address
    return '0x' + '0'.repeat(64 - hex.length) + hex.toLowerCase()
  }

  
  /**
   * Parse address from log topic (remove padding and convert back to Tron Base58)
   */
  private parseAddressFromTopic(topic: string): string {
    if (!topic || topic === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb' // Zero address in Tron format
    }
    
    try {
      // Remove padding - take last 40 characters (20 bytes)
      const ethFormatHex = topic.slice(-40)
      
      // Convert from TronGrid format back to Tron format: add Tron prefix 41
      const tronHex = '41' + ethFormatHex
      
      // Check if TronWeb is available
      if (!this.tronWeb) {
        this.logger.warn('TronWeb not available for address conversion', {
          chain: this.chain,
          fallbackFormat: 'hex'
        })
        return '0x' + ethFormatHex
      }
      
      // Use TronWeb to convert back to Base58
      const base58Address = this.tronWeb.address.fromHex(tronHex)
      
      this.logger.debug('Topic to address conversion', {
        chain: this.chain,
        topic,
        ethFormatHex,
        tronHex,
        base58Address
      })
      return base58Address
    } catch (error) {
      this.logger.warn('Failed to parse topic', {
        chain: this.chain,
        topic,
        error: (error as Error).message
      })
      // Fallback - return as hex format
      return '0x' + topic.slice(-40)
    }
  }
  
  /**
   * Parse amount from log data
   */
  private parseAmountFromData(data: string): string {
    if (!data || data === '0x') {
      return '0'
    }
    
    try {
      // Remove 0x and parse as hex
      return parseInt(data, 16).toString()
    } catch {
      return '0'
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
    const timeoutMs = 10000 // 增加到10秒，对tron网络更友好
    
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
   * Uses JSON-RPC eth_getTransactionReceipt for consistency with other adapter methods
   */
  async getTransactionReceipt(transactionHash: string): Promise<{
    blockNumber: number;
    transactionHash: string;
    status: boolean;
    gasUsed?: number;
    logs?: any[];
  } | null> {
    try {
      this.logger.debug('Fetching Tron transaction receipt via JSON-RPC', {
        chain: this.chain,
        transactionHash
      })

      // Use RPC Manager for consistent handling (retry, load balancing, etc.)
      const receipt = await this.rpcManager.makeRequest(this.chain, {
        method: 'eth_getTransactionReceipt',
        params: [transactionHash]  // TronGrid JSON-RPC accepts 0x prefix
      })

      // TronGrid returns null if transaction not found or not indexed yet
      if (!receipt) {
        this.logger.debug('Transaction not found or not indexed yet', {
          chain: this.chain,
          transactionHash
        })
        return null
      }

      this.logger.debug('Transaction receipt fetched successfully', {
        chain: this.chain,
        transactionHash,
        blockNumber: parseInt(receipt.blockNumber, 16),
        status: receipt.status
      })

      // Convert hex values to decimal and return consistent format
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
    if (this.tronWeb) {
      // TronWeb doesn't have an explicit destroy method
      this.tronWeb = null
    }
    this.logger.info('Tron adapter destroyed', { chain: this.chain })
  }
}