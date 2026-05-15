/**
 * Configuration validation and helpful error messages
 * Provides user-friendly feedback for configuration issues
 */
import { createLogger, LogCategory } from '@payin/shared';
export class ConfigValidator {
    logger = createLogger(LogCategory.MONITOR);
    knownChains = new Set([
        'ethereum-mainnet', 'ethereum-sepolia',
        'polygon-mainnet', 'polygon-amoy',
        'tron-mainnet', 'tron-nile'
    ]);
    knownProviders = new Set();
    /**
     * Validate loaded configuration and provide helpful feedback
     */
    validateConfig(config, requestedChains) {
        // Get available providers from config
        this.knownProviders = new Set(config.rpc?.providers ? Object.keys(config.rpc.providers) : []);
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };
        // Validate RPC configuration
        this.validateRpcConfig(config.rpc || {}, result);
        // Validate monitor configuration
        this.validateMonitorConfig(config.monitor || {}, result);
        // Validate environment variables
        this.validateEnvironmentVariables(result);
        // Validate requested chains
        if (requestedChains) {
            this.validateRequestedChains(requestedChains, config.rpc || {}, result);
        }
        // Provide suggestions for optimization
        this.provideSuggestions(config, result);
        result.isValid = (result.errors?.length || 0) === 0;
        // Log validation results
        this.logValidationResults(result);
        return result;
    }
    validateRpcConfig(rpcConfig, result) {
        // Validate API keys
        if (rpcConfig.apiKeys) {
            for (const [provider, key] of Object.entries(rpcConfig.apiKeys)) {
                if (!this.knownProviders.has(provider)) {
                    const suggestion = this.suggestProvider(provider);
                    result.warnings.push(`Unknown provider '${provider}' in API keys${suggestion ? `. Did you mean '${suggestion}'?` : ''}`);
                }
                if (typeof key !== 'string' || !key.trim()) {
                    result.errors.push(`API key for provider '${provider}' is empty or invalid`);
                }
            }
        }
        // Validate timeout values
        if (rpcConfig.defaults?.timeout) {
            const timeout = rpcConfig.defaults.timeout;
            if (!Number.isInteger(timeout) || timeout <= 0) {
                result.errors.push(`RPC timeout must be a positive integer, got: ${timeout}`);
            }
            else if (timeout < 1000) {
                result.warnings.push(`RPC timeout ${timeout}ms is very low, may cause frequent timeouts`);
            }
            else if (timeout > 30000) {
                result.warnings.push(`RPC timeout ${timeout}ms is very high, may cause slow responses`);
            }
        }
        // Validate chain configurations
        if (rpcConfig.chains) {
            for (const [chain, chainConfig] of Object.entries(rpcConfig.chains)) {
                this.validateChainConfig(chain, chainConfig, result);
            }
        }
    }
    validateChainConfig(chain, chainConfig, result) {
        // Validate chain name
        if (!this.knownChains.has(chain)) {
            const suggestion = this.suggestChain(chain);
            result.warnings.push(`Unknown chain '${chain}'${suggestion ? `. Did you mean '${suggestion}'?` : ''}`);
        }
        // Validate preferred providers
        if (chainConfig.preferredProviders) {
            if (!Array.isArray(chainConfig.preferredProviders)) {
                result.errors.push(`Chain '${chain}' preferredProviders must be an array`);
            }
            else {
                for (const provider of chainConfig.preferredProviders) {
                    if (!this.knownProviders.has(provider)) {
                        const suggestion = this.suggestProvider(provider);
                        result.warnings.push(`Unknown provider '${provider}' in chain '${chain}'${suggestion ? `. Did you mean '${suggestion}'?` : ''}`);
                    }
                }
            }
        }
        // Validate strategy
        if (chainConfig.strategy) {
            const validStrategies = ['round_robin', 'failover', 'fastest'];
            if (!validStrategies.includes(chainConfig.strategy)) {
                result.errors.push(`Invalid strategy '${chainConfig.strategy}' for chain '${chain}'. Valid options: ${validStrategies.join(', ')}`);
            }
        }
        // Validate timeout
        if (chainConfig.timeout) {
            const timeout = chainConfig.timeout;
            if (!Number.isInteger(timeout) || timeout <= 0) {
                result.errors.push(`Chain '${chain}' timeout must be a positive integer, got: ${timeout}`);
            }
        }
    }
    validateMonitorConfig(monitorConfig, result) {
        // Validate scanning configuration
        if (monitorConfig.scanning) {
            const { defaultConfirmations, maxBlockRange, scanInterval } = monitorConfig.scanning;
            if (defaultConfirmations !== undefined) {
                if (!Number.isInteger(defaultConfirmations) || defaultConfirmations < 0) {
                    result.errors.push(`defaultConfirmations must be a non-negative integer, got: ${defaultConfirmations}`);
                }
                else if (defaultConfirmations === 0) {
                    result.warnings.push('defaultConfirmations is 0 - transactions will be processed immediately without waiting for confirmations');
                }
                else if (defaultConfirmations > 20) {
                    result.warnings.push(`defaultConfirmations ${defaultConfirmations} is very high, may cause long delays`);
                }
            }
            if (maxBlockRange !== undefined) {
                if (!Number.isInteger(maxBlockRange) || maxBlockRange <= 0) {
                    result.errors.push(`maxBlockRange must be a positive integer, got: ${maxBlockRange}`);
                }
                else if (maxBlockRange > 5000) {
                    result.warnings.push(`maxBlockRange ${maxBlockRange} is very high, may cause RPC timeouts`);
                }
            }
            if (scanInterval !== undefined) {
                if (!Number.isInteger(scanInterval) || scanInterval <= 0) {
                    result.errors.push(`scanInterval must be a positive integer, got: ${scanInterval}`);
                }
                else if (scanInterval < 1000) {
                    result.warnings.push(`scanInterval ${scanInterval}ms is very low, may overload RPC providers`);
                }
            }
        }
        // Validate performance configuration
        if (monitorConfig.performance) {
            const { cacheSize, concurrentRequests } = monitorConfig.performance;
            if (cacheSize !== undefined) {
                if (!Number.isInteger(cacheSize) || cacheSize < 0) {
                    result.errors.push(`cacheSize must be a non-negative integer, got: ${cacheSize}`);
                }
            }
            if (concurrentRequests !== undefined) {
                if (!Number.isInteger(concurrentRequests) || concurrentRequests <= 0) {
                    result.errors.push(`concurrentRequests must be a positive integer, got: ${concurrentRequests}`);
                }
                else if (concurrentRequests > 20) {
                    result.warnings.push(`concurrentRequests ${concurrentRequests} is very high, may overload RPC providers`);
                }
            }
        }
    }
    validateEnvironmentVariables(result) {
        // Check for common environment variable mistakes
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith('RPC_') && key.endsWith('_KEY')) {
                const provider = key.slice(4, -4).toLowerCase();
                if (!this.knownProviders.has(provider)) {
                    const suggestion = this.suggestProvider(provider);
                    result.warnings.push(`Environment variable '${key}' references unknown provider '${provider}'${suggestion ? `. Did you mean 'RPC_${suggestion.toUpperCase()}_KEY'?` : ''}`);
                }
            }
            // Common typos in environment variables
            if (key.startsWith('MONITOR_') && key.endsWith('_PROVIDERS')) {
                const chain = key.slice(8, -10).toLowerCase().replace('_', '-');
                if (!this.knownChains.has(chain)) {
                    const suggestion = this.suggestChain(chain);
                    if (suggestion) {
                        const correctedVar = `MONITOR_${suggestion.toUpperCase().replace('-', '_')}_PROVIDERS`;
                        result.warnings.push(`Environment variable '${key}' references unknown chain '${chain}'. Did you mean '${correctedVar}'?`);
                    }
                }
            }
        }
    }
    validateRequestedChains(requestedChains, rpcConfig, result) {
        const availableProviders = Object.keys(rpcConfig.apiKeys || {});
        for (const chain of requestedChains) {
            if (!this.knownChains.has(chain)) {
                const suggestion = this.suggestChain(chain);
                result.errors.push(`Unknown chain '${chain}'${suggestion ? `. Did you mean '${suggestion}'?` : ''}`);
                continue;
            }
            // Check if chain has any available providers
            const chainProviders = this.getProvidersForChain(chain);
            const hasProviders = chainProviders.some(provider => availableProviders.includes(provider));
            if (!hasProviders) {
                const requiredProviders = chainProviders.slice(0, 3).join(', ');
                result.errors.push(`No API keys available for chain '${chain}'. Required providers: ${requiredProviders}`);
                result.suggestions.push(`Add API keys: ${chainProviders.slice(0, 2).map(p => `RPC_${p.toUpperCase()}_KEY`).join(', ')}`);
            }
        }
    }
    provideSuggestions(config, result) {
        const apiKeys = Object.keys(config.rpc?.apiKeys || {});
        // Suggest adding more providers for redundancy
        if (apiKeys.length === 1) {
            result.suggestions.push('Consider adding a second RPC provider for redundancy (e.g., both Alchemy and Infura)');
        }
        // Suggest using premium providers
        const hasOnlyPublicProviders = apiKeys.length === 0;
        if (hasOnlyPublicProviders) {
            result.suggestions.push('Consider adding API keys for premium providers (Alchemy, Infura) for better reliability and rate limits');
        }
        // Suggest configuration file for complex setups
        const hasComplexConfig = (config.rpc?.chains && Object.keys(config.rpc.chains).length > 2);
        if (hasComplexConfig && !process.env.MONITOR_CONFIG_FILE) {
            result.suggestions.push('Consider using a configuration file (MONITOR_CONFIG_FILE) for complex multi-chain setups');
        }
    }
    suggestProvider(provider) {
        const providers = Array.from(this.knownProviders);
        return this.findClosestMatch(provider, providers);
    }
    suggestChain(chain) {
        const chains = Array.from(this.knownChains);
        return this.findClosestMatch(chain, chains);
    }
    findClosestMatch(input, options) {
        let bestMatch = null;
        let bestScore = 0;
        for (const option of options) {
            const score = this.calculateSimilarity(input.toLowerCase(), option.toLowerCase());
            if (score > bestScore && score > 0.6) {
                bestScore = score;
                bestMatch = option;
            }
        }
        return bestMatch;
    }
    calculateSimilarity(a, b) {
        if (a === b)
            return 1;
        if (a.length === 0 || b.length === 0)
            return 0;
        // Simple Levenshtein distance-based similarity
        const matrix = Array(a.length + 1).fill(0).map(() => Array(b.length + 1).fill(0));
        for (let i = 0; i <= a.length; i++)
            matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++)
            matrix[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                const row = matrix[i];
                const prevRow = matrix[i - 1];
                row[j] = Math.min(prevRow[j] + 1, row[j - 1] + 1, prevRow[j - 1] + cost);
            }
        }
        const maxLength = Math.max(a.length, b.length);
        return 1 - matrix[a.length][b.length] / maxLength;
    }
    getProvidersForChain(chain) {
        // Map chains to their typical providers
        const chainProviders = {
            'ethereum-mainnet': ['alchemy', 'infura', 'ankr', 'publicnode'],
            'ethereum-sepolia': ['alchemy', 'infura', 'ankr', 'publicnode'],
            'polygon-mainnet': ['alchemy', 'infura', 'ankr', 'publicnode'],
            'polygon-amoy': ['alchemy', 'ankr', 'publicnode'],
            'tron-mainnet': ['trongrid'],
            'tron-nile': ['trongrid']
        };
        return chainProviders[chain] || [];
    }
    logValidationResults(result) {
        if (result.errors && result.errors.length > 0) {
            this.logger.error('Configuration validation failed:', result.errors);
        }
        if (result.warnings && result.warnings.length > 0) {
            this.logger.warn('Configuration warnings:', result.warnings);
        }
        if (result.suggestions && result.suggestions.length > 0) {
            this.logger.info('Configuration suggestions:', result.suggestions);
        }
    }
}
/**
 * Convenience function to validate configuration
 */
export function validateConfig(config, requestedChains) {
    const validator = new ConfigValidator();
    return validator.validateConfig(config, requestedChains);
}
//# sourceMappingURL=config-validator.js.map