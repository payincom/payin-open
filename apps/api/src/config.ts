/**
 * Application Configuration Loader
 * Loads and validates configuration from YAML file
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Application configuration interface
 */
export interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  database: {
    connectionString: string;
  };
  managerConfigFile: string;
  processor?: {
    orders?: {
      paymentWindow?: number;
      gracePeriod?: number;
    };
    deposits?: {
      cooldownPeriod?: number;
    };
  };
}

/**
 * Replace environment variables in a string
 * Supports ${VAR_NAME} and ${VAR_NAME:-default} syntax
 */
function replaceEnvVars(value: string): string {
  return value.replace(/\$\{([^}:]+)(:-([^}]*))?\}/g, (match, varName, _, defaultValue) => {
    const envValue = process.env[varName];
    if (envValue !== undefined) {
      return envValue;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return match;
  });
}

/**
 * Recursively replace environment variables in configuration object
 */
export function interpolateEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    return replaceEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => interpolateEnvVars(item));
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateEnvVars(value);
    }
    return result;
  }
  return obj;
}

/**
 * Determine manager config file name based on NODE_ENV
 * Maps environment to network config file:
 * - development → manager.testnet.yaml (local development uses testnets)
 * - sandbox → manager.testnet.yaml (customer integration testing with test coins)
 * - test → manager.testnet.yaml (internal testing uses testnets)
 * - production → manager.mainnet.yaml (production uses mainnet)
 * - default → manager.testnet.yaml
 *
 * Override: Set MANAGER_CONFIG_FILE env var to force a specific config file.
 */
function getManagerConfigFileName(): string {
  // Allow explicit override via environment variable
  if (process.env.MANAGER_CONFIG_FILE) {
    return process.env.MANAGER_CONFIG_FILE;
  }

  const env = process.env.NODE_ENV || 'development';
  const configMap: Record<string, string> = {
    development: 'manager.testnet.yaml',
    sandbox: 'manager.testnet.yaml',
    test: 'manager.testnet.yaml',
    production: 'manager.mainnet.yaml'
  };

  return configMap[env] || 'manager.testnet.yaml';
}

/**
 * Load application configuration from YAML file
 * Supports environment variable interpolation and automatic config file selection
 */
export function loadAppConfig(configPath?: string): AppConfig {
  const configFile = configPath || resolve(__dirname, '../config/app.yaml');

  try {
    const fileContent = readFileSync(configFile, 'utf-8');
    let config = YAML.parse(fileContent) as AppConfig;

    // Replace environment variables in config
    config = interpolateEnvVars(config);

    // Auto-select manager config file based on NODE_ENV if not explicitly set
    if (!config.managerConfigFile || config.managerConfigFile === './manager.yaml') {
      config.managerConfigFile = `./${getManagerConfigFileName()}`;
      console.log(`📋 Auto-selected manager config: ${config.managerConfigFile} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
    }

    // Convert port to number if it's a string
    if (typeof config.server?.port === 'string') {
      config.server.port = parseInt(config.server.port, 10);
    }

    // Validate required fields
    if (!config.server?.port) {
      throw new Error('Missing required config: server.port');
    }
    if (!config.database?.connectionString) {
      throw new Error('Missing required config: database.connectionString');
    }
    if (!config.managerConfigFile) {
      throw new Error('Missing required config: managerConfigFile');
    }

    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load app config from ${configFile}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Resolve manager config file path relative to config directory
 */
export function resolveManagerConfigPath(managerConfigFile: string): string {
  const configDir = resolve(__dirname, '../config');
  return resolve(configDir, managerConfigFile);
}
