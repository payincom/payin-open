/**
 * Authentication Manager
 * Handles user authentication, authorization, and audit logging
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID, randomBytes } from 'crypto';
// import { createLogger, LogCategory } from '@payin/shared';
import { ALL_SCHEMAS, TABLE_NAMES, type TableName } from './database/schema.js';
import {
  type User,
  type UserPublic,
  type AuditLog,
  type LoginCredentials,
  type LoginResult,
  type CreateUserInput,
  type UpdateUserInput,
  type AuditLogOptions,
  type ApiKeyPublic,
  type CreateApiKeyInput,
  type CreateApiKeyResult,
  type UpdateApiKeyInput,
  type ApiKeyVerificationResult,
  OrganizationPlan,
  OrganizationRole,
} from './types/index.js';
import {
  hasOrganizationPermission,
  hasOrganizationResourcePermission
} from './permissions.js';
import { OrganizationManager } from './organization-manager.js';
import {
  validateRegistration,
  sanitizeUsername,
  sanitizeEmail,
} from './validation.js';
import type { EmailService } from '@payin/email';

const DEFAULT_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_ORGANIZATION_NAME = 'Default Organization';
const DEFAULT_ORGANIZATION_SLUG = 'default';

export interface AuthManagerOptions {
  /** Database connection string (shared with Manager) */
  connectionString: string;
  /** JWT secret for token signing */
  jwtSecret: string;
  /** JWT token expiration (default: 24h) */
  tokenExpiration?: string;
  /** Email service instance (optional) */
  emailService?: EmailService;
  /** Base URL for email links (e.g., https://your-payin.example.com) */
  baseUrl?: string;
}

export class AuthManager {
  private readonly db: Pool;
  private readonly jwtSecret: string;
  private readonly tokenExpiration: string;
  private readonly saltRounds = 10;
  public readonly organizations: OrganizationManager;
  private readonly emailService: EmailService | undefined;
  private readonly baseUrl: string | undefined;

  constructor(options: AuthManagerOptions) {
    if (!options.connectionString) {
      throw new Error('AuthManager requires connectionString');
    }
    if (!options.jwtSecret) {
      throw new Error('AuthManager requires jwtSecret');
    }

    this.db = new Pool({ connectionString: options.connectionString });
    this.jwtSecret = options.jwtSecret;
    this.tokenExpiration = options.tokenExpiration || '24h';
    this.organizations = new OrganizationManager(this.db);
    this.emailService = options.emailService;
    this.baseUrl = options.baseUrl;
  }

  /**
   * Initialize Auth module
   * When INIT_DB=true: drops all tables, recreates them, and creates default admin user
   */
  async initialize(): Promise<void> {
    const shouldInit = process.env.INIT_DB === 'true';

    if (shouldInit) {
      console.log('🔧 Initializing Auth (INIT_DB=true)...');
      console.log('⚠️  AGGRESSIVE MODE: All Auth tables will be dropped and recreated!');

      // Drop and recreate all tables
      console.log('🗑️  Dropping existing Auth tables...');
      await this.dropTables();
      console.log('✅ Existing tables dropped');

      console.log('🏗️  Creating database schema...');
      await this.createTables();
      console.log('✅ Database schema created!');

      // Create default admin user
      await this.createDefaultAdmin();

      console.log('✅ Auth initialization completed!');
    } else {
      console.log('⏭️  Skipping Auth initialization (INIT_DB not set to true)');
    }
  }

