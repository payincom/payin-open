/**
 * Processor Core
 * The main orchestration class for the Processor system
 */

import { v4 as uuidv4 } from 'uuid';
import { PostgreSQLDatabase } from '../database/database.js';
import { Monitor } from '@payin/monitor';
import type { TransferEvent, Chain, ChainRange } from '@payin/monitor';
import { createLogger, LogCategory, type ConfigProvider } from '@payin/shared';

import { ProcessorConfigManager, type ProcessorConfig } from './processor-config-manager.js';
import { ProcessorEventBus, ProcessorEventName } from './processor-event-bus.js';
import { BusinessContextResolver } from './business-context-resolver.js';
import { ChainUtils } from '../shared/chain-utils.js';
import { ErrorUtils, ServiceUnavailableError } from '../shared/error-utils.js';

// Repository imports
import { OrderRepository } from '../repositories/order.repository.js';
import { TransferRepository } from '../repositories/transfer.repository.js';
import { AddressPoolRepository } from '../repositories/address-pool.repository.js';
import { ChainBlocksRepository } from '../repositories/chain-blocks.repository.js';

// Service imports
import { OrderService } from '../services/order-service.js';
import { DepositService } from '../services/deposit-service.js';
import { DelayedConfirmationService } from '../services/delayed-confirmation-service.js';

// Configuration utilities
import { buildChainRangesFromDatabase } from './config-utils.js';

export interface SystemStatus {
  isStarted: boolean;
  isRecovering: boolean;
  services: {
    orders: boolean;
    deposits: boolean;
  };
  database: {
    connected: boolean;
  };
  monitor: {
    started: boolean;
    chainsActive: number;
  };
}

/**
 * Core processor class responsible for system orchestration
 */
export class ProcessorCore {
  private readonly logger = createLogger(LogCategory.PROCESSOR);
  private readonly configManager: ProcessorConfigManager;
  private readonly eventBus: ProcessorEventBus;

  // Core components
  private readonly database: PostgreSQLDatabase;
  private readonly monitor: Monitor;
  private readonly businessResolver: BusinessContextResolver;

  // Repositories
  private readonly orderRepository: OrderRepository;
  private readonly transferRepository: TransferRepository;
  private readonly addressPoolRepository: AddressPoolRepository;
  private readonly chainBlocksRepository: ChainBlocksRepository;

  // Services
  private readonly orderService?: OrderService;
  private readonly depositService?: DepositService;
  private readonly delayedConfirmation: DelayedConfirmationService;

  // Service soft switches (hot-loadable)
  private serviceConfig: {
    ordersEnabled: boolean;
    depositsEnabled: boolean;
  };

  // State management
  private isStarted = false;
  public isRecovering = false;
  private recoveryChains: Set<string> = new Set();

  private constructor(
    configManager: ProcessorConfigManager,
    eventBus: ProcessorEventBus,
    database: PostgreSQLDatabase,
    monitor: Monitor,
    businessResolver: BusinessContextResolver,
    repositories: {
      order: OrderRepository;
      transfer: TransferRepository;
      addressPool: AddressPoolRepository;
      chainBlocks: ChainBlocksRepository;
    },
    services: {
      order?: OrderService;
      deposit?: DepositService;
      delayedConfirmation: DelayedConfirmationService;
    }
  ) {
    this.configManager = configManager;
    this.eventBus = eventBus;
    this.database = database;
    this.monitor = monitor;
    this.businessResolver = businessResolver;

    this.orderRepository = repositories.order;
    this.transferRepository = repositories.transfer;
    this.addressPoolRepository = repositories.addressPool;
    this.chainBlocksRepository = repositories.chainBlocks;

    this.orderService = services.order;
    this.depositService = services.deposit;
    this.delayedConfirmation = services.delayedConfirmation;

    // Initialize service switches from config
    const serviceConfigFromManager = configManager.getServiceConfig();
    this.serviceConfig = {
      ordersEnabled: serviceConfigFromManager.orders,
      depositsEnabled: serviceConfigFromManager.deposits
    };

    this.setupEventHandlers();
  }

