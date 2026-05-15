import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { PostgreSQLDatabase } from '../database/database.js';
import { getSupportedTokensRegistry, getTokenContract } from '../config/token-config.js';
import { getChainsByProtocol } from '../config/chain-config.js';
import { AmountUtils, ChainUtils, ValidationUtils } from '../shared/index.js';
import type { Monitor, TransferEvent, Chain } from '@payin/monitor';
import { createLogger, LogCategory, type ConfigProvider } from '@payin/shared';
import { TransferRepository } from '../repositories/transfer.repository.js';
import { AddressPoolRepository } from '../repositories/address-pool.repository.js';

export interface BindAddressRequest {
  organizationId: string; // Organization ID for multi-tenant isolation
  depositReference: string;
  protocol: 'evm' | 'tron' | 'solana';
}
export interface ApiMonitoringTarget {
  chain: string;
  contract: string;
  token: string;
}
export interface BindAddressResponse {
  depositReference: string;
  protocol: string;
  depositAddress: string;
  monitoringTargets: ApiMonitoringTarget[];
  bindingCreatedAt: Date;
}
export interface DepositEvent {
  depositReference: string;
  token: string;
  chain: string;
  amount: string;
  depositAddress: string;
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  // Redirect URL for user navigation (added for redirect feature)
  redirectUrl?: string;
  // Organization ID for config lookup (added for organization isolation)
  organizationId?: string;
}
export interface UnbindAddressRequest {
  organizationId: string; // Organization ID for multi-tenant isolation
  depositReference: string;
  protocol: 'evm' | 'tron' | 'solana';
}

export class DepositService extends EventEmitter {
  private readonly logger = createLogger(LogCategory.PROCESSOR);
  private isStarted = false;
  private addressPoolRepository: AddressPoolRepository;
  private bindingCache = new Map<string, BindAddressResponse>();
  private tokenCache = new Map<string, string>();

  constructor(
    private transferRepository: TransferRepository,
    private database: PostgreSQLDatabase,
    private monitor: Monitor,
    cooldownMinutes: number = 30,
    private configProvider?: ConfigProvider
  ) {
    super();
    this.addressPoolRepository = new AddressPoolRepository(database, cooldownMinutes, configProvider);
    this.initializeTokenCache();
  }

  async start(): Promise<void> {
    if (this.isStarted) return;
    this.isStarted = true;
    this.logger.info('DepositService started');
    this.emit('started', { timestamp: new Date() });
  }

  async stop(): Promise<void> {
    if (!this.isStarted) return;
    this.isStarted = false;
    this.logger.info('DepositService stopped');
    this.emit('stopped', { timestamp: new Date() });
  }

