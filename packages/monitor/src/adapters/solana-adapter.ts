/**
 * Solana adapter for SPL Token monitoring
 *
 * 设计目标：尽量贴近 EVM 适配器的无状态扫描模型，直接按请求区间拉取签名，
 *          保证返回的 TransferEvent 按 slot 升序，避免引入复杂的缓存 / 批量逻辑。
 */

import { PublicKey, type ParsedTransactionWithMeta, type ConfirmedSignatureInfo } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
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
 * Solana network capabilities
 */
const SOLANA_CAPABILITIES: NetworkRPCCapabilities = {
  supportsMultiContractFiltering: true,
  supportsMultiAddressFiltering: true,
  maxContractsPerFilter: 100,
  maxAddressesPerFilter: 1000,
  supportsBatchRequests: true
}

/**
 * Solana adapter implementation using Program Scan strategy
 * Fully integrated with RPC Manager for automatic round-robin and failover
 */
export class SolanaAdapter extends BaseAdapter {
  private readonly logger = createLogger(LogCategory.MONITOR)
  private readonly rpcManager: RPCManager

  constructor(chain: Chain, rpcManager: RPCManager) {
    super(chain, 'solana' as Protocol)
    this.rpcManager = rpcManager
    this.validateChain()
  }

  /**
   * Validate chain is Solana compatible
   */
  private validateChain(): void {
    const chainConfig = getChainConfig(this.chain)
    if (chainConfig.protocol !== 'solana') {
      throw new ChainAdapterError(
        `Chain ${this.chain} is not Solana compatible`,
        this.chain
      )
    }
  }