  /**
   * Create a new ProcessorCore instance
   *
   * @param config - Processor configuration
   * @param configProvider - Optional ConfigProvider for dynamic business configuration
   */
  static async create(config: ProcessorConfig, configProvider?: ConfigProvider): Promise<ProcessorCore> {
    const logger = createLogger(LogCategory.PROCESSOR);

    // Initialize configuration manager
    const configManager = new ProcessorConfigManager(config);
    logger.info('✅ Configuration validated and merged');

    // Initialize protocol families from configuration
    const { initializeChainProtocols } = await import('../config/chain-config.js');
    const chainsConfig = configManager.getChainConfigs();
    initializeChainProtocols(chainsConfig);
    logger.info(`✅ Initialized ${Object.keys(chainsConfig).length} chains from configuration`);

    // Initialize token configurations
    const { initializeTokens } = await import('../config/token-config.js');
    const tokensConfig = configManager.getTokenConfigs();
    initializeTokens(tokensConfig);
    logger.info(`✅ Initialized ${Object.keys(tokensConfig).length} tokens from configuration`);

    // Initialize event bus
    const eventBus = new ProcessorEventBus();
    logger.info('✅ Event bus initialized');

    // Initialize database
    const dbConfig = configManager.getDatabaseConfig();
    const schema = process.env.DATABASE_SCHEMA; // Support schema isolation for tests
    const database = new PostgreSQLDatabase(dbConfig.connectionString, schema);
    await database.initialize();
    logger.info('✅ Database initialized', schema ? { schema } : {});

    // Auto-initialize database schema if INIT_DB=true
    const { shouldAutoInitDatabase, getAutoInitOptions } = await import('../database/database-init-helper.js');
    if (shouldAutoInitDatabase()) {
      const initOptions = getAutoInitOptions();

      logger.info('🔧 Initializing database schema (INIT_DB=true)...', {
        dropExisting: initOptions.dropExisting,
        onlyMissing: initOptions.onlyMissing
      });

      const initResult = await database.initializeDatabaseSchema(initOptions);

      if (initResult.success) {
        logger.info('✅ Database schema initialized (all tables dropped and recreated)', {
          createdTables: initResult.createdTables.length,
          upgradedTables: initResult.upgradedTables.length
        });
      } else {
        logger.error('❌ Database schema initialization failed', {
          errors: initResult.errors
        });
        throw new Error(`Database schema initialization failed: ${initResult.errors.join(', ')}`);
      }
    } else {
      logger.info('⏭️  Skipping database initialization (INIT_DB not set to true)');
    }

    // Get monitor config early for recovery and RPC setup
    const monitorConfig = configManager.getMonitorConfig();
    const configChainSettings = (monitorConfig as any)?.chainSettings;

    // Determine if recovery mode is needed
    const processorChains = Object.keys(chainsConfig);
    const recoveryChainRanges = configManager.shouldSkipMonitorRecovery()
      ? undefined
      : await buildChainRangesFromDatabase(database, logger, configChainSettings, processorChains);
    const isRecovering = !!recoveryChainRanges;

    if (recoveryChainRanges) {
      logger.info('🔎 Recovery chain ranges snapshot', {
        chains: Object.keys(recoveryChainRanges),
        startBlocks: Object.fromEntries(
          Object.entries(recoveryChainRanges).map(([chain, range]) => [chain, range.startBlock])
        )
      });
    } else {
      logger.info('🔎 Recovery chain ranges snapshot', { chains: [], startBlocks: {} });
    }

    if (isRecovering) {
      logger.info(`🔄 Recovery mode enabled for ${Object.keys(recoveryChainRanges!).length} chains`);
    } else {
      logger.info('✅ Starting in normal mode');
    }

    // Initialize Monitor
    const { RPCConfigBuilder, RPCManager } = await import('@payin/monitor');

    // Get RPC keys from monitor config
    const rpcKeys = (monitorConfig as any)?.rpcKeys || {};

    logger.info(`🔑 RPC keys available: ${Object.keys(rpcKeys).join(', ') || 'none'}`);

    // Determine which chains to monitor
    // Priority: monitor.chains (if specified) > processor.chains (all configured chains)
    const monitorChains = monitorConfig?.chains;

    // Validate monitor chains if specified
    if (monitorChains && monitorChains.length > 0) {
      const invalidChains = monitorChains.filter(chain => !processorChains.includes(chain));
      if (invalidChains.length > 0) {
        throw new Error(
          `Invalid chains in monitor configuration: ${invalidChains.join(', ')}\n\n` +
          `These chains are not defined in processor.chains configuration.\n` +
          `Available chains: ${processorChains.join(', ')}\n\n` +
          `To fix this:\n` +
          `1. Add chain definitions to processor config 'chains' section, OR\n` +
          `2. Remove ${invalidChains.join(', ')} from monitor.chains`
        );
      }
      logger.info(`📍 Monitor will track ${monitorChains.length} of ${processorChains.length} configured chains: ${monitorChains.join(', ')}`);
    }

    // Use specified monitor chains, or default to all processor chains
    const requiredChains = monitorChains || processorChains;

    if (!monitorChains) {
      logger.info(`📍 Monitor will track all ${processorChains.length} configured chains (default behavior): ${processorChains.join(', ')}`);
    }

    // Get RPC configuration overrides from Processor YAML
    const processorConfig = configManager.getConfig();
    const rpcOverrides = processorConfig.rpc ? { rpc: processorConfig.rpc } : undefined;

    const builder = new RPCConfigBuilder({
      apiKeys: rpcKeys,
      configOverrides: rpcOverrides
    });
    const rpcConfig = await builder.buildForChains([...requiredChains]);
    logger.info('🔧 RPC config chains', {
      requestedChains: requiredChains,
      configuredChains: Object.keys(rpcConfig.chains)
    });

    let rpcManager = (globalThis as any).__payinRPCManager as InstanceType<typeof RPCManager> | undefined;

    if (rpcManager) {
      const existingConfig = rpcManager.getConfiguration?.();
      const existingChains = Object.keys(existingConfig?.chains || {});
      const missingChains = requiredChains.filter(chain => !existingChains.includes(chain));
      const hasPlaceholders = Object.values(existingConfig?.chains || {}).some(chainCfg =>
        chainCfg.endpoints?.some(endpoint => typeof endpoint.url === 'string' && endpoint.url.includes('${'))
      );

      if (missingChains.length > 0 || hasPlaceholders) {
        logger.warn('⚠️ Existing RPCManager configuration mismatch, rebuilding', {
          existingChains,
          missingChains,
          hasPlaceholders
        });
        await rpcManager.stop();
        rpcManager = undefined;
      } else {
        logger.info('♻️ Reusing existing RPCManager instance', { chains: existingChains });
      }
    }

    if (!rpcManager) {
      rpcManager = new RPCManager({ rpcConfig });
      await rpcManager.initialize();
      (globalThis as any).__payinRPCManager = rpcManager;
    }

    // Build chainSettings: merge recovery chainRanges (startBlock/endBlock) with config settings (batchSize)
    const chainSettings = recoveryChainRanges
      ? Object.fromEntries(
          Object.entries(recoveryChainRanges).map(([chain, range]) => {
            const configSettings = configChainSettings?.[chain as Chain];
            return [chain, {
              chainRanges: range,  // Recovery range with startBlock/endBlock
              batchSize: configSettings?.batchSize  // Performance setting from config
            }];
          })
        )
      : configChainSettings;

    // Create monitor config, ensuring chainSettings with chainRanges is not overridden
    const { chainSettings: _unusedChainSettings, ...monitorConfigWithoutChainSettings } = monitorConfig as any;

    // DEBUG: Log chainSettings being passed to Monitor
    logger.info('🔍 DEBUG: chainSettings for Monitor', {
      chainsCount: chainSettings ? Object.keys(chainSettings).length : 0,
      chains: chainSettings ? Object.keys(chainSettings) : [],
      hasChainRanges: chainSettings ? Object.values(chainSettings).some((s: any) => s?.chainRanges?.startBlock !== undefined) : false
    });

    const monitor = new Monitor({
      ...monitorConfigWithoutChainSettings,
      chainSettings: chainSettings,  // This will definitely be used
      rpcManager: rpcManager
    } as any);
    logger.info('✅ Monitor instance created');

    // Initialize repositories
    const depositConfig = configManager.getDepositConfig();
    const cooldownMinutes = depositConfig.poolManagement?.defaultCooldownMinutes ?? 30;

    const orderRepository = new OrderRepository(database);
    const transferRepository = new TransferRepository(database);
    const addressPoolRepository = new AddressPoolRepository(database, cooldownMinutes, configProvider);
    const chainBlocksRepository = new ChainBlocksRepository(database);
    const businessResolver = new BusinessContextResolver(database, cooldownMinutes, configProvider);
    logger.info('✅ Repositories initialized');

    // Initialize services (both always enabled)
    const orderConfig = configManager.getOrderConfig();
    const tokenConfigs = configManager.getTokenConfigs();
    const orderService = new OrderService(
      orderRepository,
      transferRepository,
      addressPoolRepository,
      database,
      monitor,
      orderConfig,
      tokenConfigs,
      configProvider
    );
    logger.info('✅ OrderService created');

    const depositService = new DepositService(
      transferRepository,
      database,
      monitor,
      cooldownMinutes,
      configProvider
    );
    logger.info('✅ DepositService created');

    // Initialize delayed confirmation service
    const delayedConfirmationConfig = configManager.getDelayedConfirmationConfig();
    const delayedConfirmation = new DelayedConfirmationService(monitor, delayedConfirmationConfig);
    logger.info('✅ DelayedConfirmationService created');

    // Create processor core instance
    const processorCore = new ProcessorCore(
      configManager,
      eventBus,
      database,
      monitor,
      businessResolver,
      {
        order: orderRepository,
        transfer: transferRepository,
        addressPool: addressPoolRepository,
        chainBlocks: chainBlocksRepository
      },
      {
        order: orderService,
        deposit: depositService,
        delayedConfirmation
      }
    );

    // Set recovery state
    processorCore.isRecovering = isRecovering;
    if (isRecovering && recoveryChainRanges) {
      processorCore.recoveryChains = new Set(Object.keys(recoveryChainRanges));
      logger.info(`🔄 Recovery chains tracked: ${Array.from(processorCore.recoveryChains).join(', ')}`);
    }

    return processorCore;
  }