  async bindDepositAddress(request: BindAddressRequest): Promise<BindAddressResponse> {
    if (!this.isStarted) throw new Error('DepositService not started');
    if (!request.depositReference || request.depositReference.trim() === '') {
      throw new Error('depositReference is required and cannot be empty');
    }
    if (request.protocol === 'solana') {
      throw new Error('Solana deposits are currently disabled');
    }

    try {
      // Check if user already has a binding
      const existingBinding = await this.addressPoolRepository.getUserDepositAddress(request.organizationId, request.depositReference, request.protocol);
      if (existingBinding) {
        if (existingBinding.protocol === 'solana') {
          throw new Error('Existing Solana deposit bindings are no longer supported');
        }
        const monitoringTargets = this.createMonitoringTargets(request.protocol, existingBinding.address);
        const apiMonitoringTargets: ApiMonitoringTarget[] = monitoringTargets.map(target => ({
          chain: target.chain,
          contract: target.contract,
          token: this.findTokenByContract(target.contract, target.chain)?.symbol || 'UNKNOWN'
        }));

        return {
          depositReference: request.depositReference,
          protocol: request.protocol,
          depositAddress: existingBinding.address,
          monitoringTargets: apiMonitoringTargets,
          bindingCreatedAt: existingBinding.allocated_at || new Date()
        };
      }

      // Bind new address from pool
      const allocation = await this.addressPoolRepository.bindAddress(request.organizationId, request.depositReference, request.protocol);
      if (!allocation) {
        throw new Error(`No available ${request.protocol} addresses in deposit pool`);
      }

      // Create monitoring targets and start monitoring
      const monitoringTargets = this.createMonitoringTargets(request.protocol, allocation.address);
      const tokenContracts = this.getTokenContractsMapping();
      const actualMonitoringTargets = await this.monitor.watchAddressMatrix(allocation.address, request.protocol, tokenContracts);

      const apiMonitoringTargets: ApiMonitoringTarget[] = actualMonitoringTargets.map(target => ({
        chain: target.chain,
        contract: target.contract,
        token: this.findTokenByContract(target.contract, target.chain)?.symbol || 'UNKNOWN'
      }));

      const response: BindAddressResponse = {
        depositReference: request.depositReference,
        protocol: request.protocol,
        depositAddress: allocation.address,
        monitoringTargets: apiMonitoringTargets,
        bindingCreatedAt: allocation.allocated_at || new Date()
      };

      this.emit('addressBound', { ...response });
      return response;
    } catch (error) {
      this.logger.error('Failed to bind deposit address', { error: (error as Error).message });
      throw error;
    }
  }

  async handleUserDeposit(depositReference: string, event: TransferEvent): Promise<void> {
    this.logger.info('handleUserDeposit is a no-op; logic is centralized in Processor', { depositReference });
  }

  async recordTransferOnly(event: TransferEvent, businessContext: any): Promise<void> {
    if (businessContext?.type !== 'deposit') return;

    // Check for existing transfer to avoid duplicates
    const existingTransfer = await this.transferRepository.findByTxHashAndEventIndex(event.transactionHash, event.eventIndex || 0);
    if (existingTransfer) {
      this.logger.debug('Transfer event already processed, skipping.', { depositReference: businessContext.id, txHash: event.transactionHash });
      return;
    }

    // Query address_pool to get organization_id for the deposit address
    // Use LOWER() for case-insensitive comparison: ethers.getAddress() returns EIP-55 checksum
    // format (mixed case) but DB may store lowercase addresses
    const addressResult = await this.database.query(
      `SELECT organization_id FROM address_pool WHERE LOWER(address) = LOWER($1) LIMIT 1`,
      [event.to]
    );

    if (!addressResult || addressResult.length === 0) {
      this.logger.error('Cannot find address in pool for deposit transfer', {
        depositReference: businessContext.id,
        address: event.to,
        txHash: event.transactionHash
      });
      return;
    }

    const organizationId = addressResult[0].organization_id;

    // Create transfer record for deposit
    await this.transferRepository.create({
      id: uuidv4(),
      organization_id: organizationId, // Multi-tenant isolation - get from address_pool
      order_id: null,
      deposit_reference: businessContext.id,
      business_type: 'deposit',
      transaction_hash: event.transactionHash,
      block_number: event.blockNumber,
      event_index: event.eventIndex || 0,
      chain: event.chain,
      token: this.findTokenByContract(event.contract, event.chain)?.symbol || 'UNKNOWN',
      amount: this.convertWeiToDecimal(event.amount, this.findTokenByContract(event.contract, event.chain)?.symbol || 'USDC'),
      from_address: event.from || '',
      to_address: event.to || '',
      last_checked_confirmations: 0,
      required_confirmations: this.getRequiredConfirmations(event.chain),
      is_confirmed: false,
      is_failed: false,
    });

    this.logger.info('Transfer record created for deposit', {
      depositReference: businessContext.id,
      organizationId,
      txHash: event.transactionHash,
      amount: event.amount
    });
  }

  private convertWeiToDecimal(weiAmount: string, currency: string): string {
    return AmountUtils.convertWeiToDecimalByToken(weiAmount, currency);
  }

