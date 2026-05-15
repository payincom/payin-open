/**
 * Configuration Transformer
 * Transforms config_values (Manager format) to ProcessorConfig (Processor format)
 *
 * This transformer now only handles business/operational parameters.
 * Technical configurations (chains, tokens, confirmations) are managed in Processor YAML.
 */

import type { SystemSetting } from '../types.js';

/**
 * Transform config_values into Processor configuration structure
 *
 * @param configValues - Array of system settings from config_values table
 * @returns ProcessorConfig object ready for Processor.create()
 *
 * Note: chains, tokens, and confirmations are no longer managed here.
 * They should be configured in processor/config/default.yaml
 */
export async function transformToProcessorConfig(
  configValues: SystemSetting[]
): Promise<any> {
  // Create a map for quick lookup
  const valueMap = new Map<string, any>();
  for (const setting of configValues) {
    valueMap.set(setting.key, setting.value);
  }

  const config: any = {};

  // ========== 1. Transform services.* → services.* ==========
  config.services = {
    orders: valueMap.get('services.orders_enabled'),
    deposits: valueMap.get('services.deposits_enabled'),
  };

  // ========== 2. Transform orders.* → orders.default* ==========
  config.orders = {
    defaultPaymentWindowMinutes: valueMap.get('orders.payment_window_minutes'),
    defaultGracePeriodMinutes: valueMap.get('orders.grace_period_minutes'),
    maxTotalTimeoutMinutes: valueMap.get('orders.max_total_timeout_minutes'),
  };

  // ========== 3. Transform address_pool.* → deposits.poolManagement.* ==========
  config.deposits = {
    poolManagement: {
      defaultCooldownMinutes: valueMap.get('address_pool.cooldown_minutes'),
    }
  };

  // ========== 4. Transform delayed_confirmation.* → delayedConfirmation.* ==========
  // Note: check_interval is stored in seconds in DB, but Processor expects milliseconds
  const checkIntervalSeconds = valueMap.get('delayed_confirmation.check_interval');
  config.delayedConfirmation = {
    checkInterval: checkIntervalSeconds ? checkIntervalSeconds * 1000 : undefined,
  };

  return config;
}