  /**
   * Start the processor
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('ProcessorCore already started.');
      return;
    }

    this.logger.info('Starting ProcessorCore...');

    try {
      // If in recovery mode, restore monitoring targets BEFORE starting monitor
      if (this.isRecovering) {
        this.logger.info('🔄 Recovery mode: Restoring monitoring targets from database...');
        await this.restoreMonitoringTargets();
      }

      // Start monitor after targets are restored
      await this.monitor.start();

      // Start services
      if (this.orderService) {
        this.orderService.start();
      }

      if (this.depositService) {
        this.depositService.start();
      }

      this.delayedConfirmation.start();

      this.isStarted = true;
      this.eventBus.emitSystemEvent(ProcessorEventName.STARTED);
      this.logger.info('✅ ProcessorCore started successfully');

    } catch (error) {
      this.logger.error('Failed to start ProcessorCore:', error);
      this.eventBus.emitError(ErrorUtils.wrapError(error), { operation: 'start' });
      throw error;
    }
  }

  /**
   * Stop the processor
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      this.logger.warn('ProcessorCore not started.');
      return;
    }

    this.logger.info('Stopping ProcessorCore...');

    try {
      // Stop services
      if (this.orderService) {
        this.orderService.stop();
      }

      if (this.depositService) {
        this.depositService.stop();
      }

      this.delayedConfirmation.stop();

      // Stop monitor
      await this.monitor.stop();

      // Close database
      await this.database.close();

      // Clean up event bus
      this.eventBus.cleanup();

      this.isStarted = false;
      this.eventBus.emitSystemEvent(ProcessorEventName.STOPPED);
      this.logger.info('✅ ProcessorCore stopped successfully');

    } catch (error) {
      this.logger.error('Error during ProcessorCore shutdown:', error);
      this.eventBus.emitError(ErrorUtils.wrapError(error), { operation: 'stop' });
      throw error;
    }
  }

  /**
   * Get system status
   */
  getSystemStatus(): SystemStatus {
    return {
      isStarted: this.isStarted,
      isRecovering: this.isRecovering,
      services: {
        orders: !!this.orderService,
        deposits: !!this.depositService
      },
      database: {
        connected: true // Simplified check
      },
      monitor: {
        started: this.isStarted, // Simplified check
        chainsActive: 0 // Would need to implement proper monitoring
      }
    };
  }

