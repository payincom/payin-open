/**
 * Core Monitor Engine - Final Refactoring with API Restoration and Hardcoded Dependency
 */

import type { Chain, MonitoringTarget, TransferEvent } from '../types/index.js'
import type { BaseAdapter } from '../adapters/index.js'
import { AdapterFactory } from '../adapters/index.js'
import { MonitorEventEmitter } from '../events/index.js'
import { ChainStateManager } from '../state/index.js'
import { TargetManager } from '../targets/index.js'
import { createLogger, LogCategory } from '@payin/shared'
import type { MonitorConfig, MonitorOptions } from '../types/index.js'
import { createMonitorConfig, validateMonitorConfig, DEFAULT_MONITOR_CONFIG } from '../types/index.js'
import type { MonitorStats, MonitorStatus, BlockScanTask, MonitorEventData, MonitorRecoveryState, ChainMonitoringState, MonitorPerformance } from './monitor-types.js'
import { MultiChainScanner, ScanPriority } from './scanner.js'
import { RPCManager, createRPCManager } from '../rpc/index.js'

export class Monitor extends MonitorEventEmitter<MonitorEventData> {
  private readonly logger = createLogger(LogCategory.MONITOR)
  private readonly config: MonitorConfig & typeof DEFAULT_MONITOR_CONFIG
  private readonly adapterFactory: AdapterFactory
  private readonly stateManager: ChainStateManager
  private readonly targetManager: TargetManager
  private readonly scanner: MultiChainScanner
  private rpcManager: RPCManager | null = null
  
  private status: MonitorStatus = 'stopped'
  private startTime: number = 0
  private adapters = new Map<Chain, BaseAdapter>()
  
  private chainStates = new Map<Chain, ChainMonitoringState>()
  private stats: MonitorStats
  private scanStartTimes = new Map<Chain, number>()
  private isAllChainsSynced: boolean = true
  
  private scanInterval?: NodeJS.Timeout
  // ... other intervals

  constructor(config: MonitorConfig, adapterFactory?: AdapterFactory, options: MonitorOptions = {}) {
    super()
    validateMonitorConfig(config)
    this.config = createMonitorConfig(config)

    this.adapterFactory = adapterFactory ?? new AdapterFactory()
    this.stateManager = new ChainStateManager(this.config, this)
    this.targetManager = new TargetManager()
    this.scanner = new MultiChainScanner(this)
    this.rpcManager = config.rpcManager || null
    this.stats = this.createInitialStats()
    // Initially assume not synced, will be updated by updateAllChainsSyncedStatus() after initialization
    this.isAllChainsSynced = false;

    if (options.startImmediately) {
      this.start(options).catch(error => this.logger.error('Failed to start monitor automatically', { error }));
    }
  }

