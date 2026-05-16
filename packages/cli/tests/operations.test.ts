import { describe, expect, it } from 'vitest';
import { PayInClient } from '../src/client.js';
import { doctor, smoke } from '../src/operations.js';

describe('PayIn CLI operations', () => {
  it('runs doctor against public endpoints', async () => {
    const client = new PayInClient({ url: 'https://pay.example.com', timeoutMs: 1000 }, async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === '/api/v1/chains') return new Response('Unauthorized', { status: 401 });
      return Response.json({ success: true, runtime: path === '/health' ? 'open' : undefined });
    });
    const result = await doctor(client);
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ runtime: 'open' });
    expect(result.checks?.map((check) => check.id)).toContain('operator.chains');
  });

  it('requires live order and webhook checks when requested', async () => {
    const client = new PayInClient({ url: 'https://pay.example.com', timeoutMs: 1000 }, async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === '/api/v1/chains') return new Response('Unauthorized', { status: 401 });
      return Response.json({ success: true });
    });
    const result = await smoke(client, { requireLive: true });
    expect(result.ok).toBe(false);
    expect(result.checks?.some((check) => check.id === 'order.create' && !check.ok)).toBe(true);
    expect(result.checks?.some((check) => check.id === 'webhook.test' && !check.ok)).toBe(true);
  });
});