  /**
   * Get event bus for external subscriptions
   */
  getEventBus(): ProcessorEventBus {
    return this.eventBus;
  }

  /**
   * Get configuration manager
   */
  getConfigManager(): ProcessorConfigManager {
    return this.configManager;
  }

  /**
   * Get database instance
   */
  getDatabase(): PostgreSQLDatabase {
    return this.database;
  }

  /**
   * Get order service
   * Soft switch: Service instance exists but may reject new requests
   */
  getOrderService(): OrderService {
    if (!this.orderService) {
      throw new ServiceUnavailableError('OrderService');
    }
    if (!this.serviceConfig.ordersEnabled) {
      throw new ServiceUnavailableError('OrderService is disabled');
    }
    return this.orderService;
  }

  /**
   * Get deposit service
   * Soft switch: Service instance exists but may reject new requests
   */
  getDepositService(): DepositService {
    if (!this.depositService) {
      throw new ServiceUnavailableError('DepositService');
    }
    if (!this.serviceConfig.depositsEnabled) {
      throw new ServiceUnavailableError('DepositService is disabled');
    }
    return this.depositService;
  }

  /**
   * Get order repository for advanced queries
   */
  getOrderRepository(): OrderRepository {
    return this.orderRepository;
  }

  /**
   * Get transfer repository for advanced queries
   */
  getTransferRepository(): TransferRepository {
    return this.transferRepository;
  }