  private getRequiredConfirmations(chain: string): number {
    return ChainUtils.getRequiredConfirmations(chain);
  }
  
  async handleDepositConfirmation(depositReference: string, transferData: TransferEvent): Promise<void> {
    try {
      const existingTransfer = await this.transferRepository.findByTxHashAndEventIndex(transferData.transactionHash, transferData.eventIndex || 0);

      if (!existingTransfer || existingTransfer.business_type !== 'deposit') {
        this.logger.warn('Transfer record not found for confirmed deposit', { txHash: transferData.transactionHash });
        return;
      }

      // Get redirect URL for deposit confirmation
      const redirectUrl = await this.getDepositRedirectUrl(existingTransfer.organization_id);

      const depositEvent: DepositEvent = {
        depositReference: depositReference,
        token: existingTransfer.token,
        chain: existingTransfer.chain,
        amount: existingTransfer.amount,
        depositAddress: existingTransfer.to_address,
        txHash: existingTransfer.transaction_hash,
        blockNumber: existingTransfer.block_number,
        timestamp: existingTransfer.detected_at,
        // Add redirect URL for user navigation
        redirectUrl,
        // Add organization ID for context
        organizationId: existingTransfer.organization_id
      };

      // Emit generic depositReceived event for EventBus forwarding
      this.emit('depositReceived', depositEvent);

      // Emit specific deposit event for targeted listeners
      const specificEventName = `deposit:${depositReference}`;
      this.emit(specificEventName, depositEvent);
      this.emit('wildcard', specificEventName, depositEvent);

      this.logger.info('Deposit confirmed and events emitted', {
        depositReference,
        txHash: transferData.transactionHash,
        organizationId: existingTransfer.organization_id,
        redirectUrl
      });
    } catch (error) {
      this.logger.error('Error processing deposit confirmation', { depositReference, error: (error as Error).message });
    }
  }

