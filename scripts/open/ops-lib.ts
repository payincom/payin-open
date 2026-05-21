export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface OpenOpsCheck {
  id: string;
  status: CheckStatus;
  message: string;
  detail?: string;
  suggestion?: string;
}

export interface OpenOpsSummary {
  ok: boolean;
  checks: OpenOpsCheck[];
  runtime?: string;
  mode?: string;
  database?: OpenDatabaseCheckSummary;
}

export interface OpenDatabaseCheckSummary {
  configured: boolean;
  reachable?: boolean;
  schemaComplete?: boolean;
  missingTables?: string[];
  existingTables?: string[];
  defaultMerchantExists?: boolean;
  defaultMerchantId?: string;
}

export interface RuntimeEnv {
  [key: string]: string | undefined;
}

export const DEFAULT_OPEN_MERCHANT_SCOPE_ID = '00000000-0000-0000-0000-000000000001';

export function redactConnectionString(value: string): string {
  return value.replace(/:[^:@/]+@/, ':****@');
}

export function resolveOpenRuntime(env: RuntimeEnv = process.env): string {
  return (env.PAYIN_RUNTIME || env.PAYIN_EDITION || 'open').toLowerCase();
}

export function isOpenRuntime(env: RuntimeEnv = process.env): boolean {
  const runtime = resolveOpenRuntime(env);
  return runtime === 'open' || runtime === 'payin-open';
}

export function resolveOpenMerchantScopeId(env: RuntimeEnv = process.env): string {
  return env.PAYIN_OPEN_ORGANIZATION_ID || DEFAULT_OPEN_MERCHANT_SCOPE_ID;
}

export function collectOpenRuntimePostureChecks(options: {
  env?: RuntimeEnv;
  defaultMerchantId?: string;
} = {}): OpenOpsCheck[] {
  const env = options.env ?? process.env;
  const defaultMerchantId = options.defaultMerchantId ?? resolveOpenMerchantScopeId(env);

  return [
    {
      id: 'runtime.profile',
      status: isOpenRuntime(env) ? 'pass' : 'fail',
      message: isOpenRuntime(env)
        ? `Open profile is single-tenant self-hosted with default local merchant scope ${defaultMerchantId}.`
        : 'Open profile is not active; single-tenant self-hosted assumptions do not apply.',
      suggestion: 'Set PAYIN_RUNTIME=open before running Open self-hosted operations.',
    },
    {
      id: 'auth.api-key-scope',
      status: 'pass',
      message: 'Business API key calls use the key-bound merchant scope; do not send X-Organization-ID.',
    },
    {
      id: 'auth.jwt-operator-caveat',
      status: 'pass',
      message: 'JWT operator calls must still prove local operator membership for the Open merchant scope.',
      detail: `Use X-Organization-Id: ${defaultMerchantId} with JWT operator requests until switching to a business API key.`,
    },
    {
      id: 'admin.production-posture',
      status: 'pass',
      message: 'No default production admin promotion is performed; only first local operator/bootstrap is supported.',
    },
  ];
}