  /**
   * Get address pool repository for advanced queries
   */
  getAddressPoolRepository(): AddressPoolRepository {
    return this.addressPoolRepository;
  }

  /**
   * Update service configuration (hot-reload)
   * Allows enabling/disabling services without restart
   */
  updateServiceConfig(config: { orders?: boolean; deposits?: boolean }): void {
    const oldConfig = { ...this.serviceConfig };

    if (config.orders !== undefined) {
      this.serviceConfig.ordersEnabled = config.orders;
    }
    if (config.deposits !== undefined) {
      this.serviceConfig.depositsEnabled = config.deposits;
    }

    this.logger.info('Service configuration updated (hot-reload)', {
      old: oldConfig,
      new: this.serviceConfig,
      changes: {
        ordersChanged: oldConfig.ordersEnabled !== this.serviceConfig.ordersEnabled,
        depositsChanged: oldConfig.depositsEnabled !== this.serviceConfig.depositsEnabled
      }
    });
  }

  /**
   * Set up event handlers for internal communication
   */
  private setupEventHandlers(): void {
    // Forward service events through the event bus
    if (this.orderService) {
      this.orderService.on('orderStatusChanged', (event) => {
        this.eventBus.emitOrderStatusChanged(event);
      });
    }

    if (this.depositService) {
      this.depositService.on('depositReceived', (event) => {
        this.eventBus.emitDepositReceived(event);
      });

      this.depositService.on('addressBound', (event) => {
        this.eventBus.emitAddressBound(event);
      });

      // Forward dynamic deposit events
      this.depositService.on('wildcard', (eventName: string, event) => {
        this.eventBus.emit(eventName, event);
      });
    }

    // Handle monitor events
    this.setupMonitorEventHandlers();

    // Handle delayed confirmation events
    this.setupDelayedConfirmationEventHandlers();
  }