  /**
   * Check database schema completeness
   */
  async checkDatabaseSchema(): Promise<{
    isComplete: boolean;
    missingTables: TableName[];
    existingTables: TableName[];
  }> {
    const missing: TableName[] = [];
    const existing: TableName[] = [];

    for (const tableName of TABLE_NAMES) {
      const result = await this.db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        )`,
        [tableName]
      );

      if (result.rows[0].exists) {
        existing.push(tableName);
      } else {
        missing.push(tableName);
      }
    }

    return {
      isComplete: missing.length === 0,
      missingTables: missing,
      existingTables: existing,
    };
  }

  /**
   * Drop all Auth tables
   * DANGEROUS: This will delete all data!
   */
  private async dropTables(): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Drop tables in reverse order to respect foreign key dependencies
      // Ownership transfer audit depends on ownership_transfer_requests
      await client.query('DROP TABLE IF EXISTS ownership_transfer_audit CASCADE');
      await client.query('DROP TABLE IF EXISTS ownership_transfer_requests CASCADE');

      // API keys depend on users and organizations
      await client.query('DROP TABLE IF EXISTS api_keys CASCADE');

      // Organization members depend on organizations and users
      await client.query('DROP TABLE IF EXISTS organization_members CASCADE');

      // Organizations is independent
      await client.query('DROP TABLE IF EXISTS organizations CASCADE');

      // Audit logs depend on users
      await client.query('DROP TABLE IF EXISTS audit_logs CASCADE');

      // Sessions depend on users
      await client.query('DROP TABLE IF EXISTS sessions CASCADE');

      // Users is the base table
      await client.query('DROP TABLE IF EXISTS users CASCADE');

      // Drop the trigger function
      await client.query('DROP FUNCTION IF EXISTS check_last_owner() CASCADE');

      await client.query('COMMIT');
      console.log('✅ All Auth tables dropped successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to drop tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      for (const schema of ALL_SCHEMAS) {
        await client.query(schema);
      }

      await client.query('COMMIT');
      console.log('✅ All Auth tables created successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to create tables:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create default admin user
   */
  private async createDefaultAdmin(): Promise<void> {
    const defaultUsername = 'admin';
    const defaultPassword = 'admin123';
    const defaultEmail = 'admin@payin.local';

    // Check if admin user exists
    const existing = await this.db.query(
      'SELECT id FROM users WHERE username = $1',
      [defaultUsername]
    );

    if (existing.rows.length > 0) {
      const existingUserId = existing.rows[0].id as string;
      await this.ensureDefaultOrganizationMembership(existingUserId);
      console.log('ℹ️  Default admin user already exists');
      return;
    }

    // Create admin user
    const passwordHash = await bcrypt.hash(defaultPassword, this.saltRounds);
    const userId = randomUUID();

    await this.db.query(
      `INSERT INTO users (id, username, email, password_hash, is_active, is_superadmin)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, defaultUsername, defaultEmail, passwordHash, true, false]
    );

    await this.ensureDefaultOrganizationMembership(userId);

    console.log(`✅ Default admin user created (username: ${defaultUsername}, password: ${defaultPassword})`);
    console.warn('⚠️  Please change the default admin password after first login!');
  }

  /**
   * Ensure the default organization exists and the given user is a member
   */
  private async ensureDefaultOrganizationMembership(userId: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const orgResult = await client.query(
        'SELECT id FROM organizations WHERE id = $1',
        [DEFAULT_ORGANIZATION_ID]
      );

      if (orgResult.rows.length === 0) {
        await client.query(
          `INSERT INTO organizations (id, name, slug, plan_type)
           VALUES ($1, $2, $3, $4)`,
          [DEFAULT_ORGANIZATION_ID, DEFAULT_ORGANIZATION_NAME, DEFAULT_ORGANIZATION_SLUG, OrganizationPlan.ENTERPRISE]
        );
      }

      const membershipResult = await client.query(
        `SELECT id FROM organization_members
         WHERE organization_id = $1 AND user_id = $2`,
        [DEFAULT_ORGANIZATION_ID, userId]
      );

      if (membershipResult.rows.length === 0) {
        await client.query(
          `INSERT INTO organization_members (
            id, organization_id, user_id, role, status
          ) VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), DEFAULT_ORGANIZATION_ID, userId, OrganizationRole.OWNER, 'active']
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.db.end();
  }

  // ==================== User Management ====================

  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput): Promise<UserPublic> {
    // Validate input
    const validationResult = validateRegistration(input);
    if (!validationResult.valid) {
      throw new Error(validationResult.error);
    }

    // Sanitize input
    const username = sanitizeUsername(input.username);
    const email = sanitizeEmail(input.email);

    // Check if username already exists
    const existingUser = await this.getUserByUsername(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Check if email already exists
    const existingEmail = await this.db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (existingEmail.rows.length > 0) {
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, this.saltRounds);
    const userId = randomUUID();

    // Insert user
    const result = await this.db.query(
      `INSERT INTO users (id, username, email, password_hash, is_active, is_superadmin)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, is_active, is_superadmin AS "isSuperadmin", created_at, updated_at`,
      [userId, username, email, passwordHash, true, false]
    );

    const user = result.rows[0];

    // Send welcome email and verification email (if email service is configured)
    if (this.emailService) {
      try {
        // Send welcome email
        await this.emailService.sendTemplate('welcome', {
          to: email,
          data: {
            username,
            email,
            loginUrl: this.baseUrl ? `${this.baseUrl}/login` : undefined,
          },
        });

        // Generate and send verification email
        const verificationToken = await this.generateEmailVerificationToken(userId);
        const verificationUrl = this.baseUrl
          ? `${this.baseUrl}/verify-email/${verificationToken}`
          : `http://localhost:3000/verify-email/${verificationToken}`;

        await this.emailService.sendTemplate('verify-email', {
          to: email,
          data: {
            username,
            email,
            verificationUrl,
            expiresIn: '24 hours',
          },
        });
      } catch (error) {
        // Log email error but don't fail user creation
        console.error('Failed to send registration emails:', error);
      }
    }

    return user;
  }

  /**
   * Create a short-lived preview token for internal features (e.g., checkout preview)
   */
  createPreviewToken(payload: Record<string, any>, expiresIn = '10m'): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn } as jwt.SignOptions);
  }

  verifyPreviewToken(token: string): { valid: boolean; payload?: Record<string, any>; error?: string } {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as Record<string, any>;
      return { valid: true, payload: decoded };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserPublic | null> {
    const result = await this.db.query(
      `SELECT id, username, email, is_active AS "isActive",
              is_superadmin AS "isSuperadmin",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE id = $1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT id, username, email, password_hash AS "passwordHash",
              is_active AS "isActive", is_superadmin AS "isSuperadmin",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE username = $1`,
      [username]
    );

    return result.rows[0] || null;
  }

  /**
   * List all users
   */
  async listUsers(): Promise<UserPublic[]> {
    const result = await this.db.query(
      `SELECT id, username, email, is_active AS "isActive",
              is_superadmin AS "isSuperadmin",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users ORDER BY created_at DESC`
    );

    return result.rows;
  }

  /**
   * Update user
   */
  async updateUser(userId: string, input: UpdateUserInput): Promise<UserPublic> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(input.email);
    }

    if (input.password !== undefined) {
      const passwordHash = await bcrypt.hash(input.password, this.saltRounds);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }


    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.isActive);
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    const result = await this.db.query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, username, email, is_active, created_at, updated_at`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    await this.db.query('DELETE FROM users WHERE id = $1', [userId]);
  }

  // ==================== Authentication ====================

  /**
   * Login with username and password
   */
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    // Get user
    const user = await this.getUserByUsername(credentials.username);

    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }

    if (!user.isActive) {
      return { success: false, error: 'User account is disabled' };
    }

    // Check if user has a password (OAuth/magic link users have NULL password_hash)
    if (!user.passwordHash) {
      return {
        success: false,
        error: 'This account uses passwordless login. Please use magic link or social login instead.'
      };
    }

    // Verify password
    const passwordValid = await bcrypt.compare(credentials.password, user.passwordHash);

    if (!passwordValid) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      },
      this.jwtSecret,
      { expiresIn: this.tokenExpiration } as jwt.SignOptions
    );

    // Create session
    const sessionId = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.db.query(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, user.id, token, expiresAt]
    );

    // Return public user info
    const { passwordHash, ...userPublic } = user;

    return {
      success: true,
      token,
      user: userPublic,
    };
  }

  /**
   * Logout (invalidate session)
   */
  async logout(token: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE token = $1', [token]);
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<{
    valid: boolean;
    userId?: string;
    username?: string;
    error?: string;
  }> {
    try {
      // Verify JWT
      const decoded = jwt.verify(token, this.jwtSecret) as {
        userId: string;
        username: string;
      };

      // Check if session exists and not expired
      const session = await this.db.query(
        `SELECT * FROM sessions
         WHERE token = $1 AND expires_at > NOW()`,
        [token]
      );

      if (session.rows.length === 0) {
        return { valid: false, error: 'Session expired or invalid' };
      }

      return {
        valid: true,
        userId: decoded.userId,
        username: decoded.username,
      };
    } catch (error) {
      return { valid: false, error: 'Invalid token' };
    }
  }

  // ==================== Authorization ====================

  /**
   * Check if organization role has permission
   */
  hasPermission(role: OrganizationRole | string, permission: string): boolean {
    return hasOrganizationPermission(role as OrganizationRole, permission as any);
  }

  /**
   * Check if organization role has resource permission
   */
  hasResourcePermission(role: OrganizationRole | string, resource: string, action: 'read' | 'write' | 'delete'): boolean {
    return hasOrganizationResourcePermission(role as OrganizationRole, resource, action);
  }

  // ==================== Audit Logging ====================

  /**
   * Record audit log
   */
  async recordAuditLog(options: AuditLogOptions): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_logs (
        user_id, username, action, resource, resource_id,
        method, path, request_body, response_body, response_status,
        duration, error, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        options.userId || null,
        options.username || 'anonymous',
        options.action,
        options.resource,
        options.resourceId || null,
        options.method || 'UNKNOWN',
        options.path || '',
        options.requestBody ? JSON.stringify(options.requestBody) : null,
        options.responseBody ? JSON.stringify(options.responseBody) : null,
        options.responseStatus || null,
        options.duration || null,
        options.error || null,
        options.ipAddress || null,
        options.userAgent || null,
      ]
    );
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(filters?: {
    userId?: string;
    resource?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }

    if (filters?.resource) {
      conditions.push(`resource = $${paramIndex++}`);
      values.push(filters.resource);
    }

    if (filters?.action) {
      conditions.push(`action = $${paramIndex++}`);
      values.push(filters.action);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    const result = await this.db.query(
      `SELECT * FROM audit_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...values, limit, offset]
    );

    return result.rows;
  }

  // ==================== API Key Management ====================

  /**
   * Generate a secure random API key
   */
  private generateApiKey(): string {
    const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
    const randomPart = randomBytes(16).toString('hex'); // 32 characters
    return `pk_${env}_${randomPart}`;
  }

  /**
   * Create a new API key for a user in a specific organization
   */
  async createApiKey(
    userId: string,
    organizationId: string,
    input: CreateApiKeyInput
  ): Promise<CreateApiKeyResult> {
    // Verify user is a member of the organization
    const membership = await this.organizations.verifyMembership(userId, organizationId);

    if (!membership.valid) {
      throw new Error(membership.error || 'User is not a member of this organization');
    }

    // Check permission (only admin/owner can create API keys)
    if (membership.role !== OrganizationRole.OWNER && membership.role !== OrganizationRole.ADMIN) {
      throw new Error('Insufficient permissions to create API keys');
    }

    // Generate API key
    const apiKey = this.generateApiKey();
    const keyPrefix = apiKey.substring(0, 8); // e.g., "pk_test_"
    const keyHash = await bcrypt.hash(apiKey, this.saltRounds);
    const keyId = randomUUID();

    // Get user info for response
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Insert into database
    await this.db.query(
      `INSERT INTO api_keys (
        id, user_id, organization_id, key_prefix, key_hash, name, is_active, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [keyId, userId, organizationId, keyPrefix, keyHash, input.name, true, input.expiresAt || null]
    );

    // Get the created API key metadata
    const result = await this.db.query(
      `SELECT id, user_id AS "userId", organization_id AS "organizationId",
              key_prefix AS "keyPrefix", name, is_active AS "isActive",
              last_used_at AS "lastUsedAt", expires_at AS "expiresAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM api_keys WHERE id = $1`,
      [keyId]
    );

    return {
      apiKey, // Full key (only shown once)
      metadata: result.rows[0],
    };
  }

  /**
   * Verify an API key and return organization context
   */
  async verifyApiKey(apiKey: string): Promise<ApiKeyVerificationResult> {
    try {
      // API keys should start with 'pk_'
      if (!apiKey.startsWith('pk_')) {
        return { valid: false, error: 'Invalid API key format' };
      }

      // Get all active API keys with organization info
      const result = await this.db.query(
        `SELECT ak.id, ak.user_id AS "userId", ak.organization_id AS "organizationId",
                ak.key_hash AS "keyHash", ak.is_active AS "isActive",
                ak.expires_at AS "expiresAt",
                u.username, u.is_active AS "userActive",
                om.role AS "orgRole", om.status AS "memberStatus"
         FROM api_keys ak
         JOIN users u ON ak.user_id = u.id
         LEFT JOIN organization_members om ON ak.organization_id = om.organization_id
                                           AND ak.user_id = om.user_id
         WHERE ak.is_active = true`
      );

      // Find matching key by comparing hashes
      let matchedKey: any = null;
      for (const row of result.rows) {
        const isMatch = await bcrypt.compare(apiKey, row.keyHash);
        if (isMatch) {
          matchedKey = row;
          break;
        }
      }

      if (!matchedKey) {
        return { valid: false, error: 'Invalid API key' };
      }

      // Check if user is active
      if (!matchedKey.userActive) {
        return { valid: false, error: 'User account is disabled' };
      }

      // Check if key is expired
      if (matchedKey.expiresAt && new Date(matchedKey.expiresAt) < new Date()) {
        return { valid: false, error: 'API key has expired' };
      }

      // Check organization membership
      if (!matchedKey.orgRole || matchedKey.memberStatus !== 'active') {
        return { valid: false, error: 'Organization membership is not active' };
      }

      return {
        valid: true,
        apiKeyId: matchedKey.id,
        userId: matchedKey.userId,
        username: matchedKey.username,
        organizationId: matchedKey.organizationId,
      };
    } catch (error) {
      console.error('API key verification error:', error);
      return { valid: false, error: 'Invalid API key' };
    }
  }

  /**
   * Update API key usage timestamp
   */
  async updateApiKeyUsage(keyId: string): Promise<void> {
    await this.db.query(
      `UPDATE api_keys SET last_used_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [keyId]
    );
  }

  /**
   * List all API keys for an organization (optionally filtered by user)
   */
  async listApiKeys(organizationId: string, userId?: string): Promise<ApiKeyPublic[]> {
    const conditions = ['organization_id = $1'];
    const params: any[] = [organizationId];

    if (userId) {
      conditions.push('user_id = $2');
      params.push(userId);
    }

    const result = await this.db.query(
      `SELECT id, user_id AS "userId", organization_id AS "organizationId",
              key_prefix AS "keyPrefix", name, is_active AS "isActive",
              last_used_at AS "lastUsedAt", expires_at AS "expiresAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM api_keys
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`,
      params
    );

    return result.rows;
  }

  /**
   * Get API key by ID
   */
  async getApiKeyById(keyId: string): Promise<ApiKeyPublic | null> {
    const result = await this.db.query(
      `SELECT id, user_id AS "userId", organization_id AS "organizationId",
              key_prefix AS "keyPrefix", name, is_active AS "isActive",
              last_used_at AS "lastUsedAt", expires_at AS "expiresAt",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM api_keys WHERE id = $1`,
      [keyId]
    );

    return result.rows[0] || null;
  }

  /**
   * Update API key
   */
  async updateApiKey(keyId: string, input: UpdateApiKeyInput): Promise<ApiKeyPublic> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }

    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.isActive);
    }

    if (input.expiresAt !== undefined) {
      updates.push(`expires_at = $${paramIndex++}`);
      values.push(input.expiresAt);
    }

    updates.push('updated_at = NOW()');
    values.push(keyId);

    const result = await this.db.query(
      `UPDATE api_keys SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, user_id AS "userId", organization_id AS "organizationId",
                 key_prefix AS "keyPrefix", name, is_active AS "isActive",
                 last_used_at AS "lastUsedAt", expires_at AS "expiresAt",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );

    return result.rows[0];
  }

  /**
   * Revoke (delete) API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await this.db.query('DELETE FROM api_keys WHERE id = $1', [keyId]);
  }

  // ==================== Email Verification ====================

  /**
   * Generate email verification token
   * @param userId User ID
   * @returns Verification token
   */
  private async generateEmailVerificationToken(userId: string): Promise<string> {
    // Generate secure random token
    const token = randomBytes(32).toString('hex');
    const verificationId = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiration

    // Store verification token
    await this.db.query(
      `INSERT INTO email_verifications (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [verificationId, userId, token, expiresAt]
    );

    return token;
  }

  /**
   * Verify email with token
   * @param token Verification token
   * @returns Success status and user info
   */
  async verifyEmail(token: string): Promise<{
    success: boolean;
    message?: string;
    userId?: string;
  }> {
    // Find verification record
    const verification = await this.db.query(
      `SELECT id, user_id, expires_at, verified_at
       FROM email_verifications
       WHERE token = $1`,
      [token]
    );

    if (verification.rows.length === 0) {
      return {
        success: false,
        message: 'Invalid verification token',
      };
    }

    const record = verification.rows[0];

    // Check if already verified
    if (record.verified_at) {
      return {
        success: false,
        message: 'Email already verified',
      };
    }

    // Check if expired
    if (new Date() > new Date(record.expires_at)) {
      return {
        success: false,
        message: 'Verification token expired',
      };
    }

    // Mark as verified
    await this.db.query(
      `UPDATE email_verifications
       SET verified_at = NOW()
       WHERE id = $1`,
      [record.id]
    );

    return {
      success: true,
      userId: record.user_id,
      message: 'Email verified successfully',
    };
  }

  /**
   * Check if user's email is verified
   * @param userId User ID
   * @returns True if email is verified
   */
  async isEmailVerified(userId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT verified_at
       FROM email_verifications
       WHERE user_id = $1 AND verified_at IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Resend verification email
   * @param userId User ID
   * @returns Success status
   */
  async resendVerificationEmail(userId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    if (!this.emailService) {
      return {
        success: false,
        message: 'Email service not configured',
      };
    }

    // Check if already verified
    const isVerified = await this.isEmailVerified(userId);
    if (isVerified) {
      return {
        success: false,
        message: 'Email already verified',
      };
    }

    // Get user info
    const user = await this.getUserById(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    try {
      // Generate new verification token
      const verificationToken = await this.generateEmailVerificationToken(userId);
      const verificationUrl = this.baseUrl
        ? `${this.baseUrl}/verify-email/${verificationToken}`
        : `http://localhost:3000/verify-email/${verificationToken}`;

      // Send verification email
      await this.emailService.sendTemplate('verify-email', {
        to: user.email,
        data: {
          username: user.username,
          email: user.email,
          verificationUrl,
          expiresIn: '24 hours',
        },
      });

      return {
        success: true,
        message: 'Verification email sent',
      };
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return {
        success: false,
        message: 'Failed to send verification email',
      };
    }
  }
}
