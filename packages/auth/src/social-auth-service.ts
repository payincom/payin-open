/**
 * Social Authentication Service
 * Handles OAuth login via Supabase Auth (Google, GitHub, etc.)
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { UserPublic } from './types/index.js';

export interface SocialAuthServiceOptions {
  /** Database connection pool (shared with AuthManager) */
  db: Pool;
  /** JWT secret for PayIn tokens */
  jwtSecret: string;
  /** JWT token expiration (default: 24h) */
  tokenExpiration?: string;
  /** Supabase project URL */
  supabaseUrl: string;
  /** Supabase anon key */
  supabaseAnonKey: string;
}

export interface SupabaseUser {
  id: string;
  email?: string;
  phone?: string;
  user_metadata: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
  app_metadata: {
    provider: 'google' | 'github' | 'email' | string;
    [key: string]: any;
  };
  created_at: string;
}

export interface OAuthCallbackResult {
  success: boolean;
  token?: string;
  user?: UserPublic;
  error?: string;
  /** Indicates if this is a new user (first time OAuth login) */
  isNewUser?: boolean;
}

export class SocialAuthService {
  private readonly db: Pool;
  private readonly jwtSecret: string;
  private readonly tokenExpiration: string;
  private readonly supabase: SupabaseClient;

  constructor(options: SocialAuthServiceOptions) {
    this.db = options.db;
    this.jwtSecret = options.jwtSecret;
    this.tokenExpiration = options.tokenExpiration || '24h';

    // Initialize Supabase client
    this.supabase = createClient(
      options.supabaseUrl,
      options.supabaseAnonKey
    );
  }

  /**
   * Handle OAuth callback from Supabase
   * This is called after user completes OAuth flow with provider
   */
  async handleOAuthCallback(supabaseAccessToken: string): Promise<OAuthCallbackResult> {
    try {
      // 1. Verify Supabase token and get user info
      const { data: { user: supabaseUser }, error } = await this.supabase.auth.getUser(
        supabaseAccessToken
      );

      if (error || !supabaseUser) {
        return {
          success: false,
          error: error?.message || 'Invalid Supabase token',
        };
      }

      // 2. Validate email (required for PayIn)
      if (!supabaseUser.email) {
        return {
          success: false,
          error: 'Email is required but not provided by OAuth provider',
        };
      }

      // 3. Extract user information
      const email = supabaseUser.email;
      const provider = supabaseUser.app_metadata?.provider || 'unknown';
      const avatarUrl = supabaseUser.user_metadata?.avatar_url;

      // 4. Find or create PayIn user
      const { user: payinUser, isNewUser } = await this.findOrCreateUser({
        email,
        supabaseUserId: supabaseUser.id,
        provider,
        avatarUrl,
      });

      // 5. Sign PayIn JWT token
      const payinToken = jwt.sign(
        {
          userId: payinUser.id,
          username: payinUser.username,
        },
        this.jwtSecret,
        { expiresIn: this.tokenExpiration } as SignOptions
      );

      // 6. Create PayIn session
      const sessionId = randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await this.db.query(
        `INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, payinUser.id, payinToken, expiresAt]
      );

      return {
        success: true,
        token: payinToken,
        user: payinUser,
        isNewUser,
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Find existing user by email or create new user
   */
  private async findOrCreateUser(params: {
    email: string;
    supabaseUserId: string;
    provider: string;
    avatarUrl?: string;
  }): Promise<{ user: UserPublic; isNewUser: boolean }> {
    const { email, supabaseUserId, provider, avatarUrl } = params;

    // Try to find existing user by email
    const existingUser = await this.db.query(
      `SELECT id, username, email, is_active AS "isActive",
              is_superadmin AS "isSuperadmin",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (existingUser.rows.length > 0) {
      // User exists - update OAuth info
      const user = existingUser.rows[0];

      // Determine auth_type based on provider
      const authType = provider === 'email' ? 'magic_link' : 'oauth';

      await this.db.query(
        `UPDATE users
         SET oauth_provider = $1,
             oauth_provider_id = $2,
             oauth_avatar_url = $3,
             auth_type = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [provider, supabaseUserId, avatarUrl, authType, user.id]
      );

      return { user, isNewUser: false };
    }

    // User doesn't exist - create new user
    const userId = randomUUID();
    const username = this.generateUsername(email);

    // Determine auth_type based on provider
    const authType = provider === 'email' ? 'magic_link' : 'oauth';

    // No password for OAuth/magic link users (password_hash = NULL)
    const result = await this.db.query(
      `INSERT INTO users (
         id, username, email, password_hash, is_active, is_superadmin,
         oauth_provider, oauth_provider_id, oauth_avatar_url, auth_type
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, username, email, is_active AS "isActive",
                 is_superadmin AS "isSuperadmin",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        userId,
        username,
        email,
        null, // password_hash is NULL for OAuth/magic link users
        true, // is_active
        false, // is_superadmin
        provider,
        supabaseUserId,
        avatarUrl,
        authType, // 'oauth' or 'magic_link'
      ]
    );

    return { user: result.rows[0], isNewUser: true };
  }

  /**
   * Generate username from email
   * Ensures uniqueness by appending random suffix if needed
   */
  private generateUsername(email: string): string {
    const emailParts = email.split('@');
    const baseUsername = (emailParts[0] || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `${baseUsername}_${randomSuffix}`;
  }

  /**
   * Sign out user from Supabase (optional, mainly for cleanup)
   */
  async signOut(supabaseAccessToken?: string): Promise<void> {
    if (supabaseAccessToken) {
      // Supabase client doesn't have admin.signOut, just use regular signOut
      await this.supabase.auth.signOut();
    }
  }
}
