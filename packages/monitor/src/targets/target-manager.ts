/**
 * Target manager for monitoring target lifecycle and validation
 */

import type {
  Chain,
  MonitoringTarget,
  MonitoringRequest,
  TransferEvent
} from '../types/index.js'
import { getChainConfig } from '../types/chains.js'
import { MonitorError } from '../types/errors.js'
import { createLogger, LogCategory } from '@payin/shared'

/**
 * Target validation result
 */
interface TargetValidationResult {
  readonly isValid: boolean
  readonly errors: string[]
  readonly warnings: string[]
}

/**
 * Target statistics
 */
interface TargetStatistics {
  readonly totalTargets: number
  readonly targetsByChain: Map<Chain, number>
  readonly targetsByContract: Map<string, number>
  readonly uniqueAddresses: number
  readonly uniqueContracts: number
}

/**
 * Target manager handles monitoring target lifecycle
 */
export class TargetManager {
  private readonly logger = createLogger(LogCategory.MONITOR)
  private readonly activeTargets = new Set<string>()
  private readonly targetsByChain = new Map<Chain, Set<MonitoringTarget>>()
  private readonly targetsByContract = new Map<string, Set<MonitoringTarget>>()
  private readonly targetsByAddress = new Map<string, Set<MonitoringTarget>>()

  /**
   * Set all monitoring targets (replace existing)
   */
  async setTargets(targets: readonly MonitoringTarget[]): Promise<void> {
    this.clear()

    for (const target of targets) {
      this.addTarget(target)
    }
  }

  /**
   * Add array of targets and return added ones
   */
  async addTargets(targets: readonly MonitoringTarget[]): Promise<MonitoringTarget[]> {
    const addedTargets: MonitoringTarget[] = []

    for (const target of targets) {
      if (!this.hasTarget(target)) {
        this.addTarget(target)
        addedTargets.push(target)
      }
    }

    return addedTargets
  }

  /**
   * Remove array of targets and return removed ones
   */
  async removeTargets(targets: readonly MonitoringTarget[]): Promise<MonitoringTarget[]> {
    const removedTargets: MonitoringTarget[] = []
    
    for (const target of targets) {
      if (this.hasTarget(target)) {
        this.removeTarget(target)
        removedTargets.push(target)
      }
    }
    
    return removedTargets
  }

  /**
   * Add monitoring targets from request
   */
  addTargetsFromRequest(request: MonitoringRequest): void {
    for (const target of request) {
      this.addTarget(target)
    }
  }

  /**
   * Remove monitoring targets from request
   */
  removeTargetsFromRequest(request: MonitoringRequest): void {
    for (const target of request) {
      this.removeTarget(target)
    }
  }

  /**
   * Add single monitoring target
   */
  private addTarget(target: MonitoringTarget): void {
    const validation = this.validateTarget(target)
    if (!validation.isValid) {
      throw new MonitorError(
        `Invalid monitoring target: ${validation.errors.join(', ')}`,
        'INVALID_TARGET',
        target.chain,
        { target, errors: validation.errors }
      )
    }

    const targetKey = this.getTargetKey(target)
    
    // Check if already exists
    if (this.activeTargets.has(targetKey)) {
      this.logger.debug('Target already exists', {
        targetKey,
        chain: target.chain,
        contract: target.contract,
        to: target.to
      })
      return
    }

    // Add to all indexes
    this.activeTargets.add(targetKey)
    this.addToIndex(this.targetsByChain, target.chain, target)
    this.addToIndex(this.targetsByContract, target.contract, target)
    this.addToIndex(this.targetsByAddress, target.to, target)

    this.logger.debug('Monitoring target added', {
      targetKey,
      chain: target.chain,
      contract: target.contract,
      to: target.to
    })
  }

  /**
   * Remove single monitoring target
   */
  private removeTarget(target: MonitoringTarget): void {
    const targetKey = this.getTargetKey(target)
    
    this.logger.debug('Attempting to remove target', {
      targetKey,
      activeTargetsCount: this.activeTargets.size,
      targetExists: this.activeTargets.has(targetKey)
    })
    
    if (!this.activeTargets.has(targetKey)) {
      this.logger.warn('Target does not exist for removal', {
        targetKey,
        availableKeys: Array.from(this.activeTargets.keys()).slice(0, 5)
      })
      return
    }

    // Remove from all indexes
    this.activeTargets.delete(targetKey)
    this.removeFromIndex(this.targetsByChain, target.chain, target)
    this.removeFromIndex(this.targetsByContract, target.contract, target)
    this.removeFromIndex(this.targetsByAddress, target.to, target)

    this.logger.info('Monitoring target removed', {
      targetKey,
      chain: target.chain,
      contract: target.contract,
      to: target.to
    })
  }

  /**
   * Check if target exists
   */
  hasTarget(target: MonitoringTarget): boolean {
    const targetKey = this.getTargetKey(target)
    return this.activeTargets.has(targetKey)
  }

  /**
   * Get all active targets
   */
  getAllTargets(): MonitoringTarget[] {
    const allTargets: MonitoringTarget[] = []
    
    for (const targets of this.targetsByChain.values()) {
      allTargets.push(...Array.from(targets))
    }
    
    return allTargets
  }