  async start(options: MonitorOptions = {}): Promise<void> {
    if (this.status !== 'stopped') throw new Error(`Cannot start monitor: current status is ${this.status}`);
    this.setStatus('starting');
    this.startTime = Date.now();
    try {
      await this.initializeRPCManager();
      await this.initializeAdapters();
      await this.setupScanners();
      // Note: Targets are managed dynamically via watch()/unwatch() methods
      await this.initializeState();
      this.startIntervals();
      this.startScanning();
      this.setStatus('running');
      this.logger.info('Monitor started successfully');
    } catch (error) {
      this.setStatus('error');
      this.logger.error('Failed to start monitor', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Monitor stop() method called.', { status: this.status });
    if (this.status === 'stopped') return;
    this.setStatus('stopping');
    try {
      this.clearIntervals();
      await this.saveState();
      await this.destroyAdapters();
      if (this.rpcManager) {
        await this.rpcManager.stop();
        this.rpcManager = null;
      }
      this.removeAllListeners();
      this.setStatus('stopped');
      this.logger.info('Monitor stopped successfully');
    } catch (error) {
      this.setStatus('error');
      this.logger.error('Error stopping monitor', { error });
      throw error;
    }
  }

  /**
   * Add monitoring targets to the monitor
   *
   * IMPORTANT USAGE NOTES:
   *
   * 1. Recovery Mode (when chainSettings with startBlock is specified):
   *    - All targets MUST be added BEFORE calling monitor.start()
   *    - Do NOT add new targets after start() until sync is complete
   *    - Reason: The fast-forward optimization assumes all business targets are present at start
   *    - If targets are added mid-recovery, historical transfers may be missed
   *
   * 2. Normal Mode (no startBlock specified):
   *    - Targets can be added anytime (before or after start)
   *    - New targets will be monitored from the next scan cycle
   *
   * Example Recovery Pattern (Processor):
   *   if (isRecovering) {
   *     await monitor.watch(allTargets);  // Add all targets first
   *   }
   *   await monitor.start();              // Then start monitor
   *
   * @param targets - Array of monitoring targets to add
   */
  async watch(targets: readonly MonitoringTarget[]): Promise<void> {
    const addedTargets = await this.targetManager.addTargets(targets);
    if (addedTargets.length > 0) {
      this.emit('targetsUpdated', { added: addedTargets, removed: [], total: this.targetManager.getTargetCount() });
      this.logger.info('Monitoring targets added', { addedCount: addedTargets.length });

      // Only trigger immediate scan if monitor is already running
      if (this.status === 'running' && this.config.chainRanges && Object.keys(this.config.chainRanges).length > 0) {
        this.logger.info('🚀 Triggering immediate recovery scan after adding targets.');
        process.nextTick(() => this.executeScanCycle().catch(err => this.logger.error('Immediate scan failed', err)));
      }
    }
  }

  async unwatch(targets: readonly MonitoringTarget[]): Promise<void> {
    if (targets.length === 0) return;
    this.logger.info('Removing targets from monitoring', { targetCount: targets.length });
    
    const removedTargets = await this.targetManager.removeTargets(targets);
    
    if (removedTargets.length > 0) {
      this.emit('targetsUpdated', {
        added: [],
        removed: removedTargets,
        total: this.targetManager.getTargetCount()
      });
      this.logger.info('Monitoring targets removed', { removedCount: removedTargets.length });
    }
  }

  async watchAddressMatrix(address: string, chainFamily: 'evm' | 'tron' | 'solana', tokenContracts: Record<string, Record<string, string>>): Promise<MonitoringTarget[]> {
    const chains = this._getChainsByFamily(chainFamily);
    const targets: MonitoringTarget[] = [];
    for (const chainId of chains) {
      for (const [tokenSymbol, contracts] of Object.entries(tokenContracts)) {
        const contractAddress = contracts[chainId];
        if (contractAddress) {
          targets.push({ chain: chainId as Chain, contract: contractAddress, to: address });
        }
      }
    }
    if (targets.length > 0) {
      await this.watch(targets);
    }
    return targets;
  }

  async unwatchAddressMatrix(address: string, chainFamily: 'evm' | 'tron' | 'solana', tokenContracts: Record<string, Record<string, string>>): Promise<MonitoringTarget[]> {
    const chains = this._getChainsByFamily(chainFamily);
    const targets: MonitoringTarget[] = [];
    for (const chainId of chains) {
      for (const [tokenSymbol, contracts] of Object.entries(tokenContracts)) {
        const contractAddress = contracts[chainId];
        if (contractAddress) {
          targets.push({ chain: chainId as Chain, contract: contractAddress, to: address });
        }
      }
    }
    if (targets.length > 0) {
      await this.unwatch(targets);
    }
    return targets;
  }

  async validateTransaction(chain: Chain, transactionHash: string): Promise<{ isValid: boolean; blockNumber?: number; currentConfirmations?: number; error?: string; }> {
    try {
      const scanner = this.scanner.getScanner(chain);
      if (!scanner) return { isValid: false, error: `No scanner for chain: ${chain}` };
      const receipt = await scanner.getTransactionReceipt(transactionHash);
      if (!receipt || !receipt.blockNumber) return { isValid: false, error: `Transaction not found: ${transactionHash}` };
      const currentBlock = await scanner.getCurrentBlockNumber();
      const confirmations = Math.max(0, currentBlock - receipt.blockNumber + 1);
      return { isValid: true, blockNumber: receipt.blockNumber, currentConfirmations: confirmations };
    } catch (error) {
      return { isValid: false, error: (error as Error).message };
    }
  }

  getStatus(): MonitorStatus { return this.status; }
  getMonitorStats(): MonitorStats { return this.stats; }

  /**
   * FOR TESTING PURPOSES ONLY
   * Gets the current number of active monitoring targets.
   * @returns The number of targets.
   */
  public getInternalTargetCount(): number {
    return this.targetManager.getTargetCount();
  }

  private _getChainsByFamily(family: 'evm' | 'tron' | 'solana'): string[] {
    const chainFamilyMap: Record<string, 'evm' | 'tron' | 'solana'> = {
      'ethereum-mainnet': 'evm',
      'ethereum-sepolia': 'evm',
      'polygon-mainnet': 'evm',
      'polygon-amoy': 'evm',
      'tron-mainnet': 'tron',
      'tron-nile': 'tron',
      'xlayer-mainnet': 'evm',
      'xlayer-testnet': 'evm'
    };
    const chains: string[] = [];
    for (const [chainId, chainFamily] of Object.entries(chainFamilyMap)) {
      if (chainFamily === family) {
        chains.push(chainId);
      }
    }
    return chains;
  }

  private startScanning(): void {
    this.logger.info('Starting block scanning cycle');
    const scan = async () => {
      try {
        await this.executeScanCycle();
      } catch (error) {
        this.logger.error('Unhandled error in executeScanCycle', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
      
      // Only schedule next scan if monitor is still running
      if (this.status === 'running') {
        this.scanInterval = setTimeout(scan, this.config.scanInterval);
      }
    };

    // Start the first scan immediately without waiting for the interval
    void scan();
  }

  private async executeScanCycle(): Promise<void> {
    const activeTargets = this.targetManager.getAllTargets();
    // Check if any chain has scan range limits (startBlock), indicating it needs bounded scanning
    const isRecoveryMode = !!this.config.chainSettings && Object.values(this.config.chainSettings).some(
      settings => settings?.chainRanges?.startBlock !== undefined
    );

    // Only log scan cycle if there are targets or in recovery mode
    if (activeTargets.length > 0 || isRecoveryMode) {
      this.logger.info('🔍 Starting Scan Cycle', { isRecoveryMode, activeTargetsCount: activeTargets.length });
    }

    // Parallel execution: process all chains concurrently
    const chainScanPromises = Array.from(this.chainStates.entries()).map(async ([chain, chainState]) => {
      const scanner = this.scanner.getScanner(chain);
      const chainTargets = activeTargets.filter(t => t.chain === chain);
      // In recovery mode, allow scanning even without targets to update chain state
      const hasNoTargets = chainTargets.length === 0;
      const shouldSkipScan = !isRecoveryMode && hasNoTargets;

      // Check basic prerequisites
      if (!scanner || !chainState.isHealthy) {
        this.logger.debug(`Skipping ${chain}: ${!scanner ? 'no scanner' : 'unhealthy'}`);
        return;
      }

      // Try to acquire scan lock
      if (!this.tryAcquireScanLock(chain)) {
        this.logger.debug('🔒 SCAN LOCK BUSY', { chain });
        return;
      }

      try {
        // If no targets in normal mode, just update chain height without scanning
        if (shouldSkipScan) {
          this.logger.debug('⏭️  NO TARGETS - Updating chain height only', { chain });
          const currentBlock = await scanner.getCurrentBlockNumber();

          // Emit blockScanned event for DelayedConfirmation caching
          this.emit('blockScanned', { chain, currentBlock, timestamp: Date.now() });

          const safeBlock = currentBlock - this.config.safeBlockDistance;

          // Update chain state to safe block (skip scanning but keep state current)
          this.processScanResult(chain, chainState, {
            scannedToBlock: safeBlock,
            transfers: []
          });

          const updatedState = this.chainStates.get(chain);
          if (updatedState) {
            this.chainStates.set(chain, { ...updatedState, currentBlock });
            this.stateManager.setChainProgress(chain, safeBlock);
          }
          // Sync stats.currentBlock so getMonitorStats() reflects latest chain height
          this.stats.currentBlock.set(chain, currentBlock);
          this.logger.debug(`${chain} height updated (no targets): current=${currentBlock} safe=${safeBlock}`);
        } else {
          // Normal scanning with targets or bounded scanning mode
          const hasRangeLimit = this.config.chainSettings?.[chain]?.chainRanges?.startBlock !== undefined;
          const scanResult = (isRecoveryMode && hasRangeLimit)
            ? await this.executeRecoveryScanForChain(chain, chainState, scanner, chainTargets)
            : await this.executeNormalScanForChain(chain, chainState, scanner, chainTargets);
          this.processScanResult(chain, chainState, scanResult);
        }
      } catch (error) {
        this.logger.error('Scan cycle error for chain', { chain, error });
        this.updateChainHealth(chain, false, (error as Error).message);
      } finally {
        this.releaseScanLock(chain);
      }
    });

    // Wait for all chain scans to complete
    await Promise.all(chainScanPromises);
  }

  private async executeRecoveryScanForChain(chain: Chain, state: ChainMonitoringState, scanner: any, targets: MonitoringTarget[]) {
    const chainSettings = this.config.chainSettings![chain]!;
    const range = chainSettings.chainRanges!;
    const currentBlock = await scanner.getCurrentBlockNumber();
    const updatedState = { ...state, currentBlock };
    this.chainStates.set(chain, updatedState);
    this.stats.currentBlock.set(chain, currentBlock);

    // Emit block:scanned event for DelayedConfirmation caching
    this.emit('blockScanned', { chain, currentBlock, timestamp: Date.now() });

    // Use chain-specific batchSize if available, otherwise fall back to global blockRangeSize
    const batchSize = chainSettings.batchSize ?? this.config.blockRangeSize;

    const from = Math.max(state.lastProcessedBlock + 1, range.startBlock || 0);
    const to = Math.min(from + batchSize - 1, range.endBlock || currentBlock);
    if (from > to) return { scannedToBlock: state.lastProcessedBlock, transfers: [] };

    // Optimization: Fast-forward if no targets (safe due to Processor's recovery guarantee)
    // When targets.length === 0, it means:
    // 1. All required monitoring targets (pending orders + bound addresses) were restored BEFORE monitor start
    // 2. Recovery mode prevents new business creation (isRecovering flag blocks createOrder/bindAddress)
    // 3. Therefore, no transfers in this block range need to be detected - safe to skip
    if (targets.length === 0) {
      // Jump directly to the safe block instead of incrementally advancing
      const safeBlock = currentBlock - this.config.safeBlockDistance;
      const jumpTo = Math.min(range.endBlock || currentBlock, safeBlock);

      this.logger.info(
        `⚡⚡ RECOVERY FAST-FORWARD: ${chain} jumping from ${from} to ${jumpTo}`,
        {
          skippedBlocks: jumpTo - from,
          reason: 'no_active_targets',
          safety: 'processor_recovery_guarantee'
        }
      );

      return { scannedToBlock: jumpTo, transfers: [] };
    }

    this.logger.info(`🚀 RECOVERY SCAN: ${chain}`, { from, to, batchSize, targets: targets.length });
    const task: BlockScanTask = { id: `rec-${chain}-${from}-${to}`, chain, fromBlock: from, toBlock: to, targets, priority: ScanPriority.CRITICAL, createdAt: Date.now(), retryCount: 0 };
    const result = await scanner.executeScanTask(task, targets);
    const finalState = this.chainStates.get(chain) ?? updatedState;
    return { scannedToBlock: result.success ? to : finalState.lastProcessedBlock, transfers: result.transfers };
  }

  private async executeNormalScanForChain(chain: Chain, state: ChainMonitoringState, scanner: any, targets: MonitoringTarget[]) {
    const currentBlock = await scanner.getCurrentBlockNumber();
    const updatedState = { ...state, currentBlock };
    this.chainStates.set(chain, updatedState);
    this.stats.currentBlock.set(chain, currentBlock);

    // Emit block:scanned event for DelayedConfirmation caching
    this.emit('blockScanned', { chain, currentBlock, timestamp: Date.now() });

    // Use chain-specific batchSize if available, otherwise fall back to global blockRangeSize
    const chainSettings = this.config.chainSettings?.[chain];
    const batchSize = chainSettings?.batchSize ?? this.config.blockRangeSize;

    const safeBlock = currentBlock - this.config.safeBlockDistance;
    const from = state.lastProcessedBlock + 1;
    const to = Math.min(safeBlock, from + batchSize - 1);
    if (from > to) {
      this.logger.debug(`⏸️  ${chain}: No new blocks to scan (from=${from} > to=${to}, current=${currentBlock}, safe=${safeBlock})`);
      return { scannedToBlock: state.lastProcessedBlock, transfers: [] };
    }
    this.logger.info(`🔍 NORMAL SCAN: ${chain}`, { from, to, batchSize, targets: targets.length });
    const task: BlockScanTask = { id: `scan-${chain}-${from}-${to}`, chain, fromBlock: from, toBlock: to, targets, priority: ScanPriority.HIGH, createdAt: Date.now(), retryCount: 0 };
    return await scanner.scanLatestBlocks(task, this.config.safeBlockDistance, targets);
  }

  private processScanResult(chain: Chain, oldState: ChainMonitoringState, result: { scannedToBlock: number; transfers: readonly any[] }) {
    const currentState = this.chainStates.get(chain) ?? oldState;
    if (result.scannedToBlock <= currentState.lastProcessedBlock) return;
    const reachedTarget = currentState.targetBlock !== undefined && result.scannedToBlock >= currentState.targetBlock;
    if (reachedTarget) {
      this.logger.info(`Chain ${chain} reached target block ${currentState.targetBlock}`);
      this.emit('chainTargetReached', { chain, targetBlock: currentState.targetBlock, finalBlock: result.scannedToBlock });
    }
    const newState: ChainMonitoringState = {
      ...currentState,
      lastProcessedBlock: result.scannedToBlock,
      lastActivity: Date.now(),
      targetBlock: reachedTarget ? undefined : currentState.targetBlock
    };
    this.chainStates.set(chain, newState);
    this.stateManager.setChainProgress(chain, result.scannedToBlock);
    this.updateAllChainsSyncedStatus();
  }

  private updateChainHealth(chain: Chain, isHealthy: boolean, error?: string) {
    const state = this.chainStates.get(chain);
    if (state) this.chainStates.set(chain, { ...state, isHealthy, lastError: error, lastActivity: Date.now() });
  }

  private tryAcquireScanLock(chain: Chain): boolean {
    const startTime = this.scanStartTimes.get(chain);
    if (startTime) {
      if (Date.now() - startTime > 30000) {
        this.logger.warn('Stale scan lock detected, releasing', { chain });
        this.releaseScanLock(chain);
      } else return false;
    }
    this.scanStartTimes.set(chain, Date.now());
    return true;
  }

  private releaseScanLock(chain: Chain): void { this.scanStartTimes.delete(chain); }
  private setStatus(newStatus: MonitorStatus): void {
    if (newStatus === this.status) return;
    const oldStatus = this.status;
    this.status = newStatus;
    this.emit('statusChanged', { oldStatus, newStatus, timestamp: Date.now() });
  }
  private createInitialStats(): MonitorStats { return { status: 'stopped', uptime: 0, totalTransfers: 0, transfersPerChain: new Map(), errorCount: 0, currentBlock: new Map(), targetCount: 0, chainsActive: 0, adaptersHealthy: 0, averageBlockTime: new Map(), rpcResponseTime: new Map() }; }
  private clearIntervals(): void {
    this.logger.info('Clearing all monitor intervals...');
    try { if (this.scanInterval) { clearTimeout(this.scanInterval); delete (this as any).scanInterval; this.logger.info('✅ Scan interval cleared.'); } } catch (e) { this.logger.error('Error clearing scan interval', e); }
  }
  private async initializeRPCManager(): Promise<void> { if (this.rpcManager) return; this.rpcManager = await createRPCManager(this.config.rpcKeys || {}, this.config.rpcConfigPath, this.config.rpcConfig); }
  private async initializeAdapters(): Promise<void> { this.adapters = await this.adapterFactory.createAdapters(this.config.chains, this.rpcManager!); if (this.adapters.size === 0) throw new Error('Failed to initialize any adapters'); }
  private async setupScanners(): Promise<void> { for (const [chain, adapter] of this.adapters.entries()) this.scanner.addScanner(chain, adapter); }
  private async initializeState(): Promise<void> {
    this.logger.debug(`initializeState: chains=${this.config.chains.length} hasRanges=${!!this.config.chainRanges}`);

    for (const chain of this.config.chains) {
      const adapter = this.adapters.get(chain);
      if (!adapter) continue;
      try {
        const currentBlock = await adapter.getCurrentBlockNumber();
        const range = this.config.chainSettings?.[chain]?.chainRanges || this.config.chainRanges?.[chain];
        const startBlock = range?.startBlock !== undefined ? range.startBlock : Math.max(0, currentBlock - this.config.safeBlockDistance);
        const targetBlock = range?.endBlock;

        this.logger.debug(`Init ${chain}: current=${currentBlock} start=${startBlock} target=${targetBlock}`);

        this.chainStates.set(chain, { chain, currentBlock, lastProcessedBlock: startBlock - 1, targetBlock, isHealthy: true, blockProcessingRate: 0, transferDetectionRate: 0, lastActivity: Date.now() });
        this.stateManager.setChainProgress(chain, startBlock);
      } catch (error) { this.logger.error('Failed to initialize state for chain', { chain, error }); }
    }

    this.updateAllChainsSyncedStatus();
    this.logger.debug('initializeState completed');
  }
  async saveState(): Promise<void> {
    if (!this.config.persistence.stateStorage) return;
    const state: MonitorRecoveryState = { timestamp: Date.now(), lastBlock: new Map(Array.from(this.chainStates.entries()).map(([c, s]) => [c, s.lastProcessedBlock])), targets: this.targetManager.getAllTargets(), stats: { ...this.stats } };
    await this.config.persistence.stateStorage.save('monitor-state', state);
  }
  private startIntervals(): void { /* Starts stats, healthcheck, etc. */ }
  private updateAllChainsSyncedStatus(): void {
    this.logger.debug(`updateSyncStatus: synced=${this.isAllChainsSynced} ranges=${!!this.config.chainRanges} chains=${this.chainStates.size}`);

    let allChainsCaughtUp = true;

    for (const [chain, state] of this.chainStates.entries()) {
      this.logger.debug(`Processing ${chain}: last=${state.lastProcessedBlock} target=${state.targetBlock} current=${state.currentBlock}`);

      // Original logic for fixed target blocks
      if (state.targetBlock !== undefined && state.lastProcessedBlock < state.targetBlock) {
        this.logger.debug(`${chain} not caught up: ${state.lastProcessedBlock}/${state.targetBlock}`);
        allChainsCaughtUp = false;
        break;
      }

      // Correctly get the range for the current chain in the loop
      const range = this.config.chainSettings?.[chain]?.chainRanges || this.config.chainRanges?.[chain];

      this.logger.debug(`DEBUG: updateAllChainsSyncedStatus - Chain: ${chain}, Range: ${JSON.stringify(range)}, ChainSettings: ${JSON.stringify(this.config.chainSettings?.[chain])}`);

      // If in recovery mode (isRecovering is true) and this chain is supposed to have a range but doesn't
      // This condition is a more precise check for the reported critical error scenario
      const isOverallRecoveryMode = !!this.config.chainSettings && Object.values(this.config.chainSettings).some(
        settings => settings?.chainRanges?.startBlock !== undefined
      );

      if (isOverallRecoveryMode && state.targetBlock === undefined && range?.startBlock === undefined) {
        this.logger.error(`🚨 CRITICAL: Chain ${chain} in recovery mode but missing valid range!`, {
          hasRange: range?.startBlock !== undefined,
          startBlock: range?.startBlock,
          chainRanges: range === undefined ? 'undefined' : (range === null ? 'null' : JSON.stringify(range))
        });
      }

      // Check if this chain is in recovery mode (has a startBlock) and target is not yet met
      if (state.targetBlock === undefined && range?.startBlock !== undefined) {
          // Recovery goal: catch up to current block
          const safeBlock = state.currentBlock - this.config.safeBlockDistance;
          const blocksRemaining = safeBlock - state.lastProcessedBlock;

          this.logger.info(`🔍 DEBUG ${chain} recovery check: lastProcessed=${state.lastProcessedBlock}, safe=${safeBlock}, remaining=${blocksRemaining}`);

          this.logger.debug(`${chain} recovery: lastProcessed=${state.lastProcessedBlock} safe=${safeBlock} remaining=${blocksRemaining}`);

          // Check if caught up to current block
          if (state.lastProcessedBlock < safeBlock) {
            allChainsCaughtUp = false;
            this.logger.info(`Chain ${chain} recovery in progress: ${blocksRemaining} blocks remaining to catch up`);
            break;
          }
      }
    }

    this.logger.debug(`Sync status: caughtUp=${allChainsCaughtUp} current=${this.isAllChainsSynced}`);

    if (allChainsCaughtUp !== this.isAllChainsSynced) {
      this.isAllChainsSynced = allChainsCaughtUp;
      this.logger.info('Sync status changed', { to: this.isAllChainsSynced });
      this.emit('syncStatusChanged', { isAllChainsSynced: this.isAllChainsSynced, timestamp: Date.now() });

      // If all chains are now synced and we had scan range limits, clear the chainRanges
      // but preserve batchSize configuration in chainSettings for normal mode optimization
      if (this.isAllChainsSynced && this.config.chainSettings) {
        // Clear only the chainRanges (startBlock/endBlock), keep batchSize
        const chainSettings = this.config.chainSettings as Record<string, any>;
        for (const chain in chainSettings) {
          if (chainSettings[chain] && Object.prototype.hasOwnProperty.call(chainSettings[chain], 'chainRanges')) {
            delete chainSettings[chain].chainRanges;
          }
        }
        const mutableConfig = this.config as Record<string, any>;
        if ('chainRanges' in mutableConfig) {
          delete mutableConfig.chainRanges;
        }
        this.logger.info('🎉 Recovery complete. Monitor switched to normal scanning mode (batchSize configs preserved).');
      }
    }
  }

  /**
   * Destroy adapters
   */
  private async destroyAdapters(): Promise<void> {
    await this.adapterFactory.destroyAllAdapters()
    this.adapters.clear()
  }
}
