import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type RecordedCall = {
  method?: string;
  path: string;
  query: Record<string, string>;
  headers: http.IncomingHttpHeaders;
  body: any;
};

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody) => {
    let raw = '';
    req.on('data', (chunk) => raw += chunk);
    req.on('end', () => {
      if (!raw) return resolveBody(undefined);
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        resolveBody(raw);
      }
    });
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function startMockPayInRuntime() {
  const calls: RecordedCall[] = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;
    const body = await readBody(req);
    calls.push({ method: req.method, path, query: Object.fromEntries(url.searchParams), headers: req.headers, body });

    if (path === '/health') return sendJson(res, 200, { ok: true, runtime: 'open', service: 'PayIn Open' });
    if (path === '/api/chains') return sendJson(res, 200, { data: [{ id: 'ethereum-sepolia', runtime: 'open' }] });
    if (path === '/api/tokens') return sendJson(res, 200, { data: [{ symbol: 'USDC', chainId: 'ethereum-sepolia' }] });
    if (path === '/api/v1/auth/login' && req.method === 'POST') return sendJson(res, 200, { data: { token: 'jwt_cli_e2e_token', user: { id: 'user-1', email: 'operator@example.com' } } });
    if (path === '/api/v1/auth/me') return sendJson(res, 200, { data: { id: 'user-1', email: 'operator@example.com', organizationId: '00000000-0000-0000-0000-000000000001' } });
    if (path === '/api/v1/chains') return sendJson(res, 200, { data: [{ id: 'ethereum-sepolia', monitor: 'ok' }] });
    if (path === '/api/v1/api-keys' && req.method === 'GET') return sendJson(res, 200, { data: [{ id: 'key-1', name: 'existing' }] });
    if (path === '/api/v1/api-keys' && req.method === 'POST') return sendJson(res, 200, { data: { id: 'key-new', name: (body as any)?.name, key: 'pk_cli_e2e_secret' } });
    if (path === '/api/v1/api-keys/key-new' && req.method === 'DELETE') return sendJson(res, 200, { data: { revoked: true, id: 'key-new' } });
    if (path === '/api/v1/address-pool/availability') return sendJson(res, 200, { data: { protocol: url.searchParams.get('protocol'), available: 3 } });
    if (path === '/api/v1/address-pool/import' && req.method === 'POST') return sendJson(res, 200, { data: { imported: (body as any)?.addresses?.length || 0, protocol: (body as any)?.protocol } });
    if (path === '/api/v1/notifications/endpoints') return sendJson(res, 200, { data: [{ id: 'webhook-1', url: 'https://example.com/webhook' }] });
    if (path === '/api/v1/notifications/endpoints/webhook-1/test' && req.method === 'POST') return sendJson(res, 200, { data: { delivered: true, id: 'webhook-1' } });
    if (path === '/api/v1/orders' && req.method === 'POST') return sendJson(res, 200, { data: { id: 'order-1', orderReference: (body as any)?.orderReference, paymentUrl: '/pay/order/order-1' } });
    if (path === '/api/order-status/order-1') return sendJson(res, 200, { data: { id: 'order-1', status: 'pending' } });

    sendJson(res, 404, { error: `missing route ${req.method} ${path}` });
  });

  await new Promise<void>((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to start mock PayIn runtime');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    calls,
    close: () => new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())),
  };
}

describe('PayIn CLI end-to-end contract', () => {
  let runtime: Awaited<ReturnType<typeof startMockPayInRuntime>>;
  let tempDir: string;
  let configPath: string;
  let addressFile: string;

  beforeAll(async () => {
    runtime = await startMockPayInRuntime();
    tempDir = mkdtempSync(join(tmpdir(), 'payin-cli-e2e-'));
    configPath = join(tempDir, 'config.json');
    addressFile = join(tempDir, 'addresses.txt');
    writeFileSync(addressFile, [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ].join('\n'));
  });

  afterAll(async () => {
    await runtime?.close();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  async function cli(args: string[]) {
    const child = spawn(resolve('node_modules/.bin/tsx'), ['packages/cli/src/index.ts', ...args], {
      cwd: resolve('.'),
      env: { ...process.env, PAYIN_CONFIG: configPath },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => stdout += chunk);
    child.stderr.on('data', (chunk) => stderr += chunk);
    const status = await new Promise<number | null>((resolveExit) => child.on('close', resolveExit));
    const parsed = stdout.trim().startsWith('{') ? JSON.parse(stdout) : undefined;
    return { status, stdout, stderr, parsed };
  }

  async function expectOk(args: string[]) {
    const result = await cli(['--json', ...args]);
    expect(result.status, `${args.join(' ')}\nstdout:${result.stdout}\nstderr:${result.stderr}`).toBe(0);
    expect(result.parsed?.ok, result.stdout).toBe(true);
    return result.parsed;
  }

  it('runs every supported operator command against a live HTTP runtime', async () => {
    await expectOk(['profile', 'add', 'mock', runtime.baseUrl]);
    await expectOk(['profile', 'list']);
    await expectOk(['profile', 'use', 'mock']);
    await expectOk(['--profile', 'mock', 'login', '--username', 'operator@example.com', '--password', 'test-password', '--save']);
    await expectOk(['--profile', 'mock', 'whoami']);
    await expectOk(['--profile', 'mock', 'doctor']);
    await expectOk(['--profile', 'mock', 'chains']);
    await expectOk(['--profile', 'mock', 'tokens']);
    await expectOk(['--profile', 'mock', 'api-key', 'list']);
    await expectOk(['--profile', 'mock', 'api-key', 'create', '--name', 'cli-test']);
    await expectOk(['--profile', 'mock', 'api-key', 'revoke', 'key-new']);
    await expectOk(['--profile', 'mock', 'address-pool', 'status', '--protocol', 'evm']);
    await expectOk(['--profile', 'mock', 'address-pool', 'import', addressFile, '--protocol', 'evm']);
    await expectOk(['--profile', 'mock', 'webhooks', 'list']);
    await expectOk(['--profile', 'mock', 'webhooks', 'test', 'webhook-1']);
    await expectOk(['--profile', 'mock', 'smoke', '--create-order', '--amount', '1.23', '--currency', 'USDC', '--chain-id', 'ethereum-sepolia', '--order-reference', 'cli-smoke', '--webhook-id', 'webhook-1', '--require-live']);

    expect(runtime.calls.map((call) => `${call.method} ${call.path}`)).toEqual(expect.arrayContaining([
      'POST /api/v1/auth/login',
      'GET /api/v1/auth/me',
      'GET /health',
      'GET /api/chains',
      'GET /api/tokens',
      'GET /api/v1/chains',
      'GET /api/v1/api-keys',
      'POST /api/v1/api-keys',
      'DELETE /api/v1/api-keys/key-new',
      'GET /api/v1/address-pool/availability',
      'POST /api/v1/address-pool/import',
      'GET /api/v1/notifications/endpoints',
      'POST /api/v1/notifications/endpoints/webhook-1/test',
      'POST /api/v1/orders',
      'GET /api/order-status/order-1',
    ]));

    const authenticatedCalls = runtime.calls.filter((call) => call.path.startsWith('/api/v1') && call.path !== '/api/v1/auth/login');
    expect(authenticatedCalls.length).toBeGreaterThan(0);
    expect(authenticatedCalls.every((call) => Boolean(call.headers.authorization))).toBe(true);
  }, 60_000);
});