  /**
   * Setup monitor event handlers
   */
  private setupMonitorEventHandlers(): void {
    // Handle transfer events
    this.monitor.on('transfer', async (event: TransferEvent) => {
      try {
        await this.handleTransferEvent(event);
      } catch (error) {
        this.logger.error('Error handling transfer event:', error);
        this.eventBus.emitError(ErrorUtils.wrapError(error), {
          operation: 'handleTransferEvent',
          txHash: event.transactionHash
        });
      }
    });

    // Handle block progress events
    this.monitor.on('blockProgress', async (event: any) => {
      try {
        if (event.blockNumber !== undefined && event.blockNumber !== null) {
          await this.chainBlocksRepository.updateChainBlock(event.chain, event.blockNumber);
          this.eventBus.emitBlockProgress(event);
        }
      } catch (error) {
        this.logger.error(`Failed to update chain blocks for ${event.chain}:`, error);
      }
    });

    // Handle recovery completion
    this.monitor.on('chainTargetReached', (event: any) => {
      this.eventBus.emitChainTargetReached(event);
      this.checkRecoveryCompletion();
    });

    this.monitor.on('syncStatusChanged', (event: any) => {
      this.eventBus.emitSyncStatusChanged(event);
      if (event.isAllChainsSynced && this.isRecovering) {
        setTimeout(() => {
          this.checkRecoveryCompletion();
        }, 1000);
      }
    });
  }

  /**
   * Setup delayed confirmation event handlers
   */
  private setupDelayedConfirmationEventHandlers(): void {
    this.delayedConfirmation.on('initialProcessing', async (data: any) => {
      try {
        await this.recordTransferOnly(data.transferData, data.businessContext);
      } catch (error) {
        this.logger.error(`Error in initial processing for ${data.txHash}:`, error);
      }
    });

    this.delayedConfirmation.on('confirmationProgress', async (data: any) => {
      try {
        await this.transferRepository.updateConfirmationProgress(data.txHash, data.currentConfirmations);
      } catch (error) {
        this.logger.error(`Error updating confirmation progress for ${data.txHash}:`, error);
      }
    });

    this.delayedConfirmation.on('transactionConfirmed', async (data: any) => {
      try {
        await this.transferRepository.markAsConfirmed(data.txHash, data.currentConfirmations);
        await this.handleTransactionConfirmed(data.transferData, data.businessContext);
        this.eventBus.emitTransferConfirmed(data.transferData, data.currentConfirmations, data.businessContext);
      } catch (error) {
        this.logger.error(`Error in transaction confirmed processing for ${data.txHash}:`, error);
      }
    });
  }

  /**
   * Handle transfer events from monitor
   */
  private async handleTransferEvent(event: TransferEvent): Promise<void> {
    this.logger.info(`🔍 Processing transfer event`, {
      txHash: event.transactionHash,
      chain: event.chain,
      to: event.to,
      amount: event.amount
    });

    // Resolve business context
    const businessContext = await this.businessResolver.resolveBusinessContext(event.to, event.chain);

    if (!businessContext) {
      this.logger.warn(`No business context found for address ${event.to} on ${event.chain}`);
      return;
    }

    this.logger.info(`Routing transfer to ${businessContext.type}:${businessContext.id}`);

    // Add to delayed confirmation queue
    const requiredConfirmations = ChainUtils.getRequiredConfirmations(event.chain);
    this.delayedConfirmation.addPendingTransaction(event, requiredConfirmations, businessContext);

    this.eventBus.emitTransferDetected(event, businessContext);
  }

  /**
   * Record transfer only (without business completion logic)
   */
  private async recordTransferOnly(event: TransferEvent, businessContext: any): Promise<void> {
    if (businessContext.type === 'order' && this.orderService) {
      await (this.orderService as any).recordTransferOnly(event, businessContext);
    } else if (businessContext.type === 'deposit' && this.depositService) {
      await (this.depositService as any).recordTransferOnly(event, businessContext);
    }
  }

  /**
   * Handle confirmed transaction business logic
   */
  private async handleTransactionConfirmed(event: TransferEvent, businessContext: any): Promise<void> {
    if (businessContext.type === 'order' && this.orderService) {
      // Calculate total confirmed amount for order
      const confirmedTransfers = await this.transferRepository.findConfirmedByOrderId(businessContext.id);
      const totalConfirmedAmount = confirmedTransfers.reduce((sum, transfer) => {
        return sum + parseFloat(transfer.amount);
      }, 0);

      await this.orderService.processConfirmedTransfer(businessContext.id, totalConfirmedAmount);
    } else if (businessContext.type === 'deposit' && this.depositService) {
      await this.depositService.handleDepositConfirmation(businessContext.id, event);
    }
  }

