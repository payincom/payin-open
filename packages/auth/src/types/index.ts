/**
 * Type definitions for Auth module
 */

// Export organization types
export * from './organizations.js';

/**
 * User entity
 */
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  isSuperadmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User without sensitive data (for API responses)
 */
export interface UserPublic {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  isSuperadmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session entity
 */
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Audit log entity
 */
export interface AuditLog {
  id: number;
  userId: string;
  username: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  requestBody?: any;
  responseBody?: any;
  responseStatus?: number | undefined;
  duration?: number;
  error?: string | undefined;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Login result
 */
export interface LoginResult {
  success: boolean;
  token?: string;
  user?: UserPublic;
  error?: string;
}

/**
 * Create user input
 */
export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
}

/**
 * Update user input
 */
export interface UpdateUserInput {
  email?: string;
  password?: string;
  isActive?: boolean;
}

/**
 * Audit log options
 */
export interface AuditLogOptions {
  userId?: string;
  username?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method?: string;
  path?: string;
  requestBody?: any;
  responseBody?: any;
  responseStatus?: number | undefined;
  duration?: number;
  error?: string | undefined;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Permission definition
 */
export type Permission = `${string}:${'read' | 'write' | 'delete'}`;

/**
 * API Key entity
 */
export interface ApiKey {
  id: string;
  userId: string;
  organizationId: string;  // Organization binding
  keyPrefix: string;
  keyHash: string;
  name: string;
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API Key without sensitive data (for API responses)
 */
export interface ApiKeyPublic {
  id: string;
  userId: string;
  organizationId: string;  // Organization binding
  keyPrefix: string;
  name: string;
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create API Key input
 */
export interface CreateApiKeyInput {
  name: string;
  expiresAt?: Date;
  // organizationId is passed as a separate parameter in createApiKey()
}

/**
 * Create API Key result
 */
export interface CreateApiKeyResult {
  apiKey: string; // Full key (only shown once)
  metadata: ApiKeyPublic;
}

/**
 * Update API Key input
 */
export interface UpdateApiKeyInput {
  name?: string;
  isActive?: boolean;
  expiresAt?: Date;
}

/**
 * API Key verification result
 */
export interface ApiKeyVerificationResult {
  valid: boolean;
  apiKeyId?: string;
  userId?: string;
  username?: string;
  organizationId?: string;  // Organization context
  error?: string;
}
