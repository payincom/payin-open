/**
 * Configuration Helper Functions
 * Temporary helpers until Manager methods are available
 */

import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import type { ConfigurationManager } from '@payin/manager';

/**
 * Get Manager YAML configuration
 * Reads directly from file system
 */
export async function getManagerYamlConfig(yamlPath?: string): Promise<any> {
  if (!yamlPath) {
    return { configMetadata: [] };
  }

  try {
    const content = readFileSync(yamlPath, 'utf-8');
    return parseYaml(content);
  } catch (error) {
    console.warn(`Failed to load Manager YAML config from ${yamlPath}:`, error);
    return { configMetadata: [] };
  }
}

/**
 * Get Processor default configuration
 * Uses Processor's config loader
 */
export async function getProcessorDefaultConfig(): Promise<any> {
  try {
    // Load via Processor package re-export to stay within supported API surface
    const { loadConfig } = await import('@payin/processor');
    return await loadConfig();
  } catch (error) {
    console.warn('Failed to load Processor default config:', error);
    return {};
  }
}

/**
 * Get Monitor default configuration
 */
export async function getMonitorDefaultConfig(): Promise<any> {
  try {
    const { loadMonitorConfig } = await import('@payin/monitor');
    return await loadMonitorConfig();
  } catch (error) {
    console.warn('Failed to load Monitor default config:', error);
    return {};
  }
}

/**
 * Get complete runtime configuration
 */
export async function getRuntimeConfig(manager: ConfigurationManager, yamlPath?: string): Promise<{
  source: string;
  timestamp: string;
  layers: {
    monitor: any;
    processor: any;
    manager: any;
    database: any;
  };
  merged: any;
}> {
  const timestamp = new Date().toISOString();

  // Get all configuration layers
  const [monitor, processor, managerYaml, database] = await Promise.all([
    getMonitorDefaultConfig(),
    getProcessorDefaultConfig(),
    getManagerYamlConfig(yamlPath),
    manager.listSystemSettings()
  ]);

  // Build merged configuration
  const merged = {
    database: {
      connectionString: maskConnectionString(manager.getConnectionString())
    },
    ...processor,
    monitor,
    _databaseOverrides: database
  };

  return {
    source: 'merged',
    timestamp,
    layers: {
      monitor,
      processor,
      manager: managerYaml,
      database
    },
    merged
  };
}

/**
 * Mask sensitive information in connection string
 */
export function maskConnectionString(connStr: string): string {
  return connStr.replace(/:[^:@]+@/, ':****@');
}

/**
 * Get config metadata from database
 */
export async function getConfigMetadata(manager: ConfigurationManager, key: string): Promise<any | null> {
  const pool = (manager as any).db; // Access private db pool
  const result = await pool.query(
    'SELECT * FROM config_metadata WHERE key = $1',
    [key]
  );

  const rows = result.rows || result; // Handle both pg Pool and direct query results
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    key: row.key,
    category: row.category,
    dataType: row.data_type,
    defaultValue: row.default_value,
    validationRules: row.validation_rules,
    description: row.description
  };
}

/**
 * List all configuration metadata
 */
export async function listConfigMetadata(
  manager: ConfigurationManager,
  filters: {
    category?: 'business_rules' | 'address_pool' | 'chain_operations' | 'service_switches';
  } = {}
): Promise<any[]> {
  const pool = (manager as any).db; // Access private db pool

  let query = 'SELECT * FROM config_metadata';
  const params: any[] = [];

  if (filters.category) {
    query += ' WHERE category = $1';
    params.push(filters.category);
  }

  query += ' ORDER BY category, key';

  const result = await pool.query(query, params);
  const rows = result.rows || result; // Handle both pg Pool and direct query results

  return rows.map((row: any) => ({
    key: row.key,
    category: row.category,
    dataType: row.data_type,
    defaultValue: row.default_value,
    validationRules: row.validation_rules,
    description: row.description
  }));
}
