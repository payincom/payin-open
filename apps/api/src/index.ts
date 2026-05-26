/**
 * PayIn Web Server Entry Point
 * Initializes Manager, starts Processor, and launches HTTP server
 */

import { serve } from '@hono/node-server';
import { loadAppConfig, interpolateEnvVars } from './config.js';
import { initializeManager, shutdownManager } from './manager-instance.js';
import { initializeAuth, shutdownAuth } from './auth-instance.js';
import { createApp } from './server.js';
import { loadRootEnv } from '@payin/shared';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envLoad = loadRootEnv(['.env'], {
  rootDir: resolve(__dirname, '..'),
  override: false
});

if (process.env.NODE_ENV !== 'production') {
  console.log('Loaded env files:', envLoad.loaded);
}

/**
 * Main application entry point
 */
async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  PayIn Web Server');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Load configuration
    const config = loadAppConfig();

    // Initialize Auth
    // Note: Database schema should be initialized separately using scripts/init-database.ts
    // This ensures clean separation between deployment and runtime
    await initializeAuth();

    // Initialize Manager
    const manager = await initializeManager();

    // Start Processor via Manager
    try {
      console.log('🚀 Starting Processor via Manager...');

      // Load Manager YAML to get monitor config
      const { readFileSync } = await import('fs');
      const YAML = await import('yaml');
      const { resolveManagerConfigPath } = await import('./config.js');

      const managerConfigPath = resolveManagerConfigPath(config.managerConfigFile);
      const managerYamlContent = readFileSync(managerConfigPath, 'utf-8');
      const managerConfigRaw = YAML.parse(managerYamlContent);
      const managerConfig = interpolateEnvVars(managerConfigRaw);

      // Start Processor through Manager (Manager creates and manages Processor)
      // Pass processorConfigFile to load environment-specific chains/tokens
      await manager.startProcessor({
        monitor: managerConfig.monitor,
        processorConfigFile: managerConfig.processor?.configFile
      });

      console.log('✅ Processor started successfully via Manager');
    } catch (error) {
      console.log('⚠️  Failed to start Processor:', error instanceof Error ? error.message : error);
      console.log('   Continuing without Processor for now...');
    }

    // Create Hono app
    const app = createApp();

    // Start HTTP server
    console.log('');
    console.log(`🌐 Starting HTTP server on ${config.server.host}:${config.server.port}...`);

    serve({
      fetch: app.fetch,
      port: config.server.port,
      hostname: config.server.host
    });

    console.log('');
    console.log('✅ Server is running!');
    console.log('');
    console.log(`   Health check: http://localhost:${config.server.port}/health`);
    console.log(`   API base URL: http://localhost:${config.server.port}/api/v1`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Failed to start server:', error);
    console.error('');
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string) {
  console.log('');
  console.log(`\n📡 Received ${signal}, shutting down gracefully...`);

  try {
    await shutdownManager();
    await shutdownAuth();
    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the application
main();

