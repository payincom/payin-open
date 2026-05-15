/**
 * Configuration validation and helpful error messages
 * Provides user-friendly feedback for configuration issues
 */
import type { LoadedConfig } from './config-loader.js';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
}
export declare class ConfigValidator {
    private readonly logger;
    private readonly knownChains;
    private knownProviders;
    /**
     * Validate loaded configuration and provide helpful feedback
     */
    validateConfig(config: LoadedConfig, requestedChains?: string[]): ValidationResult;
    private validateRpcConfig;
    private validateChainConfig;
    private validateMonitorConfig;
    private validateEnvironmentVariables;
    private validateRequestedChains;
    private provideSuggestions;
    private suggestProvider;
    private suggestChain;
    private findClosestMatch;
    private calculateSimilarity;
    private getProvidersForChain;
    private logValidationResults;
}
/**
 * Convenience function to validate configuration
 */
export declare function validateConfig(config: LoadedConfig, requestedChains?: string[]): ValidationResult;
//# sourceMappingURL=config-validator.d.ts.map