  /**
   * Get targets for a specific chain
   */
  getTargetsByChain(chain: Chain): MonitoringTarget[] {
    const targets = this.targetsByChain.get(chain)
    return targets ? Array.from(targets) : []
  }

  /**
   * Get targets for a specific contract
   */
  getTargetsByContract(contract: string): MonitoringTarget[] {
    const targets = this.targetsByContract.get(contract)
    return targets ? Array.from(targets) : []
  }

  /**
   * Get targets for a specific address
   */
  getTargetsByAddress(address: string): MonitoringTarget[] {
    const targets = this.targetsByAddress.get(address)
    return targets ? Array.from(targets) : []
  }

  /**
   * Get target count
   */
  getTargetCount(): number {
    return this.activeTargets.size
  }

  /**
   * Get target statistics
   */
  getTargetStatistics(): TargetStatistics {
    const targetsByChain = new Map<Chain, number>()
    const targetsByContract = new Map<string, number>()
    const uniqueAddresses = new Set<string>()
    const uniqueContracts = new Set<string>()

    for (const [chain, targets] of this.targetsByChain.entries()) {
      targetsByChain.set(chain, targets.size)
    }

    for (const [contract, targets] of this.targetsByContract.entries()) {
      targetsByContract.set(contract, targets.size)
      uniqueContracts.add(contract)
    }

    for (const targets of this.targetsByAddress.values()) {
      for (const target of targets) {
        uniqueAddresses.add(target.to)
      }
    }

    return {
      totalTargets: this.activeTargets.size,
      targetsByChain,
      targetsByContract,
      uniqueAddresses: uniqueAddresses.size,
      uniqueContracts: uniqueContracts.size
    }
  }

  /**
   * Check if target matches a transfer event
   */
  matchesTransfer(target: MonitoringTarget, transfer: TransferEvent): boolean {
    return target.chain === transfer.chain &&
           target.contract === transfer.contract &&
           target.to === transfer.to
  }

  /**
   * Find targets that match a transfer event
   */
  findMatchingTargets(transfer: TransferEvent): MonitoringTarget[] {
    const allTargets = this.getAllTargets()
    return allTargets.filter(target => this.matchesTransfer(target, transfer))
  }

  /**
   * Clear all targets
   */
  clear(): void {
    this.activeTargets.clear()
    this.targetsByChain.clear()
    this.targetsByContract.clear()
    this.targetsByAddress.clear()
  }

  /**
   * Validate monitoring target
   */
  private validateTarget(target: MonitoringTarget): TargetValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate required fields
    if (!target.chain) {
      errors.push('Chain is required')
    }

    if (!target.contract) {
      errors.push('Contract address is required')
    }

    if (!target.to) {
      errors.push('To address is required')
    }

    // Validate chain support
    if (target.chain) {
      try {
        getChainConfig(target.chain)
      } catch {
        errors.push(`Unsupported chain: ${target.chain}`)
      }
    }

    // Validate addresses (basic format check)
    if (target.contract) {
      if (!this.isValidAddress(target.contract, target.chain)) {
        errors.push(`Invalid contract address format: ${target.contract}`)
      }
    }

    if (target.to) {
      if (!this.isValidAddress(target.to, target.chain)) {
        errors.push(`Invalid to address format: ${target.to}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate address format for chain
   */
  private isValidAddress(address: string, chain: Chain): boolean {
    if (!address) return false

    try {
      const chainConfig = getChainConfig(chain)
      
      if (chainConfig.protocol === 'evm') {
        // EVM address validation (starts with 0x, 42 characters)
        return /^0x[a-fA-F0-9]{40}$/.test(address)
      } else if (chainConfig.protocol === 'tron') {
        // Tron address validation (starts with T, 34 characters)
        return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
      }
      
      return true // Unknown protocol, assume valid
    } catch {
      return false
    }
  }

  /**
   * Generate unique key for target
   */
  private getTargetKey(target: MonitoringTarget): string {
    // Normalize addresses to lowercase for consistent comparison
    const contract = target.contract?.toLowerCase() || ''
    const to = target.to?.toLowerCase() || ''
    return `${target.chain}:${contract}:${to}`
  }

  /**
   * Add target to index
   */
  private addToIndex<K>(
    index: Map<K, Set<MonitoringTarget>>, 
    key: K, 
    target: MonitoringTarget
  ): void {
    let targetSet = index.get(key)
    if (!targetSet) {
      targetSet = new Set()
      index.set(key, targetSet)
    }
    targetSet.add(target)
  }

  /**
   * Remove target from index
   */
  private removeFromIndex<K>(
    index: Map<K, Set<MonitoringTarget>>, 
    key: K, 
    target: MonitoringTarget
  ): void {
    const targetSet = index.get(key)
    if (targetSet) {
      // Find the actual target object by matching key values instead of object reference
      const targetKey = this.getTargetKey(target)
      let targetToRemove: MonitoringTarget | undefined
      
      for (const existingTarget of targetSet) {
        if (this.getTargetKey(existingTarget) === targetKey) {
          targetToRemove = existingTarget
          break
        }
      }
      
      if (targetToRemove) {
        targetSet.delete(targetToRemove)
        if (targetSet.size === 0) {
          index.delete(key)
        }
      }
    }
  }
}