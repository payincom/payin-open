import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { readFileSync } from 'fs';
import YAML from 'yaml';
import { createAuthMiddleware, isSuperAdmin } from '@payin/auth';
import type { UserPublic } from '@payin/auth';
import { getAuth } from '../auth-instance.js';
import { getManager, getManagerYamlPath } from '../manager-instance.js';
import { interpolateEnvVars } from '../config.js';

const diagnostics = new Hono();

const authMiddleware = () => {
  return async (c: Context, next: Next) => {
    const middleware = createAuthMiddleware(getAuth());
    return await middleware(c, next);
  };
};

async function buildMonitorDiagnostics(monitorConfig: any) {
  try {
    const monitorModule = await import('@payin/monitor');
    const { loadMonitorConfig, validateConfig, RPCConfigBuilder } = monitorModule;

    const requestedChains: string[] = Array.isArray(monitorConfig?.chains) ? monitorConfig.chains : [];
    const apiKeys: Record<string, string> = monitorConfig?.rpcKeys ?? {};
    const customProviders = monitorConfig?.customProviders ?? {};
    const runtimeOverrides = {
      rpc: {
        apiKeys,
        chains: monitorConfig?.rpc?.chains ?? {},
        providers: customProviders
      }
    };

    const loadedConfig = await loadMonitorConfig(undefined, runtimeOverrides);
    const validation = validateConfig(loadedConfig, requestedChains);

    const builder = new RPCConfigBuilder({
      apiKeys,
      customProviders,
      configOverrides: runtimeOverrides
    });

    let buildError: string | null = null;
    try {
      if (requestedChains.length > 0) {
        await builder.buildForChains(requestedChains);
      }
    } catch (error) {
      buildError = error instanceof Error ? error.message : String(error);
    }

    const skippedProviders = builder.getSkippedProviders();
    const unresolvedApiKeys = Object.entries(apiKeys)
      .filter(([, value]) => typeof value === 'string' && /\$\{[^}]+\}/.test(value as string))
      .map(([key, value]) => ({ key, value }));

    return {
      requestedChains,
      skippedProviders,
      unresolvedApiKeys,
      validation,
      buildError
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error building monitor diagnostics'
    };
  }
}

diagnostics.get('/', authMiddleware(), async (c) => {
  const user = c.get('user') as UserPublic | undefined;
  if (!user || !isSuperAdmin(user)) {
    return c.json({
      success: false,
      error: 'forbidden',
      message: 'Super admin privileges required'
    }, 403);
  }

  try {
    const manager = getManager();
    const runtimeConfig = await manager.getRuntimeConfig();
    const yamlPath = getManagerYamlPath();
    let managerYamlConfig: any = null;

    if (yamlPath) {
      try {
        const managerYamlContent = readFileSync(yamlPath, 'utf-8');
        const parsedYaml = YAML.parse(managerYamlContent);
        managerYamlConfig = interpolateEnvVars(parsedYaml);
      } catch (readError) {
        console.error('Failed to read manager YAML for diagnostics:', readError);
      }
    }

    const monitorDiagnostics = managerYamlConfig?.monitor
      ? await buildMonitorDiagnostics(managerYamlConfig.monitor)
      : null;

    const sanitizedMonitorConfig = managerYamlConfig?.monitor
      ? {
          ...managerYamlConfig.monitor,
          rpcKeys: Object.fromEntries(
            Object.entries(managerYamlConfig.monitor.rpcKeys ?? {}).map(([key, value]) => {
              if (typeof value === 'string') {
                if (/\$\{[^}]+\}/.test(value)) {
                  return [key, value];
                }
                return [key, '[configured]'];
              }
              return [key, value];
            })
          )
        }
      : null;

    return c.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV || 'development',
        managerConfigFile: yamlPath,
        runtimeConfig,
        managerMonitorConfig: sanitizedMonitorConfig,
        monitorDiagnostics
      }
    });
  } catch (error) {
    console.error('Failed to build configuration diagnostics:', error);
    return c.json({
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default diagnostics;
