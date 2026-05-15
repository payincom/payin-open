/**
 * Config Provider Adapter
 *
 * Provides a secure, minimal interface for Processor to access configuration
 * without exposing Manager's full API surface.
 *
 * This adapter implements the Principle of Least Privilege by only exposing
 * the getConfig method, preventing Processor from modifying configuration
 * or accessing other Manager functionality.
 */

import type { ConfigProvider } from '@payin/shared';
import type { ConfigurationManager } from './manager.js';

export class ConfigProviderAdapter implements ConfigProvider {
  constructor(private readonly manager: ConfigurationManager) {}

  /**
   * Get configuration value with organization isolation
   *
   * Delegates to Manager's getConfig method, which implements the full
   * priority chain:
   * 1. Organization-level config
   * 2. Global config_values
   * 3. config_metadata default_value
   */
  async getConfig(key: string, organizationId?: string): Promise<any | undefined> {
    return this.manager.getConfig(key, organizationId);
  }
}
