import { loadConfig } from './config.js';
import type { CliProfile, GlobalOptions, PayInRuntime } from './types.js';

export class PayInHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
  }
}

export interface ResolvedTarget {
  profile?: CliProfile | undefined;
  url: string;
  token?: string | undefined;
  apiKey?: string | undefined;
  organizationId?: string | undefined;
  timeoutMs: number;
}

export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export function resolveTarget(options: GlobalOptions, configPath?: string): ResolvedTarget {
  const config = loadConfig(configPath);
  const profileName = options.profile || config.currentProfile;
  const profile = profileName ? config.profiles[profileName] : undefined;
  const url = options.url || process.env.PAYIN_API_URL || profile?.url;
  if (!url) {
    throw new Error('No PayIn API URL configured. Use --url or `payin profile add <name> --url <url>`.');
  }
  return {
    profile,
    url: normalizeUrl(url),
    token: options.token || process.env.PAYIN_TOKEN || profile?.token,
    apiKey: options.apiKey || process.env.PAYIN_API_KEY || profile?.apiKey,
    organizationId: options.organizationId || process.env.PAYIN_ORGANIZATION_ID || profile?.organizationId,
    timeoutMs: Number(options.timeout || process.env.PAYIN_TIMEOUT || 15000),
  };
}

export class PayInClient {
  constructor(private readonly target: ResolvedTarget, private readonly fetchImpl: typeof fetch = fetch) {}

  get baseUrl(): string {
    return this.target.url;
  }

  async request<T = unknown>(method: string, path: string, body?: unknown, options: { auth?: boolean } = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.target.timeoutMs);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (options.auth !== false) {
        const credential = this.target.apiKey || this.target.token;
        if (credential) headers.Authorization = `Bearer ${credential}`;
        if (this.target.organizationId) headers['X-Organization-Id'] = this.target.organizationId;
      }
      const requestInit: RequestInit = { method, headers, signal: controller.signal };
      if (body !== undefined) requestInit.body = JSON.stringify(body);
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, requestInit);
      const text = await response.text();
      const parsed = text ? parseJsonOrText(text) : undefined;
      if (!response.ok) throw new PayInHttpError(`HTTP ${response.status} ${method} ${path}`, response.status, parsed);
      return parsed as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  get<T = unknown>(path: string, options?: { auth?: boolean }) {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T = unknown>(path: string, body?: unknown, options?: { auth?: boolean }) {
    return this.request<T>('POST', path, body, options);
  }

  delete<T = unknown>(path: string, options?: { auth?: boolean }) {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

export function parseJsonOrText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function inferRuntime(payloads: unknown[]): PayInRuntime {
  const joined = JSON.stringify(payloads).toLowerCase();
  if (joined.includes('payin open') || joined.includes('"runtime":"open"') || joined.includes('"runtime":"payin-open"')) return 'open';
  if (joined.includes('"runtime":"cloud"') || joined.includes('multi-tenant') || joined.includes('cloud')) return 'cloud';
  return 'unknown';
}