export function collectOpenDoctorChecks(options: {
  env?: RuntimeEnv;
  fileExists?: (path: string) => boolean;
  strict?: boolean;
  mode?: string;
} = {}): OpenOpsSummary {
  const env = options.env ?? process.env;
  const fileExists = options.fileExists ?? (() => true);
  const checks: OpenOpsCheck[] = [];
  const strict = options.strict ?? false;

  checks.push(...collectOpenRuntimePostureChecks({ env }));

  checks.push({
    id: 'runtime.open',
    status: isOpenRuntime(env) ? 'pass' : 'fail',
    message: isOpenRuntime(env)
      ? `Runtime is ${resolveOpenRuntime(env)}.`
      : `Runtime is ${resolveOpenRuntime(env)}, not open.`,
    suggestion: 'Set PAYIN_RUNTIME=open for PayIn Open self-hosted operation.',
  });

  const db = env.DB_CONNECTION_STRING;
  checks.push({
    id: 'database.connection',
    status: db ? 'pass' : strict ? 'fail' : 'warn',
    message: db
      ? `DB_CONNECTION_STRING is set (${redactConnectionString(db)}).`
      : 'DB_CONNECTION_STRING is not set; database-backed operations cannot run yet.',
    suggestion: 'Set DB_CONNECTION_STRING=postgresql://user:password@host:5432/database before open:init or runtime startup.',
  });

  const requiredFiles = [
    'package.json',
    'scripts/init-database.ts',
    'scripts/open/open-init.ts',
    'scripts/open/open-doctor.ts',
    'scripts/open/open-smoke.ts',
    'skills/payin-open/SKILL.md',
    'docs/self-hosting/README.md',
    'docs/reference/open-processor-facade.md',
  ];

  for (const path of requiredFiles) {
    const exists = fileExists(path);
    checks.push({
      id: `file.${path}`,
      status: exists ? 'pass' : 'fail',
      message: exists ? `${path} exists.` : `${path} is missing.`,
      suggestion: exists ? undefined : `Restore ${path}; it is required for Agent-operated PayIn Open.`,
    });
  }

  const secretWarnings = ['JWT_SECRET', 'WEBHOOK_SECRET'].filter((key) => !env[key]);
  checks.push({
    id: 'secrets.local',
    status: secretWarnings.length === 0 ? 'pass' : 'warn',
    message: secretWarnings.length === 0
      ? 'Core local secrets are configured.'
      : `Missing optional local secret(s): ${secretWarnings.join(', ')}.`,
    suggestion: 'Set strong secrets before production/mainnet. Do not commit .env files.',
  });

  return {
    ok: checks.every((check) => check.status !== 'fail'),
    checks,
    runtime: resolveOpenRuntime(env),
    mode: options.mode,
  };
}

