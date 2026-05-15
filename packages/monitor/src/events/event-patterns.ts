/**
 * Event pattern utilities for blockchain monitoring
 */

import type { Chain, TransferEvent } from '../types/index.js'

/**
 * Generate transfer event patterns for multi-level subscription
 */
export class EventPatterns {
  
  /**
   * Generate all transfer event patterns for a transfer
   * Returns patterns from most general to most specific:
   * 0. transfer (generic)
   * 1. transfer:address
   * 2. transfer:address:chain  
   * 3. transfer:address:chain:contract
   */
  static getTransferPatterns(transfer: TransferEvent): string[] {
    const { to, chain, contract } = transfer
    
    return [
      'transfer',                                // Level 0: generic
      `transfer:${to}`,                          // Level 1: address only
      `transfer:${to}:${chain}`,                 // Level 2: address + chain
      `transfer:${to}:${chain}:${contract}`      // Level 3: address + chain + contract
    ]
  }

  /**
   * Generate transfer event pattern for specific level
   */
  static createTransferPattern(
    address: string,
    chain?: Chain,
    contract?: string
  ): string {
    let pattern = `transfer:${address}`
    
    if (chain) {
      pattern += `:${chain}`
      
      if (contract) {
        pattern += `:${contract}`
      }
    }
    
    return pattern
  }

  /**
   * Generate block progress patterns
   */
  static getBlockProgressPatterns(chain: Chain): string[] {
    return [
      'blockProgress',              // Global block progress
      `blockProgress:${chain}`      // Chain-specific block progress
    ]
  }

  /**
   * Generate error patterns
   */
  static getErrorPatterns(chain?: Chain): string[] {
    const patterns = ['error']     // Global errors
    
    if (chain) {
      patterns.push(`error:${chain}`)  // Chain-specific errors
    }
    
    return patterns
  }

  /**
   * Parse transfer pattern to extract components
   */
  static parseTransferPattern(pattern: string): {
    type: 'transfer'
    address: string
    chain?: Chain
    contract?: string
  } | null {
    if (!pattern.startsWith('transfer:')) {
      return null
    }

    const parts = pattern.split(':')
    if (parts.length < 2) return null

    const result: any = {
      type: 'transfer',
      address: parts[1]
    }

    if (parts.length >= 3) {
      result.chain = parts[2] as Chain
    }

    if (parts.length >= 4) {
      result.contract = parts[3]
    }

    return result
  }

  /**
   * Parse block progress pattern
   */
  static parseBlockProgressPattern(pattern: string): {
    type: 'blockProgress'
    chain?: Chain
  } | null {
    if (pattern === 'blockProgress') {
      return { type: 'blockProgress' }
    }

    if (pattern.startsWith('blockProgress:')) {
      const parts = pattern.split(':')
      if (parts.length === 2) {
        return {
          type: 'blockProgress',
          chain: parts[1] as Chain
        }
      }
    }

    return null
  }

  /**
   * Parse error pattern
   */
  static parseErrorPattern(pattern: string): {
    type: 'error'
    chain?: Chain
  } | null {
    if (pattern === 'error') {
      return { type: 'error' }
    }

    if (pattern.startsWith('error:')) {
      const parts = pattern.split(':')
      if (parts.length === 2) {
        return {
          type: 'error',
          chain: parts[1] as Chain
        }
      }
    }

    return null
  }

  /**
   * Validate pattern format
   */
  static validatePattern(pattern: string): boolean {
    // Transfer patterns: transfer:address[:chain[:contract]]
    if (pattern.startsWith('transfer:')) {
      const parts = pattern.split(':')
      return parts.length >= 2 && parts.length <= 4 && (parts[1]?.length ?? 0) > 0
    }

    // Block progress patterns: blockProgress[:chain]
    if (pattern.startsWith('blockProgress')) {
      return pattern === 'blockProgress' || 
             (pattern.startsWith('blockProgress:') && pattern.split(':').length === 2)
    }

    // Error patterns: error[:chain]  
    if (pattern.startsWith('error')) {
      return pattern === 'error' ||
             (pattern.startsWith('error:') && pattern.split(':').length === 2)
    }

    // Status and special events
    return ['status'].includes(pattern)
  }

  /**
   * Get pattern specificity level (higher = more specific)
   */
  static getPatternSpecificity(pattern: string): number {
    if (pattern.startsWith('transfer:')) {
      return pattern.split(':').length - 1  // 1, 2, or 3
    }
    
    if (pattern.startsWith('blockProgress:')) {
      return 2  // Chain-specific
    }
    
    if (pattern === 'blockProgress') {
      return 1  // Global
    }
    
    if (pattern.startsWith('error:')) {
      return 2  // Chain-specific
    }
    
    if (pattern === 'error') {
      return 1  // Global
    }
    
    return 0  // Other events
  }

  /**
   * Sort patterns by specificity (most specific first)
   */
  static sortPatternsBySpecificity(patterns: string[]): string[] {
    return patterns.slice().sort((a, b) => {
      const specificityA = EventPatterns.getPatternSpecificity(a)
      const specificityB = EventPatterns.getPatternSpecificity(b)
      return specificityB - specificityA  // Descending order
    })
  }
}