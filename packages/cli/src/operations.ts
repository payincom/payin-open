import { PayInClient, inferRuntime, type ResolvedTarget } from './client.js';
import type { CommandResult } from './types.js';

export function createClient(target: ResolvedTarget): PayInClient {
  return new PayInClient(target);
}

export async function doctor(client: PayInClient): Promise<CommandResult> {
  const checks: NonNullable<CommandResult['checks']> = [];
  const payloads: unknown[] = [];
  for (const item of [
    { id: 'health', path: '/health', auth: false },
    { id: 'public.chains', path: '/api/chains', auth: false },
    { id: 'public.tokens', path: '/api/tokens', auth: false },
  ]) {
    try {
      const data = await client.get(item.path, { auth: item.auth });
      payloads.push(data);
      checks.push({ id: item.id, ok: true, message: `${item.path} reachable`, data });
    } catch (error) {
      checks.push({ id: item.id, ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  }
  try {
    const data = await client.get('/api/v1/chains');
    payloads.push(data);
    checks.push({ id: 'operator.chains', ok: true, message: '/api/v1/chains reachable', data });
  } catch (error) {
    checks.push({ id: 'operator.chains', ok: false, message: 'Operator chain check skipped or failed; configure login/API key for authenticated diagnostics.', data: error instanceof Error ? error.message : String(error) });
  }
  const requiredOk = checks.filter((c) => c.id !== 'operator.chains').every((c) => c.ok);
  return { ok: requiredOk, checks, data: { runtime: inferRuntime(payloads), url: client.baseUrl } };
}

export async function smoke(
  client: PayInClient,
  options: { createOrder?: boolean; amount?: string; currency?: string; chainId?: string; orderReference?: string; webhookId?: string; requireLive?: boolean }
): Promise<CommandResult> {
  const checks: NonNullable<CommandResult['checks']> = [];
  const health = await doctor(client);
  checks.push(...(health.checks || []));
  if (options.createOrder) {
    try {
      const orderReference = options.orderReference || `payin-cli-smoke-${Date.now()}`;
      const data: any = await client.post('/api/v1/orders', {
        orderReference,
        amount: options.amount || '1.00',
        currency: options.currency || 'USDC',
        chainId: options.chainId || 'ethereum-sepolia',
      });
      checks.push({ id: 'order.create', ok: true, message: `created smoke order ${orderReference}`, data });
      const orderId = data?.data?.id || data?.id || data?.data?.order?.id;
      if (orderId) {
        try {
          const status = await client.get(`/api/order-status/${encodeURIComponent(orderId)}`, { auth: false });
          checks.push({ id: 'order.status', ok: true, message: `public order status reachable for ${orderId}`, data: status });
        } catch (error) {
          checks.push({ id: 'order.status', ok: false, message: error instanceof Error ? error.message : String(error) });
        }
      }
    } catch (error) {
      checks.push({ id: 'order.create', ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  } else if (options.requireLive) {
    checks.push({ id: 'order.create', ok: false, message: '--require-live needs --create-order for a full smoke gate.' });
  }
  if (options.webhookId) {
    try {
      const data = await client.post(`/api/v1/notifications/endpoints/${encodeURIComponent(options.webhookId)}/test`, {});
      checks.push({ id: 'webhook.test', ok: true, message: `webhook ${options.webhookId} test accepted`, data });
    } catch (error) {
      checks.push({ id: 'webhook.test', ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  } else if (options.requireLive) {
    checks.push({ id: 'webhook.test', ok: false, message: '--require-live needs --webhook-id for webhook verification.' });
  }
  return { ok: checks.every((c) => c.ok || (!options.requireLive && ['operator.chains'].includes(c.id))), checks, data: health.data };
}

export async function login(client: PayInClient, username: string, password: string): Promise<CommandResult> {
  const data: any = await client.post('/api/v1/auth/login', { username, password }, { auth: false });
  const token = data?.data?.token || data?.token || data?.accessToken || data?.data?.accessToken;
  return { ok: Boolean(token), data: { token, user: data?.data?.user || data?.user } };
}

export async function whoami(client: PayInClient): Promise<CommandResult> {
  return { ok: true, data: await client.get('/api/v1/auth/me') };
}

export async function apiKeyCreate(client: PayInClient, name: string, expiresAt?: string): Promise<CommandResult> {
  return { ok: true, data: await client.post('/api/v1/api-keys', { name, expiresAt }) };
}

export async function apiKeyList(client: PayInClient): Promise<CommandResult> {
  return { ok: true, data: await client.get('/api/v1/api-keys') };
}

export async function apiKeyRevoke(client: PayInClient, id: string): Promise<CommandResult> {
  return { ok: true, data: await client.delete(`/api/v1/api-keys/${encodeURIComponent(id)}`) };
}

export async function simpleGet(client: PayInClient, path: string): Promise<CommandResult> {
  return { ok: true, data: await client.get(path) };
}

export async function addressPoolImport(client: PayInClient, protocol: string, addresses: string[]): Promise<CommandResult> {
  return { ok: true, data: await client.post('/api/v1/address-pool/import', { protocol, addresses }) };
}

export async function webhookTest(client: PayInClient, id: string): Promise<CommandResult> {
  return { ok: true, data: await client.post(`/api/v1/notifications/endpoints/${encodeURIComponent(id)}/test`, {}) };
}
