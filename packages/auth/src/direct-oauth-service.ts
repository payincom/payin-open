/**
 * Direct OAuth Service
 * Handles OAuth login directly with Google/GitHub (no Supabase)
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { UserPublic } from './types/index.js';

export interface DirectOAuthServiceOptions {
  db: Pool;
  jwtSecret: string;
  tokenExpiration?: string;
  google?: {
    clientId: string;
    clientSecret: string;
  };
  github?: {
    clientId: string;
    clientSecret: string;
  };
}

export interface OAuthCallbackResult {
  success: boolean;
  token?: string;
  user?: UserPublic;
  error?: string;
  isNewUser?: boolean;
}

export class DirectOAuthService {
  private readonly db: Pool;
  private readonly jwtSecret: string;
  private readonly tokenExpiration: string;
  private readonly google?: { clientId: string; clientSecret: string };
  private readonly github?: { clientId: string; clientSecret: string };

  constructor(options: DirectOAuthServiceOptions) {
    this.db = options.db;
    this.jwtSecret = options.jwtSecret;
    this.tokenExpiration = options.tokenExpiration || '24h';
    this.google = options.google;
    this.github = options.github;
  }

  /**
   * Get OAuth config (which providers are enabled)
   */
  getConfig() {
    return {
      google: this.google ? { clientId: this.google.clientId } : null,
      github: this.github ? { clientId: this.github.clientId } : null,
    };
  }

  /**
   * Generate Google OAuth redirect URL
   */
  getGoogleRedirectUrl(redirectUri: string, state: string): string {
    if (!this.google) throw new Error('Google OAuth not configured');
    const params = new URLSearchParams({
      client_id: this.google.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /**
   * Generate GitHub OAuth redirect URL
   */
  getGitHubRedirectUrl(redirectUri: string, state: string): string {
    if (!this.github) throw new Error('GitHub OAuth not configured');
    const params = new URLSearchParams({
      client_id: this.github.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(code: string, redirectUri: string): Promise<OAuthCallbackResult> {
    if (!this.google) return { success: false, error: 'Google OAuth not configured' };

    try {
      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.google.clientId,
          client_secret: this.google.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenRes.json() as Record<string, any>;
      if (tokens.error) {
        return { success: false, error: `Google token error: ${tokens.error_description || tokens.error}` };
      }

      // Get user info
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const googleUser = await userRes.json() as Record<string, any>;

      if (!googleUser.email) {
        return { success: false, error: 'Email not provided by Google' };
      }

      return this.findOrCreateAndSign({
        email: googleUser.email as string,
        provider: 'google',
        providerId: String(googleUser.id),
        avatarUrl: googleUser.picture as string | undefined,
      });
    } catch (error) {
      console.error('Google OAuth error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Google OAuth failed' };
    }
  }

  /**
   * Handle GitHub OAuth callback
   */
  async handleGitHubCallback(code: string, redirectUri: string): Promise<OAuthCallbackResult> {
    if (!this.github) return { success: false, error: 'GitHub OAuth not configured' };

    try {
      // Exchange code for access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: this.github.clientId,
          client_secret: this.github.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });
      const tokens = await tokenRes.json() as Record<string, any>;
      if (tokens.error) {
        return { success: false, error: `GitHub token error: ${tokens.error_description || tokens.error}` };
      }

      // Get user info
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      const githubUser = await userRes.json() as Record<string, any>;

      // Get email (may need separate request if email is private)
      let email = githubUser.email as string | undefined;
      if (!email) {
        const emailRes = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        const emails = await emailRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
        const primary = emails.find((e) => e.primary && e.verified);
        email = primary?.email || emails[0]?.email;
      }

      if (!email) {
        return { success: false, error: 'Email not provided by GitHub' };
      }

      return this.findOrCreateAndSign({
        email,
        provider: 'github',
        providerId: String(githubUser.id),
        avatarUrl: githubUser.avatar_url as string | undefined,
      });
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'GitHub OAuth failed' };
    }
  }

  /**
   * Find or create user, then sign JWT
   */
  private async findOrCreateAndSign(params: {
    email: string;
    provider: string;
    providerId: string;
    avatarUrl?: string;
  }): Promise<OAuthCallbackResult> {
    const { email, provider, providerId, avatarUrl } = params;

    // Find existing user by email
    const existing = await this.db.query(
      `SELECT id, username, email, is_active AS "isActive",
              is_superadmin AS "isSuperadmin",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE email = $1`,
      [email]
    );

    let user: UserPublic;
    let isNewUser = false;

    if (existing.rows.length > 0) {
      user = existing.rows[0];
      await this.db.query(
        `UPDATE users SET oauth_provider = $1, oauth_provider_id = $2,
         oauth_avatar_url = $3, auth_type = 'oauth', updated_at = NOW()
         WHERE id = $4`,
        [provider, providerId, avatarUrl, user.id]
      );
    } else {
      const userId = randomUUID();
      const baseUsername = email.split('@')[0]!.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const username = `${baseUsername}_${Math.random().toString(36).substring(2, 6)}`;

      const result = await this.db.query(
        `INSERT INTO users (id, username, email, password_hash, is_active, is_superadmin,
           oauth_provider, oauth_provider_id, oauth_avatar_url, auth_type)
         VALUES ($1, $2, $3, NULL, true, false, $4, $5, $6, 'oauth')
         RETURNING id, username, email, is_active AS "isActive",
                   is_superadmin AS "isSuperadmin",
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [userId, username, email, provider, providerId, avatarUrl]
      );
      user = result.rows[0];
      isNewUser = true;
    }

    // Sign JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      this.jwtSecret,
      { expiresIn: this.tokenExpiration } as SignOptions
    );

    // Create session
    const sessionId = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    await this.db.query(
      `INSERT INTO sessions (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)`,
      [sessionId, user.id, token, expiresAt]
    );

    return { success: true, token, user, isNewUser };
  }
}