  /**
   * Get redirect URL for deposit confirmation with validation
   *
   * Priority:
   * 1. Organization-level configuration
   * 2. Global configuration
   * 3. undefined (no redirect)
   *
   * Note: Deposit redirect URL has no per-deposit override (unlike orders).
   * Deposits are long-term, so only configuration-level URLs are supported.
   *
   * @param organizationId - Organization ID for configuration lookup
   * @returns Valid HTTP(S) URL or undefined
   */
  private async getDepositRedirectUrl(organizationId: string): Promise<string | undefined> {
    if (!this.configProvider) {
      return undefined;
    }

    try {
      const configKey = 'redirect.deposit.success_url';
      const configUrl = await this.configProvider.getConfig(configKey, organizationId);

      if (configUrl) {
        // Validate URL format
        if (ValidationUtils.isValidHttpUrl(configUrl)) {
          return configUrl;
        } else {
          // Invalid format, log warning
          this.logger.warn('Invalid configured deposit redirect URL, ignoring', {
            organizationId,
            configKey,
            url: configUrl
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to fetch deposit redirect URL from config', {
        organizationId,
        configKey: 'redirect.deposit.success_url',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // No valid redirect URL found
    return undefined;
  }

  async unbindDepositAddress(request: UnbindAddressRequest): Promise<void> {
    const boundAddress = await this.addressPoolRepository.getUserDepositAddress(request.organizationId, request.depositReference, request.protocol);
    if (boundAddress) {
      if (request.protocol !== 'solana') {
        const tokenContracts = this.getTokenContractsMapping();
        await this.monitor.unwatchAddressMatrix(boundAddress.address, request.protocol, tokenContracts);
      } else {
        this.logger.warn('Skipping Solana deposit unwatch (feature disabled)', {
          depositReference: request.depositReference,
          address: boundAddress.address
        });
      }
    }
    await this.addressPoolRepository.unbindAddress(request.organizationId, request.depositReference, request.protocol);
    this.logger.info('Unbound address for user', { depositReference: request.depositReference });
  }

  async restoreDepositMonitoring(binding: { address: string; deposit_reference: string; protocol: 'evm' | 'tron' | 'solana' }): Promise<void> {
    if (binding.protocol === 'solana') {
      this.logger.warn('Skipping Solana deposit monitoring restoration (feature disabled)', {
        depositReference: binding.deposit_reference,
        address: binding.address
      });
      return;
    }
    try {
      const tokenContracts = this.getTokenContractsMapping();
      await this.monitor.watchAddressMatrix(binding.address, binding.protocol, tokenContracts);
      this.logger.info('Deposit monitoring restored successfully', { depositReference: binding.deposit_reference });
    } catch (error) {
      this.logger.error('Failed to restore deposit monitoring', { depositReference: binding.deposit_reference, error: (error as Error).message });
    }
  }

  private initializeTokenCache(): void {
    const SUPPORTED_TOKENS = getSupportedTokensRegistry();
    for (const [symbol, config] of Object.entries(SUPPORTED_TOKENS)) {
      for (const [chainId, contractAddress] of Object.entries(config.contracts)) {
        this.tokenCache.set(`${contractAddress.toLowerCase()}-${chainId}`, symbol);
      }
    }
  }

  public findTokenByContract(contractAddress: string, chainId: string): { symbol: string; decimals: number } | null {
    const SUPPORTED_TOKENS = getSupportedTokensRegistry();
    const cacheKey = `${contractAddress.toLowerCase()}-${chainId}`;
    const cachedSymbol = this.tokenCache.get(cacheKey);
    if (cachedSymbol) {
      return { symbol: cachedSymbol, decimals: SUPPORTED_TOKENS[cachedSymbol]?.decimals || 6 };
    }
    if (cachedSymbol === '') return null; // Known not to exist

    for (const [symbol, config] of Object.entries(SUPPORTED_TOKENS)) {
      if (config.contracts[chainId]?.toLowerCase() === contractAddress.toLowerCase()) {
        this.tokenCache.set(cacheKey, symbol);
        return { symbol, decimals: config.decimals };
      }
    }

    this.tokenCache.set(cacheKey, ''); // Cache miss
    return null;
  }

  public convertBlockchainAmountToUser(blockchainAmount: string, decimals: number): string {
    const amount = parseFloat(blockchainAmount) / Math.pow(10, decimals);
    return amount.toFixed(6);
  }

  private getTokenContractsMapping(): Record<string, Record<string, string>> {
    const SUPPORTED_TOKENS = getSupportedTokensRegistry();
    const mapping: Record<string, Record<string, string>> = {};
    for (const [symbol, config] of Object.entries(SUPPORTED_TOKENS)) {
      mapping[symbol] = config.contracts;
    }
    return mapping;
  }

  /**
   * Create monitoring targets for an address based on supported tokens and chains
   */
  private createMonitoringTargets(protocol: 'evm' | 'tron' | 'solana', address: string): Array<{
    chain: string;
    contract: string;
    token: string;
  }> {
    if (protocol === 'solana') {
      this.logger.warn('Skipping monitoring targets for Solana deposit (feature disabled)', { address });
      return [];
    }
    const targets: Array<{ chain: string; contract: string; token: string; }> = [];

    // Get supported chains for this protocol family
    const supportedChains = getChainsByProtocol(protocol);

    // For each supported token, create monitoring targets on relevant chains
    const SUPPORTED_TOKENS = getSupportedTokensRegistry();
    for (const [tokenSymbol, tokenConfig] of Object.entries(SUPPORTED_TOKENS)) {
      for (const chainId of supportedChains) {
        const contractAddress = getTokenContract(tokenSymbol, chainId);
        if (contractAddress) {
          targets.push({
            chain: chainId,
            contract: contractAddress,
            token: tokenSymbol
          });
        }
      }
    }

    return targets;
  }
}

export default DepositService;
