import type { Chain } from '@payin/monitor';

/**
 * Monitoring target for Monitor interface
 * Simple target without business context
 */
export interface MonitoringTarget {
  readonly chain: Chain;
  readonly contract: string;
  readonly to: string;
}

/**
 * Simple monitoring target manager
 * Creates monitoring targets without business context or database dependency
 */
export class MonitoringTargetManager {
  constructor() {}

  /**
   * Create monitoring target for blockchain address
   * Note: Business context is resolved separately by BusinessContextResolver
   */
  createTarget(chain: Chain, contract: string, to: string): MonitoringTarget {
    return { chain, contract, to };
  }

  /**
   * Create monitoring targets from address list
   */
  createTargets(addresses: Array<{
    chain: Chain;
    contract: string;
    to: string;
  }>): MonitoringTarget[] {
    return addresses.map(addr => this.createTarget(addr.chain, addr.contract, addr.to));
  }

  /**
   * Validate monitoring target format
   */
  validateTarget(target: MonitoringTarget): boolean {
    return !!(target.chain && target.contract && target.to);
  }

  /**
   * Create monitoring target key for deduplication
   */
  createTargetKey(target: MonitoringTarget): string {
    return `${target.chain}:${target.contract}:${target.to}`;
  }

  /**
   * Deduplicate monitoring targets by key
   */
  deduplicateTargets(targets: MonitoringTarget[]): MonitoringTarget[] {
    const seen = new Set<string>();
    return targets.filter(target => {
      const key = this.createTargetKey(target);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Group targets by chain
   */
  groupTargetsByChain(targets: MonitoringTarget[]): Record<Chain, MonitoringTarget[]> {
    const groups: Record<Chain, MonitoringTarget[]> = {} as Record<Chain, MonitoringTarget[]>;
    
    for (const target of targets) {
      if (!groups[target.chain]) {
        groups[target.chain] = [];
      }
      groups[target.chain].push(target);
    }
    
    return groups;
  }

  /**
   * Filter targets by chain
   */
  filterTargetsByChain(targets: MonitoringTarget[], chains: Chain[]): MonitoringTarget[] {
    const chainSet = new Set(chains);
    return targets.filter(target => chainSet.has(target.chain));
  }

  /**
   * Get basic target statistics
   */
  getTargetStats(targets: MonitoringTarget[]): {
    totalTargets: number;
    targetsByChain: Record<Chain, number>;
    uniqueAddresses: number;
  } {
    const targetsByChain: Record<Chain, number> = {} as Record<Chain, number>;
    const uniqueAddresses = new Set<string>();

    for (const target of targets) {
      targetsByChain[target.chain] = (targetsByChain[target.chain] || 0) + 1;
      uniqueAddresses.add(target.to);
    }

    return {
      totalTargets: targets.length,
      targetsByChain,
      uniqueAddresses: uniqueAddresses.size
    };
  }
}

export default MonitoringTargetManager;