  private async scanWithRpcFallback(
    request: BlockScanRequest,
    ataMap: Map<string, { owner: string; mint: string; ata: string }>,
    startTime: number
  ): Promise<BlockScanResult> {
    this.logger.debug('Falling back to RPC-based Solana scan', {
      chain: this.chain,
      fromSlot: request.fromBlock,
      toSlot: request.toBlock
    })

    const ataAddresses = Array.from(new Set(Array.from(ataMap.values()).map(info => info.ata)))

    if (ataAddresses.length === 0) {
      return {
        success: true,
        fromBlock: request.fromBlock,
        toBlock: request.toBlock,
        transfers: [],
        responseTime: Date.now() - startTime
      }
    }

    const signatures = await this.getSignaturesForATAs(
      ataAddresses,
      request.fromBlock,
      request.toBlock
    )

    this.logger.debug('Signatures retrieved (fallback)', {
      chain: this.chain,
      signatureCount: signatures.length,
      ataCount: ataAddresses.length
    })

    const transactions = await this.batchGetParsedTransactions(signatures)

    const transfers = await this.filterAndParseTransfers(
      transactions,
      request.contracts,
      request.addresses,
      ataMap
    )

    const responseTime = Date.now() - startTime

    if (transfers.length > 0) {
      this.logger.info('Solana fallback scan completed with transfers', {
        chain: this.chain,
        fromSlot: request.fromBlock,
        toSlot: request.toBlock,
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
  }

  /**
   * Get network capabilities
   */
  getCapabilities(): NetworkRPCCapabilities {
    return SOLANA_CAPABILITIES
  }

  /**
   * Initialize the adapter
   * Tests connection via RPC Manager (supports round-robin and failover)
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Solana adapter using RPC Manager', { chain: this.chain })

      // Test connection via RPC Manager (getSlot method)
      const slot = await this.rpcManager.makeRequest(this.chain, {
        method: 'getSlot',
        params: [{ commitment: 'finalized' }]
      })

      this.logger.info('Solana adapter initialized successfully', {
        chain: this.chain,
        currentSlot: slot,
        mode: 'rpc-manager'
      })
    } catch (error) {
      // Log detailed error information before throwing
      this.logger.error('Solana adapter initialization failed', {
        chain: this.chain,
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack,
        errorDetails: error
      })

      const rpcError = createRPCError(
        `Failed to initialize Solana adapter for ${this.chain}`,
        this.chain,
        'RPC Manager',
        error as Error
      )
      throw rpcError
    }
  }

  /**
   * Get current slot (block) number via RPC Manager
   */
  async getCurrentBlockNumber(): Promise<number> {
    try {
      // Use RPC Manager for getSlot call
      const slot = await this.rpcManager.makeRequest(this.chain, {
        method: 'getSlot',
        params: [{ commitment: 'finalized' }]
      })

      // Validate response
      if (slot === undefined || slot === null) {
        throw new Error(`Invalid slot response: ${JSON.stringify(slot)}`)
      }

      const slotNumber = typeof slot === 'number' ? slot : parseInt(String(slot))

      // Check for NaN
      if (isNaN(slotNumber) || !isFinite(slotNumber)) {
        throw new Error(`Invalid slot number: ${JSON.stringify(slot)} -> ${slotNumber}`)
      }

      return slotNumber
    } catch (error) {
      throw createRPCError(
        `Failed to get current slot for ${this.chain}`,
        this.chain,
        'RPC Manager',
        error as Error
      )
    }
  }

  /**
   * Scan blocks for transfer events using Program Scan strategy
   */
  async scanBlocks(request: BlockScanRequest): Promise<BlockScanResult> {
    const startTime = Date.now()

    try {
      const ataMap = await this.buildATAMap(request.contracts, request.addresses)

      return await this.scanWithRpcFallback(request, ataMap, startTime)
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = `Failed to scan slots ${request.fromBlock}-${request.toBlock} on ${this.chain}: ${(error as Error).message}`

      this.logger.error('Solana scan failed', {
        chain: this.chain,
        fromSlot: request.fromBlock,
        toSlot: request.toBlock,
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
   * Get transaction signatures for monitored ATAs within a slot range
   * Returns signatures with slot information for forward sorting
   */
  private async getSignaturesForATAs(
    ataAddresses: readonly string[],
    fromSlot: number,
    toSlot: number
  ): Promise<Array<{ signature: string; slot: number }>> {
    return await this.getSignaturesSequential(ataAddresses, fromSlot, toSlot)
  }

  /**
   * Load signatures sequentially (逐个 ATA 请求)
   */
  private async getSignaturesSequential(
    ataAddresses: readonly string[],
    fromSlot: number,
    toSlot: number
  ): Promise<Array<{ signature: string; slot: number }>> {
    if (ataAddresses.length === 0) {
      return []
    }

    const uniqueSignatures = new Map<string, number>()
    const limit = 500
    const maxIterations = 500

    for (const ata of ataAddresses) {
      let before: string | undefined
      let iterations = 0

      while (iterations < maxIterations) {
        const options: Record<string, any> = {
          limit,
          commitment: 'finalized'
        }
        if (before) {
          options.before = before
        }

        let batch: ConfirmedSignatureInfo[]
        try {
          batch = await this.rpcManager.makeRequest(this.chain, {
            method: 'getSignaturesForAddress',
            params: [ata, options]
          })
        } catch (error) {
          this.logger.warn('Failed to load signatures for ATA', {
            chain: this.chain,
            ata,
            error: error instanceof Error ? error.message : String(error)
          })
          break
        }

        if (!Array.isArray(batch) || batch.length === 0) {
          break
        }

        let reachedLowerBound = false

        for (const sig of batch) {
          const slot = Number(sig.slot ?? 0)
          if (!slot) {
            continue
          }

          if (slot > toSlot) {
            continue
          }

          if (slot < fromSlot) {
            reachedLowerBound = true
            break
          }

          if (sig.err !== null) {
            continue
          }

          if (!uniqueSignatures.has(sig.signature)) {
            uniqueSignatures.set(sig.signature, slot)
          }
        }

        const lastSig = batch[batch.length - 1]
        if (
          reachedLowerBound ||
          !lastSig ||
          !lastSig.signature ||
          lastSig.slot < fromSlot ||
          batch.length < limit
        ) {
          break
        }

        before = lastSig.signature
        iterations += 1
      }
    }

    return Array.from(uniqueSignatures.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([signature, slot]) => ({ signature, slot }))
  }


  /**
   * Batch get parsed transactions via RPC Manager
   *
   * Optimization: Dynamic batch sizing based on RPC provider
   */
  private async batchGetParsedTransactions(
    signatures: Array<{ signature: string; slot: number }>
  ): Promise<ParsedTransactionWithMeta[]> {
    if (signatures.length === 0) {
      return []
    }

    const batchSize = this.getDynamicBatchSize()
    const transactions: ParsedTransactionWithMeta[] = []

    // Process in batches
    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize)

      // Use RPC Manager for getParsedTransaction calls
      const results = await Promise.all(
        batch.map(({ signature }) =>
          this.rpcManager.makeRequest(this.chain, {
            method: 'getTransaction',
            params: [
              signature,
              {
                encoding: 'jsonParsed',
                maxSupportedTransactionVersion: 0,
                commitment: 'finalized'
              }
            ]
          })
        )
      )

      // Filter out null results
      const validResults = results.filter((tx): tx is ParsedTransactionWithMeta => tx !== null)
      transactions.push(...validResults)
    }

    // ✅ Optimization 3: Transactions are already in forward order (slot ASC)
    // because signatures are sorted before being passed to this function
    return transactions
  }

  /**
   * Get batch size for JSON-RPC batch requests.
   * Currently fixed to a conservative value to ensure compatibility across providers.
   */
  private getDynamicBatchSize(): number {
    return 10
  }

  /**
   * Build ATA (Associated Token Account) mapping for local computation
   * Pre-computes all possible ATA addresses to avoid RPC calls during parsing
   *
   * @param mints - List of token mint addresses to monitor
   * @param wallets - List of wallet addresses to monitor
   * @returns Map of ATA address -> { owner, mint }
   */
  private async buildATAMap(
    mints: readonly string[],
    wallets: readonly string[]
  ): Promise<Map<string, { owner: string; mint: string; ata: string }>> {
    const ataMap = new Map<string, { owner: string; mint: string; ata: string }>()

    // Pre-compute all possible ATA addresses
    for (const mint of mints) {
      for (const wallet of wallets) {
        try {
          const ata = await getAssociatedTokenAddress(
            new PublicKey(mint),
            new PublicKey(wallet)
          )
          const ataAddress = ata.toBase58()
          ataMap.set(ataAddress.toLowerCase(), {
            owner: wallet,
            mint: mint,
            ata: ataAddress
          })
        } catch (error) {
          this.logger.warn('Failed to compute ATA address', {
            mint,
            wallet,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }

    this.logger.debug('Built ATA mapping', {
      chain: this.chain,
      ataCount: ataMap.size,
      mintCount: mints.length,
      walletCount: wallets.length
    })

    return ataMap
  }

  /**
   * Filter and parse SPL Token transfers
   */
  private async filterAndParseTransfers(
    transactions: ParsedTransactionWithMeta[],
    targetMints: readonly string[],
    targetWallets: readonly string[],
    ataMap: Map<string, { owner: string; mint: string; ata: string }>
  ): Promise<TransferEvent[]> {
    const transfers: TransferEvent[] = []

    // Normalize addresses to lowercase for comparison
    const mintSet = new Set(targetMints.map(m => m.toLowerCase()))
    const walletSet = new Set(targetWallets.map(w => w.toLowerCase()))

    for (const tx of transactions) {
      try {
        const parsedTransfers = this.parseSPLTokenTransfers(tx, ataMap)

        for (const transfer of parsedTransfers) {
          // Check if mint matches
          const mintMatches = mintSet.has(transfer.mint.toLowerCase())

          // Check if destination wallet matches
          const walletMatches = walletSet.has(transfer.destinationOwner.toLowerCase())

          if (mintMatches && walletMatches) {
            // Convert to TransferEvent format
            transfers.push({
              chain: this.chain,
              contract: transfer.mint,
              to: transfer.destinationOwner,
              from: transfer.sourceOwner,
              amount: transfer.amount,
              transactionHash: transfer.signature,
              blockNumber: transfer.slot,
              logIndex: 0,  // Solana doesn't have log index
              eventIndex: 0,
              timestamp: transfer.timestamp
            })
          }
        }
      } catch (error) {
        this.logger.warn('Failed to parse transaction', {
          chain: this.chain,
          signature: tx.transaction.signatures[0],
          error: (error as Error).message
        })
        continue
      }
    }

    return transfers
  }

  /**
   * Parse SPL Token transfers from a transaction using local ATA mapping
   *
   * @param tx - Parsed transaction with metadata
   * @param ataMap - Pre-computed ATA address mapping (ATA -> { owner, mint })
   * @returns Array of parsed transfer details
   */
  private parseSPLTokenTransfers(
    tx: ParsedTransactionWithMeta,
    ataMap: Map<string, { owner: string; mint: string; ata: string }>
  ): Array<{
    signature: string
    slot: number
    mint: string
    sourceOwner: string
    destinationOwner: string
    amount: string
    timestamp: number
  }> {
    const transfers: Array<{
      signature: string
      slot: number
      mint: string
      sourceOwner: string
      destinationOwner: string
      amount: string
      timestamp: number
    }> = []

    if (!tx.meta) {
      return transfers
    }

    const signature = tx.transaction.signatures[0] || ''
    const slot = tx.slot
    const timestamp = (tx.blockTime || Math.floor(Date.now() / 1000)) * 1000

    // Parse instructions
    const instructions = tx.transaction.message.instructions

    for (const instruction of instructions) {
      // Check if it's a parsed instruction
      if ('parsed' in instruction) {
        const parsed = instruction.parsed

        // Check for SPL Token transfer
        if (
          parsed.type === 'transfer' ||
          parsed.type === 'transferChecked'
        ) {
          const info = parsed.info

          // For SPL token transfers:
          // - info.authority: sender's wallet address (owner of source ATA)
          // - info.source: sender's Associated Token Account (ATA)
          // - info.destination: receiver's Associated Token Account (ATA)
          // Use pre-computed ATA mapping to get owner and mint (local computation, no RPC)

          let destinationOwner: string = ''
          let mint: string = info.mint || ''  // transferChecked has mint, transfer doesn't

          // Use ATA map for local computation (no RPC call)
          if (info.destination) {
            const ataInfo = ataMap.get(info.destination.toLowerCase())
            if (ataInfo) {
              destinationOwner = ataInfo.owner
              // Get mint from ATA map if not in instruction (for 'transfer' type)
              if (!mint) {
                mint = ataInfo.mint
              }
            } else {
              // ATA not in our monitoring targets, skip this transfer
              this.logger.debug('Destination ATA not in monitoring targets', {
                destination: info.destination,
                signature
              })
              continue
            }
          }

          // Extract transfer details
          transfers.push({
            signature,
            slot,
            mint,
            sourceOwner: info.authority || '',  // Use authority as source owner
            destinationOwner,  // Owner from ATA map (local computation)
            amount: info.amount || info.tokenAmount?.amount || '0',
            timestamp
          })
        }
      }
    }

    return transfers
  }

  /**
   * Check if adapter is healthy via RPC Manager
   */
  async isHealthy(): Promise<boolean> {
    try {
      await Promise.race([
        this.rpcManager.makeRequest(this.chain, {
          method: 'getSlot',
          params: [{ commitment: 'finalized' }]
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 10000)
        )
      ])
      return true
    } catch (error) {
      this.logger.debug('Solana health check failed', {
        chain: this.chain,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * Get transaction receipt for confirmation via RPC Manager
   */
  async getTransactionReceipt(transactionHash: string): Promise<{
    blockNumber: number
    transactionHash: string
    status: boolean
    gasUsed?: number
    logs?: any[]
  } | null> {
    try {
      // Use RPC Manager for getTransaction call
      const tx = await this.rpcManager.makeRequest(this.chain, {
        method: 'getTransaction',
        params: [
          transactionHash,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0,
            commitment: 'finalized'
          }
        ]
      })

      if (!tx) {
        return null
      }

      return {
        blockNumber: tx.slot,
        transactionHash,
        status: tx.meta?.err === null,
        gasUsed: tx.meta?.fee,
        logs: tx.meta?.logMessages || []
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
   * No cleanup needed as RPC Manager handles connection lifecycle
   */
  async destroy(): Promise<void> {
    this.logger.info('Solana adapter destroyed', { chain: this.chain })
  }
}
