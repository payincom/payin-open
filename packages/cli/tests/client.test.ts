import { describe, expect, it } from 'vitest';
import { inferRuntime, normalizeUrl, PayInClient } from '../src/client.js';

describe('PayIn CLI HTTP client', () => {
  it('normalizes API URLs', () => {
    expect(normalizeUrl('https://pay.example.com///')).toBe('https://pay.example.com');
  });

  it('adds bearer and organization headers', async () => {
    const calls: any[] = [];
    const client = new PayInClient({ url: 'https://pay.example.com', token: 'jwt-token', organizationId: 'org-1', timeoutMs: 1000 }, async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    await client.get('/api/v1/chains');
    expect(calls[0].url).toBe('https://pay.example.com/api/v1/chains');
    expect(calls[0].init.headers.Authorization).toBe('Bearer jwt-token');
    expect(calls[0].init.headers['X-Organization-Id']).toBe('org-1');
  });

  it('infers runtime from payloads', () => {
    expect(inferRuntime([{ runtime: 'open' }])).toBe('open');
    expect(inferRuntime([{ runtime: 'cloud' }])).toBe('cloud');
    expect(inferRuntime([{ ok: true }])).toBe('unknown');
  });
});