export async function collectOpenDatabaseChecks(options: {
  connectionString?: string;
  defaultMerchantId: string;
  strict?: boolean;
  databaseFactory?: (connectionString: string) => {
    initialize(): Promise<void>;
    checkDatabaseSchema(): Promise<{
      isComplete: boolean;
      missingTables: string[];
      existingTables: string[];
      requiredTables: string[];
    }>;
    query(sql: string, params?: any[]): Promise<any[]>;
    close(): Promise<void>;
  };
}): Promise<{ summary: OpenDatabaseCheckSummary; checks: OpenOpsCheck[] }> {
  const checks: OpenOpsCheck[] = [];
  const connectionString = options.connectionString;
  const strict = options.strict ?? false;

  if (!connectionString) {
    return {
      summary: { configured: false, defaultMerchantId: options.defaultMerchantId },
      checks: [{
        id: 'database.live-check',
        status: strict ? 'fail' : 'warn',
        message: 'DB_CONNECTION_STRING is not set; live schema/default merchant checks were skipped.',
        suggestion: 'Set DB_CONNECTION_STRING and rerun open:init -- --check --strict before a real deployment.',
      }],
    };
  }

  const database = options.databaseFactory
    ? options.databaseFactory(connectionString)
    : new (await import('@payin/processor')).PostgreSQLDatabase(connectionString);

  try {
    await database.initialize();
    checks.push({ id: 'database.reachable', status: 'pass', message: 'Database connection succeeded.' });

    const schema = await database.checkDatabaseSchema();
    checks.push({
      id: 'database.schema',
      status: schema.isComplete ? 'pass' : 'fail',
      message: schema.isComplete
        ? `Database schema is complete (${schema.existingTables.length} required tables found).`
        : `Database schema is incomplete; missing tables: ${schema.missingTables.join(', ')}.`,
      suggestion: schema.isComplete ? undefined : 'Run npm run open:init against the target database.',
    });

    const merchantRows = await database.query('SELECT id FROM organizations WHERE id = $1 LIMIT 1', [options.defaultMerchantId]);
    const defaultMerchantExists = merchantRows.length > 0;
    checks.push({
      id: 'database.default-merchant',
      status: defaultMerchantExists ? 'pass' : 'fail',
      message: defaultMerchantExists
        ? `PayIn Open default merchant scope exists (${options.defaultMerchantId}).`
        : `PayIn Open default merchant scope is missing (${options.defaultMerchantId}).`,
      suggestion: defaultMerchantExists ? undefined : 'Run npm run open:init to create the Open default merchant scope.',
    });

    return {
      summary: {
        configured: true,
        reachable: true,
        schemaComplete: schema.isComplete,
        missingTables: schema.missingTables,
        existingTables: schema.existingTables,
        defaultMerchantExists,
        defaultMerchantId: options.defaultMerchantId,
      },
      checks,
    };
  } catch (error) {
    checks.push({
      id: 'database.reachable',
      status: 'fail',
      message: `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Verify DB_CONNECTION_STRING, network access, credentials, and that the database exists.',
    });
    return {
      summary: {
        configured: true,
        reachable: false,
        defaultMerchantId: options.defaultMerchantId,
      },
      checks,
    };
  } finally {
    await database.close().catch(() => undefined);
  }
}

export function formatChecks(title: string, summary: OpenOpsSummary): string {
  const icon: Record<CheckStatus, string> = { pass: '✅', warn: '⚠️', fail: '❌' };
  const lines = [title, ''];
  for (const check of summary.checks) {
    lines.push(`${icon[check.status]} ${check.id}: ${check.message}`);
    if (check.status !== 'pass' && check.suggestion) {
      lines.push(`   → ${check.suggestion}`);
    }
    if (check.detail) {
      lines.push(`   ${check.detail}`);
    }
  }
  lines.push('');
  lines.push(summary.ok ? 'Result: ready for the next Open operation.' : 'Result: blocked; fix failed checks first.');
  return lines.join('\n');
}

export interface SmokeAuthOptions {
  apiKey?: string;
  bearerToken?: string;
}

export interface SmokeOrderOptions {
  orderReference?: string;
  amount?: string;
  currency?: string;
  chainId?: string;
}

export function buildAuthHeaders(options: SmokeAuthOptions): Record<string, string> {
  if (options.bearerToken) return { Authorization: `Bearer ${options.bearerToken}` };
  if (options.apiKey) return { Authorization: `Bearer ${options.apiKey}`, 'X-API-Key': options.apiKey };
  return {};
}

export function hasLiveAuth(options: SmokeAuthOptions): boolean {
  return Object.keys(buildAuthHeaders(options)).length > 0;
}

export function buildSmokeOrderPayload(options: SmokeOrderOptions = {}): Record<string, unknown> {
  return {
    orderReference: options.orderReference ?? `open-smoke-${Date.now()}`,
    amount: options.amount ?? '1.00',
    currency: options.currency ?? 'USDC',
    chainId: options.chainId ?? 'ethereum-sepolia',
    metadata: {
      source: 'payin-open-smoke',
      title: 'PayIn Open Smoke Test Order',
    },
  };
}

export function extractOrderId(responseBody: any): string | undefined {
  return responseBody?.data?.orderId ?? responseBody?.data?.id ?? responseBody?.orderId ?? responseBody?.id;
}

export function extractPaymentUrl(responseBody: any, baseUrl: string, orderId?: string): string | undefined {
  const url = responseBody?.data?.url ?? responseBody?.data?.paymentUrl ?? responseBody?.url ?? responseBody?.paymentUrl;
  if (typeof url === 'string' && url.length > 0) return url;
  return orderId ? `${baseUrl.replace(/\/$/, '')}/pay/order/${orderId}` : undefined;
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHttpEndpoint(url: string, timeoutMs = 5000, init: RequestInit = {}): Promise<OpenOpsCheck> {
  try {
    const response = await fetchWithTimeout(url, init, timeoutMs);
    return {
      id: `http.${url}`,
      status: response.ok ? 'pass' : 'fail',
      message: `${url} returned HTTP ${response.status}.`,
      suggestion: response.ok ? undefined : 'Check API logs, DB connectivity, and service startup configuration.',
    };
  } catch (error) {
    return {
      id: `http.${url}`,
      status: 'fail',
      message: `${url} is not reachable: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Start the PayIn Open API service, then rerun open:smoke with --url.',
    };
  }
}