  /**
   * Restore monitoring targets during recovery
   */
  private async restoreMonitoringTargets(): Promise<void> {
    try {
      let totalTargets = 0;

      // Restore order monitoring
      if (this.orderService) {
        const pendingOrders = await this.orderRepository.findByStatus('pending');
        this.logger.info(`🔄 Recovery: Found ${pendingOrders.length} pending orders to restore`);

        for (const order of pendingOrders) {
          try {
            // Use OrderService's restoreOrderMonitoring to properly restore both monitoring and timeout timers
            // This method also handles expired orders immediately
            await this.orderService.restoreOrderMonitoring(order);
            totalTargets++;
          } catch (error) {
            this.logger.error(`Failed to restore order ${order.id}:`, error);
          }
        }
      }

      // Restore deposit monitoring
      if (this.depositService) {
        // Get all bound addresses across all organizations for system recovery
        const boundAddresses = await this.getAllBoundAddresses();
        this.logger.info(`🔄 Recovery: Found ${boundAddresses.length} bound deposit addresses to restore`);

        // Collect all targets first
        const allDepositTargets: Array<{ chain: Chain; contract: string; to: string }> = [];

        for (const addressInfo of boundAddresses) {
          try {
            const protocol = addressInfo.protocol;
            const chainsToMonitor = ChainUtils.getChainsByFamily(protocol as any);

            this.logger.info(`🔄 Recovery: Processing deposit address ${addressInfo.address} (protocol: ${protocol})`);
            this.logger.info(`   Chains to monitor: ${chainsToMonitor.join(', ')}`);

            let targetsForThisAddress = 0;
            for (const chain of chainsToMonitor) {
              for (const [tokenSymbol, tokenConfig] of Object.entries(this.configManager.getTokenConfigs())) {
                const contractAddress = tokenConfig.contracts?.[chain];
                if (contractAddress) {
                  allDepositTargets.push({
                    chain: chain as Chain,
                    contract: contractAddress,
                    to: addressInfo.address
                  });
                  targetsForThisAddress++;
                  this.logger.info(`   ✅ Added target: ${chain} / ${tokenSymbol} / ${contractAddress}`);
                } else {
                  this.logger.info(`   ⏭️  Skipped: ${chain} / ${tokenSymbol} (no contract address)`);
                }
              }
            }

            this.logger.info(`   Total targets for this address: ${targetsForThisAddress}`);
          } catch (error) {
            this.logger.error(`Failed to process deposit address ${addressInfo.address}:`, error);
          }
        }

        // Batch add all targets at once
        if (allDepositTargets.length > 0) {
          this.logger.info(`🔄 Recovery: Adding ${allDepositTargets.length} deposit monitoring targets to monitor`);
          await this.monitor.watch(allDepositTargets);
          totalTargets += allDepositTargets.length;
        } else {
          this.logger.warn(`⚠️  Recovery: No deposit monitoring targets to restore (this might be a bug)`);
        }
      }

      this.logger.info(`✅ Recovery: Restored ${totalTargets} monitoring targets from database`);
    } catch (error) {
      this.logger.error('Failed to restore monitoring targets:', error);
      throw error;
    }
  }

  /**
   * Check if recovery is complete
   */
  private checkRecoveryCompletion(): void {
    if (!this.isRecovering) {
      return;
    }

    this.logger.info('🎯 Recovery completion detected, marking as completed');
    this.isRecovering = false;
    this.recoveryChains.clear();
  }

  /**
   * Get all bound addresses across all organizations (for system recovery)
   */
  private async getAllBoundAddresses(): Promise<any[]> {
    const query = `
      SELECT * FROM address_pool
      WHERE state = 'bound'
      ORDER BY organization_id, created_at
    `;
    return await this.database.query(query);
  }

}
