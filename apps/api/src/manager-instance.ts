/**
 * Manager Instance Singleton
 * Provides global access to ConfigurationManager instance
 */

import { ConfigurationManager } from '@payin/manager';
import { loadAppConfig, resolveManagerConfigPath } from './config.js';

/**
 * Global Manager instance
 */
let managerInstance: ConfigurationManager | null = null;
let managerYamlPath: string | null = null;

/**
 * Initialize Manager instance
 * This should be called once during application startup
 */
export async function initializeManager(): Promise<ConfigurationManager> {
  if (managerInstance) {
    console.log('⚠️  Manager already initialized, returning existing instance');
    return managerInstance;
  }

  console.log('🚀 Initializing ConfigurationManager...');

  // Load application configuration
  const appConfig = loadAppConfig();
  const managerConfigPath = resolveManagerConfigPath(appConfig.managerConfigFile);

  console.log(`📁 Manager config file: ${managerConfigPath}`);
  console.log(`🗄️  Database: ${appConfig.database.connectionString.replace(/:[^:@]+@/, ':****@')}`);

  // Store YAML path for later use
  managerYamlPath = managerConfigPath;

  // Create Manager instance
  managerInstance = new ConfigurationManager({
    connectionString: appConfig.database.connectionString,
    yamlPath: managerConfigPath,
    autoInit: false // Don't auto-initialize, we'll do it manually if needed
  });

  // Initialize Manager (creates schema if INIT_DB=true)
  await managerInstance.initialize();

  console.log('✅ ConfigurationManager initialized');

  return managerInstance;
}

/**
 * Get Manager instance
 * Throws error if Manager not initialized
 */
export function getManager(): ConfigurationManager {
  if (!managerInstance) {
    throw new Error('Manager not initialized. Call initializeManager() first.');
  }
  return managerInstance;
}

/**
 * Get Manager YAML configuration file path
 */
export function getManagerYamlPath(): string | null {
  return managerYamlPath;
}

/**
 * Shutdown Manager instance
 * Closes database connections and stops Processor if running
 */
export async function shutdownManager(): Promise<void> {
  if (managerInstance) {
    console.log('🛑 Shutting down Manager...');
    await managerInstance.close();
    managerInstance = null;
    console.log('✅ Manager shutdown complete');
  }
}
