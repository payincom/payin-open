/**
 * Configuration Loader
 * Loads and merges configuration from multiple sources
 *
 * Loading priority (low to high):
 * 1. Default config file (config/default.yaml)
 * 2. Custom config file (if provided via configFile parameter)
 * 3. Runtime configuration (handled by ProcessorConfigManager - highest priority)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';
import type { ProcessorConfig } from './processor-config-manager.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration loader options
 */
export interface ConfigLoaderOptions {
  /** Custom config file path (absolute or relative to configDir) */
  configFile?: string;
  /** Base directory for config files (defaults to packages/processor/config) */
  configDir?: string;
}

/**
 * Deep merge two objects
 * Later object properties override earlier ones
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      const sourceValue = (source as any)[key];
      const targetValue = (output as any)[key];

      if (isObject(sourceValue) && isObject(targetValue)) {
        (output as any)[key] = deepMerge(targetValue, sourceValue);
      } else if (sourceValue !== undefined) {
        (output as any)[key] = sourceValue;
      }
    });
  }

  return output;
}

/**
 * Check if value is a plain object
 */
export function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Configuration loader class
 */
export class ConfigLoader {
  private readonly configDir: string;
  private readonly configFile?: string;

  constructor(options: ConfigLoaderOptions = {}) {
    // Determine config directory
    // Use module-relative path to find config directory, ensuring it works regardless of cwd
    // Current file is in src/core/, config is in ../../config relative to this file
    const defaultConfigDir = path.resolve(__dirname, '../../config');
    this.configDir = options.configDir || defaultConfigDir;
    this.configFile = options.configFile;
  }

  /**
   * Load configuration from all sources
   * Priority (low to high):
   * 1. Default config file (config/default.yaml)
   * 2. Custom config file (if provided)
   */
  async load(): Promise<Partial<ProcessorConfig>> {
    let config: Partial<ProcessorConfig> = {};

    // 1. Load default config
    const defaultConfig = await this.loadConfigFile('default.yaml');
    if (defaultConfig) {
      config = deepMerge(config, defaultConfig);
    }

    // 2. Load custom config (if provided)
    if (this.configFile) {
      const customConfig = await this.loadConfigFile(this.configFile);
      if (customConfig) {
        // Deep merge most properties, but shallow merge chains and tokens
        // This allows environment-specific configs to completely replace chains/tokens
        config = deepMerge(config, customConfig);

        // Override chains and tokens with shallow merge (complete replacement)
        if (customConfig.chains) {
          config.chains = customConfig.chains;
        }
        if (customConfig.tokens) {
          config.tokens = customConfig.tokens;
        }
      }
    }

    return config;
  }

  /**
   * Load a single config file
   */
  private async loadConfigFile(filename: string): Promise<Partial<ProcessorConfig> | null> {
    // If filename is absolute path, use it directly; otherwise resolve relative to configDir
    const filePath = path.isAbsolute(filename)
      ? filename
      : path.join(this.configDir, filename);

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        // Only warn for custom files
        if (filename !== 'default.yaml') {
          console.warn(`Custom config file not found: ${filePath}`);
        }
        return null;
      }

      // Read file
      const fileContent = fs.readFileSync(filePath, 'utf8');

      // Parse YAML
      const config = yaml.load(fileContent) as Partial<ProcessorConfig>;

      console.log(`✅ Loaded config from: ${filename}`);
      return config;
    } catch (error) {
      console.error(`Failed to load config file ${filename}:`, error);
      return null;
    }
  }

  /**
   * Get the config directory
   */
  getConfigDir(): string {
    return this.configDir;
  }
}

/**
 * Load configuration using default loader
 */
export async function loadConfig(options?: ConfigLoaderOptions): Promise<Partial<ProcessorConfig>> {
  const loader = new ConfigLoader(options);
  return await loader.load();
}