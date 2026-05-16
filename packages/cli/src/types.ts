export type PayInRuntime = 'open' | 'cloud' | 'unknown';

export interface CliProfile {
  name: string;
  url: string;
  token?: string | undefined;
  apiKey?: string | undefined;
  organizationId?: string | undefined;
  runtime?: PayInRuntime | undefined;
}

export interface CliConfig {
  currentProfile?: string | undefined;
  profiles: Record<string, CliProfile>;
}

export interface GlobalOptions {
  profile?: string | undefined;
  url?: string | undefined;
  token?: string | undefined;
  apiKey?: string | undefined;
  organizationId?: string | undefined;
  json?: boolean | undefined;
  timeout?: string | number | undefined;
}

export interface CommandResult<T = unknown> {
  ok: boolean;
  data?: T;
  checks?: Array<{ id: string; ok: boolean; status?: number; message: string; data?: unknown }>;
  error?: string;
  suggestions?: string[];
}
