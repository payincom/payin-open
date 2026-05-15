/**
 * Event pattern utilities for blockchain monitoring
 */
import type { Chain, TransferEvent } from '../types/index.js';
/**
 * Generate transfer event patterns for multi-level subscription
 */
export declare class EventPatterns {
    /**
     * Generate all transfer event patterns for a transfer
     * Returns patterns from most general to most specific:
     * 0. transfer (generic)
     * 1. transfer:address
     * 2. transfer:address:chain
     * 3. transfer:address:chain:contract
     */
    static getTransferPatterns(transfer: TransferEvent): string[];
    /**
     * Generate transfer event pattern for specific level
     */
    static createTransferPattern(address: string, chain?: Chain, contract?: string): string;
    /**
     * Generate block progress patterns
     */
    static getBlockProgressPatterns(chain: Chain): string[];
    /**
     * Generate error patterns
     */
    static getErrorPatterns(chain?: Chain): string[];
    /**
     * Parse transfer pattern to extract components
     */
    static parseTransferPattern(pattern: string): {
        type: 'transfer';
        address: string;
        chain?: Chain;
        contract?: string;
    } | null;
    /**
     * Parse block progress pattern
     */
    static parseBlockProgressPattern(pattern: string): {
        type: 'blockProgress';
        chain?: Chain;
    } | null;
    /**
     * Parse error pattern
     */
    static parseErrorPattern(pattern: string): {
        type: 'error';
        chain?: Chain;
    } | null;
    /**
     * Validate pattern format
     */
    static validatePattern(pattern: string): boolean;
    /**
     * Get pattern specificity level (higher = more specific)
     */
    static getPatternSpecificity(pattern: string): number;
    /**
     * Sort patterns by specificity (most specific first)
     */
    static sortPatternsBySpecificity(patterns: string[]): string[];
}
//# sourceMappingURL=event-patterns.d.ts.map