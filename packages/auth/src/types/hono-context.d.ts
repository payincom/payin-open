import 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    [key: string]: unknown;
    authType?: 'jwt' | 'apikey';
    apiKeyId?: string;
    userId?: string;
    username?: string;
    organizationId?: string;
    organizationRole?: string;
    token?: string;
    user?: unknown;
  }
}
