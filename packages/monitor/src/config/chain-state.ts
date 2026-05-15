import type { Chain, MonitoringTarget } from '../types/index.js'

/**
 * Chain scan state for tracking monitoring progress
 */
export interface ChainScanState {
  readonly chain: Chain
  lastWatchedBlock: number         // Last processed block number
  readonly targetBlock?: number | undefined    // Target block for recovery mode
  readonly activeTargets: Map<string, Set<string>>  // contract -> addresses
  readonly batchSize: number       // Blocks per scan batch
}

/**
 * Create initial chain scan state
 */
export function createChainScanState(
  chain: Chain,
  startBlock: number,
  batchSize: number,
  targetBlock?: number
): ChainScanState {
  return {
    chain,
    lastWatchedBlock: startBlock - 1, // Start from startBlock-1 so first scan includes startBlock
    targetBlock: targetBlock,
    activeTargets: new Map(),
    batchSize
  } as const
}

/**
 * Add monitoring targets to chain state
 */
export function addTargetsToChainState(
  state: ChainScanState,
  targets: readonly MonitoringTarget[]
): void {
  for (const target of targets) {
    if (target.chain !== state.chain) continue
    
    const addresses = state.activeTargets.get(target.contract) ?? new Set()
    addresses.add(target.to)
    state.activeTargets.set(target.contract, addresses)
  }
}

/**
 * Remove monitoring targets from chain state
 */
export function removeTargetsFromChainState(
  state: ChainScanState,
  targets: readonly MonitoringTarget[]
): void {
  for (const target of targets) {
    if (target.chain !== state.chain) continue
    
    const addresses = state.activeTargets.get(target.contract)
    if (!addresses) continue
    
    addresses.delete(target.to)
    if (addresses.size === 0) {
      state.activeTargets.delete(target.contract)
    }
  }
}

/**
 * Check if chain has active targets
 */
export function hasActiveTargets(state: ChainScanState): boolean {
  return state.activeTargets.size > 0
}

/**
 * Get all active contracts for a chain
 */
export function getActiveContracts(state: ChainScanState): string[] {
  return Array.from(state.activeTargets.keys())
}

/**
 * Get all active addresses for a contract
 */
export function getActiveAddresses(state: ChainScanState, contract: string): string[] {
  const addresses = state.activeTargets.get(contract)
  return addresses ? Array.from(addresses) : []
}

/**
 * Check if a target is active
 */
export function isTargetActive(
  state: ChainScanState,
  contract: string,
  address: string
): boolean {
  const addresses = state.activeTargets.get(contract)
  return addresses?.has(address) ?? false
}

/**
 * Update last watched block
 */
export function updateLastWatchedBlock(
  state: ChainScanState,
  blockNumber: number
): void {
  state.lastWatchedBlock = Math.max(state.lastWatchedBlock, blockNumber)
}


/**
 * Get summary of chain state
 */
export function getChainStateSummary(state: ChainScanState) {
  const totalContracts = state.activeTargets.size
  const totalAddresses = Array.from(state.activeTargets.values())
    .reduce((sum, addresses) => sum + addresses.size, 0)
    
  return {
    chain: state.chain,
    lastWatchedBlock: state.lastWatchedBlock,
    targetBlock: state.targetBlock,
    totalContracts,
    totalAddresses,
    batchSize: state.batchSize
  }
}