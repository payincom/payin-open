/**
 * Multi-layer configuration loader for Monitor
 *
 * Loading priority (low to high):
 * 1. Built-in defaults (code)
 * 2. Default config file (config/default.yaml)
 * 3. Custom config file (if provided via configFile parameter)
 * 4. Runtime configuration (constructor params - highest priority)
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as yaml from 'yaml'
import { createLogger, LogCategory } from '@payin/shared'
import type { MonitorConfig } from '../types/index.js'

// Get the directory of the current module (ESM compatibility)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface LoadedConfig {
  rpc?: {
    providers?: Record<string, any>  // Provider templates from YAML or database
    apiKeys?: Record<string, string>
    defaults?: {
      timeout?: number
      maxRetries?: number
      healthCheckInterval?: number
    }
    chainDefaults?: {
      strategy?: 'round_robin' | 'failover' | 'fastest'
      healthCheck?: {
        enabled?: boolean
        interval?: number
        timeout?: number
        maxFailures?: number
      }
      retry?: {
        maxRetries?: number
        backoffMultiplier?: number
        initialDelay?: number
      }
    }
    chains?: Record<string, {
      preferredProviders?: string[]
      excludeProviders?: string[]
      timeout?: number
      weight?: number
      maxRequestsPerSecond?: number
      strategy?: 'round_robin' | 'failover' | 'fastest'
    }>
  }
  monitor?: {
    scanning?: {
      defaultConfirmations?: number
      maxBlockRange?: number
      scanInterval?: number
    }
    events?: {
      maxListeners?: number
      errorRetryInterval?: number
    }
    performance?: {
      enableCache?: boolean
      cacheSize?: number
      concurrentRequests?: number
    }
  }
}

export class MonitorConfigLoader {
  private static instance?: MonitorConfigLoader
  private loadedConfig: LoadedConfig | undefined
  private readonly logger = createLogger(LogCategory.MONITOR)

  static getInstance(): MonitorConfigLoader {
    if (!this.instance) {
      this.instance = new MonitorConfigLoader()
    }
    return this.instance
  }

  async loadConfig(
    configFile?: string,
    runtimeConfig?: Partial<LoadedConfig>
  ): Promise<LoadedConfig> {
    // 1. Start with built-in defaults
    const config = this.getBuiltinDefaults()

    // 2. Merge default config file
    const defaultConfigPath = this.getDefaultConfigPath()
    if (await this.fileExists(defaultConfigPath)) {
      const defaultFileConfig = await this.loadConfigFile(defaultConfigPath)
      this.deepMerge(config, defaultFileConfig)
    } else {
      this.logger.warn(`Default config file not found: ${defaultConfigPath}`)
    }

    // 3. Merge custom config file (if provided)
    if (configFile && await this.fileExists(configFile)) {
      const customFileConfig = await this.loadConfigFile(configFile)
      this.deepMerge(config, customFileConfig)
      this.logger.info(`Loaded custom config file: ${configFile}`)
    }

    // 4. Apply runtime configuration (highest priority)
    if (runtimeConfig) {
      this.deepMerge(config, runtimeConfig)
    }

    this.loadedConfig = config
    return config
  }

  private getBuiltinDefaults(): LoadedConfig {
    return {
      rpc: {
        apiKeys: {},
        defaults: {
          timeout: 5000,
          maxRetries: 3,
          healthCheckInterval: 30000
        },
        chainDefaults: {
          strategy: 'round_robin',
          healthCheck: {
            enabled: true,
            interval: 30000,
            timeout: 5000,
            maxFailures: 3
          },
          retry: {
            maxRetries: 3,
            backoffMultiplier: 1.5,
            initialDelay: 1000
          }
        },
        chains: {}
      },
      monitor: {
        scanning: {
          defaultConfirmations: 3,
          maxBlockRange: 1000,
          scanInterval: 10000
        },
        events: {
          maxListeners: 100,
          errorRetryInterval: 5000
        },
        performance: {
          enableCache: true,
          cacheSize: 1000,
          concurrentRequests: 5
        }
      }
    }
  }

  private getDefaultConfigPath(): string {
    return path.join(__dirname, '../../config/default.yaml')
  }

  private async loadConfigFile(filePath: string): Promise<LoadedConfig> {
    const content = await fs.readFile(filePath, 'utf-8')
    const ext = path.extname(filePath).toLowerCase()

    if (ext === '.yaml' || ext === '.yml') {
      return yaml.parse(content)
    } else if (ext === '.json') {
      return JSON.parse(content)
    } else {
      throw new Error(`Unsupported config file format: ${ext}. Use .yaml, .yml, or .json`)
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = target[key] || {}
        this.deepMerge(target[key], source[key])
      } else {
        target[key] = source[key]
      }
    }
  }

  /**
   * Clear cached configuration (useful for testing)
   */
  clearCache(): void {
    this.loadedConfig = undefined as LoadedConfig | undefined
  }
}

/**
 * Convenience function to load monitor configuration
 */
export async function loadMonitorConfig(
  configFile?: string,
  runtimeConfig?: Partial<LoadedConfig>
): Promise<LoadedConfig> {
  const loader = MonitorConfigLoader.getInstance()
  return loader.loadConfig(configFile, runtimeConfig)
}