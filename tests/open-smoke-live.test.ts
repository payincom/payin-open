import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';

let server: ReturnType<typeof createServer> | undefined;

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendHtml(res: ServerResponse, statusCode: number, body: string) {
  res.writeHead(statusCode, { 'content-type': 'text/html' });
  res.end(body);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function startSmokeServer() {
  const calls: string[] = [];
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    calls.push(`${req.method} ${url.pathname}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { status: 'healthy' });
    }
    if (req.method === 'GET' && url.pathname === '/api/chains') {
      return sendJson(res, 200, { success: true, data: [{ chainId: 'ethereum-sepolia' }] });
    }
    if (req.method === 'GET' && url.pathname === '/api/tokens') {
      return sendJson(res, 200, { success: true, data: [{ symbol: 'USDC' }] });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/chains') {
      expect(req.headers.authorization).toBe('Bearer pk_smoke_test');
      return sendJson(res, 200, {
        success: true,
        data: [{ chainId: 'ethereum-sepolia', syncStatus: { isHealthy: true } }],
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/orders') {
      expect(req.headers.authorization).toBe('Bearer pk_smoke_test');
      const body = JSON.parse(await readBody(req));
      expect(body).toMatchObject({
        orderReference: 'smoke-contract-test',
        amount: '1.00',
        currency: 'USDC',
        chainId: 'ethereum-sepolia',
      });
      return sendJson(res, 201, {
        success: true,
        data: {
          orderId: 'order-smoke-1',
          url: `http://127.0.0.1:${(server!.address() as any).port}/pay/order/order-smoke-1`,
        },
      });
    }
    if (req.method === 'GET' && url.pathname === '/pay/order/order-smoke-1') {
      return sendHtml(res, 200, '<html><body><div id="order-payment-root"></div></body></html>');
    }
    if (req.method === 'GET' && url.pathname === '/api/order-status/order-smoke-1') {
      return sendJson(res, 200, { success: true, data: { status: 'pending' } });
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/notifications/endpoints/webhook-smoke-1/test') {
      expect(req.headers.authorization).toBe('Bearer pk_smoke_test');
      return sendJson(res, 200, { success: true, deliveryId: 'delivery-smoke-1' });
    }

    sendJson(res, 404, { error: 'not found', path: url.pathname });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as any).port;
  return { baseUrl: `http://127.0.0.1:${port}`, calls };
}

function runOpenCommand(script: string, args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', script, ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function runOpenSmoke(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return runOpenCommand('scripts/open/open-smoke.ts', args);
}

function runOpenDoctor(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return runOpenCommand('scripts/open/open-doctor.ts', args);
}

afterEach(async () => {
  if (server) {
    server.close();
    await once(server, 'close');
    server = undefined;
  }
});

describe('open:doctor live contract', () => {
  it('checks live API and authenticated monitor readiness when URL and API key are provided', async () => {
    const { baseUrl } = await startSmokeServer();

    const result = await runOpenDoctor([
      '--url', baseUrl,
      '--api-key', 'pk_smoke_test',
      '--json',
    ]);

    expect(result.code).toBe(0);
    const summary = JSON.parse(result.stdout);
    expect(summary.ok).toBe(true);
    expect(summary.checks.map((check: any) => check.id)).toEqual(expect.arrayContaining([
      `http.${baseUrl}/health`,
      `http.${baseUrl}/api/chains`,
      `http.${baseUrl}/api/tokens`,
      `http.${baseUrl}/api/v1/chains`,
    ]));
  });

  it('fails strict mode when live API URL is not provided', async () => {
    const result = await runOpenDoctor(['--strict', '--json']);

    expect(result.code).toBe(1);
    const summary = JSON.parse(result.stdout);
    expect(summary.ok).toBe(false);
    expect(summary.checks.find((check: any) => check.id === 'api.live-check')?.status).toBe('fail');
  });
});

describe('open:smoke live contract', () => {
  it('checks health, public config, monitor status, order page, order status, and webhook delivery', async () => {
    const { baseUrl, calls } = await startSmokeServer();

    const result = await runOpenSmoke([
      '--url', baseUrl,
      '--api-key', 'pk_smoke_test',
      '--create-order',
      '--order-reference', 'smoke-contract-test',
      '--webhook-id', 'webhook-smoke-1',
      '--require-live',
      '--json',
    ]);

    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    const summary = JSON.parse(result.stdout);
    expect(summary.ok).toBe(true);
    expect(summary.checks.map((check: any) => check.id)).toEqual(expect.arrayContaining([
      `http.${baseUrl}/health`,
      `http.${baseUrl}/api/chains`,
      `http.${baseUrl}/api/tokens`,
      `http.${baseUrl}/api/v1/chains`,
      'smoke.order.create',
      `http.${baseUrl}/pay/order/order-smoke-1`,
      `http.${baseUrl}/api/order-status/order-smoke-1`,
      'smoke.webhook.delivery',
    ]));
    expect(calls).toEqual(expect.arrayContaining([
      'GET /health',
      'GET /api/chains',
      'GET /api/tokens',
      'GET /api/v1/chains',
      'POST /api/v1/orders',
      'GET /pay/order/order-smoke-1',
      'GET /api/order-status/order-smoke-1',
      'POST /api/v1/notifications/endpoints/webhook-smoke-1/test',
    ]));
  });

  it('fails require-live mode when authenticated smoke checks are missing', async () => {
    const { baseUrl } = await startSmokeServer();

    const result = await runOpenSmoke(['--url', baseUrl, '--require-live', '--json']);

    expect(result.code).toBe(1);
    const summary = JSON.parse(result.stdout);
    expect(summary.ok).toBe(false);
    expect(summary.checks.find((check: any) => check.id === 'smoke.auth')?.status).toBe('fail');
  });
});
