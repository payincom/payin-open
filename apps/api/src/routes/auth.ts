/**
 * Authentication Routes
 * Provides login, logout, and user management endpoints
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getAuth } from '../auth-instance.js';
import { getSocialAuth } from '../social-auth-instance.js';
import { getDirectOAuth } from '../direct-oauth-instance.js';
import { createAuthMiddleware } from '@payin/auth';
import { getOpenRuntimeOrganizationId, isOpenRuntime } from '../open-runtime.js';

const auth = new Hono();

// Lazy auth middleware - only gets Auth instance when request comes in
const authMiddleware = () => {
  return async (c: Context, next: Next) => {
    const middleware = createAuthMiddleware(getAuth());
    return await middleware(c, next);
  };
};

// ==================== Public Routes (No Auth Required) ====================

/**
 * Login
 * POST /auth/login
 * Body: { username, password }
 */
auth.post('/login', async (c) => {
  try {
    const authManager = getAuth();
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({
        success: false,
        error: 'Validation failed',
        message: 'Username and password are required'
      }, 400);
    }

    const result = await authManager.login({ username, password });

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Authentication failed',
        message: result.error
      }, 401);
    }

    return c.json({
      success: true,
      data: {
        token: result.token,
        user: result.user
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Get the API base URL (handles reverse proxy / Railway)
 */
function getApiBaseUrl(c: Context): string {
  // Trust X-Forwarded headers from reverse proxy
  const proto = c.req.header('x-forwarded-proto') || 'https';
  const host = c.req.header('x-forwarded-host') || c.req.header('host') || 'localhost';
  return `${proto}://${host}/api/v1`;
}

/**
 * OAuth Config - Returns available OAuth providers
 * GET /auth/oauth/config
 */
auth.get('/oauth/config', async (c) => {
  try {
    const directOAuth = getDirectOAuth();
    return c.json({ success: true, data: directOAuth.getConfig() });
  } catch {
    return c.json({ success: true, data: { google: null, github: null } });
  }
});

/**
 * Google OAuth - Redirect to Google login
 * GET /auth/oauth/google
 */
auth.get('/oauth/google', async (c) => {
  try {
    const directOAuth = getDirectOAuth();
    const apiBase = getApiBaseUrl(c);
    const redirectUri = c.req.query('redirect_uri') || `${apiBase}/auth/oauth/google/callback`;
    const frontendUrl = c.req.query('frontend_url') || '';
    const state = Buffer.from(JSON.stringify({ redirectUri, frontendUrl })).toString('base64url');
    const url = directOAuth.getGoogleRedirectUrl(redirectUri, state);
    return c.redirect(url);
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500);
  }
});

/**
 * Google OAuth Callback
 * GET /auth/oauth/google/callback
 */
auth.get('/oauth/google/callback', async (c) => {
  try {
    const directOAuth = getDirectOAuth();
    const code = c.req.query('code');
    const stateParam = c.req.query('state') || '';
    
    if (!code) return c.json({ success: false, error: 'Missing code' }, 400);
    
    let redirectUri = `${getApiBaseUrl(c)}/auth/oauth/google/callback`;
    let frontendUrl = '';
    try {
      const state = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
      redirectUri = state.redirectUri || redirectUri;
      frontendUrl = state.frontendUrl || '';
    } catch {}

    const result = await directOAuth.handleGoogleCallback(code, redirectUri);
    
    if (!result.success || !result.token) {
      const errorUrl = frontendUrl ? `${frontendUrl}/auth/callback?error=${encodeURIComponent(result.error || 'failed')}` : '';
      return errorUrl ? c.redirect(errorUrl) : c.json(result, 401);
    }

    // If this is a new user, create a personal organization
    if (result.isNewUser && result.user) {
      const authManager = getAuth();
      await authManager.organizations.createOrganization(result.user.id, {
        name: `${result.user.username}'s Organization`,
        slug: `${result.user.username}-org-${Date.now()}`
      });
    }

    if (frontendUrl) {
      return c.redirect(`${frontendUrl}/auth/callback?token=${result.token}&isNewUser=${result.isNewUser || false}`);
    }
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500);
  }
});

/**
 * GitHub OAuth - Redirect to GitHub login
 * GET /auth/oauth/github
 */
auth.get('/oauth/github', async (c) => {
  try {
    const directOAuth = getDirectOAuth();
    const apiBase = getApiBaseUrl(c);
    const redirectUri = c.req.query('redirect_uri') || `${apiBase}/auth/oauth/github/callback`;
    const frontendUrl = c.req.query('frontend_url') || '';
    const state = Buffer.from(JSON.stringify({ redirectUri, frontendUrl })).toString('base64url');
    const url = directOAuth.getGitHubRedirectUrl(redirectUri, state);
    return c.redirect(url);
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500);
  }
});

/**
 * GitHub OAuth Callback
 * GET /auth/oauth/github/callback
 */
auth.get('/oauth/github/callback', async (c) => {
  try {
    const directOAuth = getDirectOAuth();
    const code = c.req.query('code');
    const stateParam = c.req.query('state') || '';
    
    if (!code) return c.json({ success: false, error: 'Missing code' }, 400);
    
    let redirectUri = `${getApiBaseUrl(c)}/auth/oauth/github/callback`;
    let frontendUrl = '';
    try {
      const state = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
      redirectUri = state.redirectUri || redirectUri;
      frontendUrl = state.frontendUrl || '';
    } catch {}

    const result = await directOAuth.handleGitHubCallback(code, redirectUri);
    
    if (!result.success || !result.token) {
      const errorUrl = frontendUrl ? `${frontendUrl}/auth/callback?error=${encodeURIComponent(result.error || 'failed')}` : '';
      return errorUrl ? c.redirect(errorUrl) : c.json(result, 401);
    }

    if (result.isNewUser && result.user) {
      const authManager = getAuth();
      await authManager.organizations.createOrganization(result.user.id, {
        name: `${result.user.username}'s Organization`,
        slug: `${result.user.username}-org-${Date.now()}`
      });
    }

    if (frontendUrl) {
      return c.redirect(`${frontendUrl}/auth/callback?token=${result.token}&isNewUser=${result.isNewUser || false}`);
    }
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500);
  }
});

/**
 * OAuth Callback - Handle social login via Supabase Auth (legacy)
 * POST /auth/oauth/callback
 * Body: { supabase_token }
 */
auth.post('/oauth/callback', async (c) => {
  try {
    console.log('📝 OAuth callback received');
    const socialAuth = getSocialAuth();
    const authManager = getAuth();
    const { supabase_token } = await c.req.json();

    if (!supabase_token) {
      console.log('❌ Missing supabase_token');
      return c.json({
        success: false,
        error: 'Validation failed',
        message: 'supabase_token is required'
      }, 400);
    }

    console.log('🔐 Handling OAuth callback...');
    // Handle OAuth callback
    const result = await socialAuth.handleOAuthCallback(supabase_token);
    console.log('OAuth callback result:', { success: result.success, isNewUser: result.isNewUser, error: result.error });

    if (!result.success) {
      return c.json({
        success: false,
        error: 'OAuth authentication failed',
        message: result.error
      }, 401);
    }

    // If this is a new user, automatically create personal organization
    if (result.isNewUser && result.user) {
      console.log('🏢 Creating organization for new OAuth user:', result.user.username);
      const org = await authManager.organizations.createOrganization(result.user.id, {
        name: `${result.user.username}'s Organization`,
        slug: `${result.user.username}-org-${Date.now()}`
      });
      console.log('✅ Organization created:', org.id);
    }

    return c.json({
      success: true,
      data: {
        token: result.token,
        user: result.user,
        isNewUser: result.isNewUser
      }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Register - Creates user and automatically creates a personal organization
 * POST /auth/register
 * Body: { username, email, password }
 */
auth.post('/register', async (c) => {
  try {
    const authManager = getAuth();
    const { username, email, password } = await c.req.json();

    if (!username || !email || !password) {
      return c.json({
        success: false,
        error: 'Validation failed',
        message: 'Username, email and password are required'
      }, 400);
    }

    const openRuntime = isOpenRuntime();

    if (openRuntime) {
      const existingUsers = await authManager.listUsers();
      if (existingUsers.length > 0) {
        return c.json({
          success: false,
          error: 'Registration disabled',
          code: 'OPEN_REGISTRATION_LOCKED',
          message: 'PayIn Open registration is locked after the first operator is created.',
          suggestions: [
            'Use the existing Open operator account to create API keys.',
            'For additional operators, add them through a controlled local/admin workflow instead of public registration.',
            'If this is a fresh install, use a new empty database and run npm run open:init before first registration.'
          ]
        }, 403);
      }
    }

    // Step 1: Create user (validation happens in createUser)
    const user = await authManager.createUser({
      username,
      email,
      password
    });

    if (openRuntime) {
      const organizationId = getOpenRuntimeOrganizationId();
      await authManager.ensureDefaultOrganizationMembership(user.id, organizationId);

      return c.json({
        success: true,
        data: {
          user,
          organization: {
            id: organizationId,
            name: 'PayIn Open Merchant',
            role: 'owner'
          }
        },
        message: 'First PayIn Open operator registered and bound to the Open merchant-organization scope. Use X-Organization-Id with JWT operator requests.'
      }, 201);
    }

    // Step 2: Automatically create personal organization in hosted/Cloud runtime
    const organization = await authManager.organizations.createOrganization(user.id, {
      name: `${username}'s Organization`,
      slug: `${username}-org-${Date.now()}`
    });

    return c.json({
      success: true,
      data: {
        user,
        organization
      },
      message: 'User registered and personal organization created successfully'
    }, 201);
  } catch (error) {
    console.error('Register error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's a validation error or duplicate user error
    const isValidationError = errorMessage.includes('must') ||
                             errorMessage.includes('required') ||
                             errorMessage.includes('Invalid') ||
                             errorMessage.includes('already exists') ||
                             errorMessage.includes('cannot');

    return c.json({
      success: false,
      error: isValidationError ? 'Validation failed' : 'Internal server error',
      message: errorMessage
    }, isValidationError ? 400 : 500);
  }
});

// ==================== Protected Routes (Auth Required) ====================

/**
 * Logout
 * POST /auth/logout
 */
auth.post('/logout', authMiddleware(), async (c) => {
  try {
    const authManager = getAuth();
    const token = c.get('token');

    if (typeof token !== 'string' || token.trim() === '') {
      return c.json({
        success: false,
        error: 'Authentication failed',
        message: 'Authentication token is required'
      }, 401);
    }

    await authManager.logout(token);

    return c.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Get current user info
 * GET /auth/me
 */
auth.get('/me', authMiddleware(), async (c) => {
  try {
    const authManager = getAuth();
    const userId = c.get('userId') as string;
    const organizationId = c.get('organizationId') as string;

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({
        success: false,
        error: 'Authentication failed',
        message: 'User context is required'
      }, 401);
    }

    const user = await authManager.getUserById(userId);

    if (!user) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // Get current organization membership info
    let currentOrganization = null;
    let targetOrgId = organizationId;

    // If no organizationId provided, get user's first organization (for initial login)
    if (!targetOrgId) {
      const userOrgs = await authManager.organizations.listUserOrganizations(userId);
      if (userOrgs && userOrgs.length > 0) {
        targetOrgId = userOrgs[0].id;  // Use 'id', not 'organizationId'
      }
    }

    if (targetOrgId) {
      const membership = await authManager.organizations.getMember(targetOrgId, userId);
      if (membership) {
        const org = await authManager.organizations.getOrganizationById(targetOrgId);
        if (org) {
          currentOrganization = {
            id: org.id,
            name: org.name,
            slug: org.slug,
            role: membership.role,
            memberStatus: membership.status
          };
        }
      }
    }

    return c.json({
      success: true,
      data: {
        ...user,
        currentOrganization
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Set password for OAuth/magic link users
 * POST /auth/set-password
 * Body: { password }
 * Allows passwordless users to add password for traditional login
 */
auth.post('/set-password', authMiddleware(), async (c) => {
  try {
    const authManager = getAuth();
    const userId = c.get('userId') as string;
    const { password } = await c.req.json();

    if (!password) {
      return c.json({
        success: false,
        error: 'Validation failed',
        message: 'Password is required'
      }, 400);
    }

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({
        success: false,
        error: 'Authentication failed',
        message: 'User context is required'
      }, 401);
    }

    // Get user to check if password already exists
    const user = await authManager.getUserById(userId);
    if (!user) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // Check if user already has a password
    const userWithPassword = await authManager.getUserByUsername(user.username);
    if (userWithPassword && userWithPassword.passwordHash) {
      return c.json({
        success: false,
        error: 'Password already set',
        message: 'This account already has a password. Use PUT /auth/password to change it.'
      }, 400);
    }

    // Set password for passwordless user
    await authManager.updateUser(userId, { password });

    return c.json({
      success: true,
      message: 'Password set successfully. You can now use password login.'
    });
  } catch (error) {
    console.error('Set password error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Change password
 * PUT /auth/password
 * Body: { oldPassword, newPassword }
 */
auth.put('/password', authMiddleware(), async (c) => {
  try {
    const authManager = getAuth();
    const userId = c.get('userId') as string;
    const username = c.get('username');
    const { oldPassword, newPassword } = await c.req.json();

    if (!oldPassword || !newPassword) {
      return c.json({
        success: false,
        error: 'Validation failed',
        message: 'Old password and new password are required'
      }, 400);
    }

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({
        success: false,
        error: 'Authentication failed',
        message: 'User context is required'
      }, 401);
    }

    if (typeof username !== 'string' || username.trim() === '') {
      return c.json({
        success: false,
        error: 'Authentication failed',
        message: 'Username context is required'
      }, 401);
    }

    // Verify old password
    const loginResult = await authManager.login({ username, password: oldPassword });
    if (!loginResult.success) {
      return c.json({
        success: false,
        error: 'Authentication failed',
        message: 'Old password is incorrect'
      }, 401);
    }

    // Update password
    await authManager.updateUser(userId, { password: newPassword });

    return c.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ==================== Email Verification Routes ====================

/**
 * Verify email with token
 * GET /auth/verify-email/:token
 */
auth.get('/verify-email/:token', async (c) => {
  try {
    const authManager = getAuth();
    const token = c.req.param('token')!;

    if (!token) {
      return c.json({
        success: false,
        error: 'Validation failed',
        message: 'Verification token is required'
      }, 400);
    }

    const result = await authManager.verifyEmail(token);

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Verification failed',
        message: result.message
      }, 400);
    }

    return c.json({
      success: true,
      message: result.message,
      userId: result.userId
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Resend verification email
 * POST /auth/resend-verification
 * Requires authentication
 */
auth.post('/resend-verification', authMiddleware(), async (c) => {
  try {
    const authManager = getAuth();
    const userId = c.get('userId') as string;

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({
        success: false,
        error: 'Authentication failed',
        message: 'User ID not found'
      }, 401);
    }

    const result = await authManager.resendVerificationEmail(userId);

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Resend failed',
        message: result.message
      }, 400);
    }

    return c.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Check email verification status
 * GET /auth/email-verification-status
 * Requires authentication
 */
auth.get('/email-verification-status', authMiddleware(), async (c) => {
  try {
    const authManager = getAuth();
    const userId = c.get('userId') as string;

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({
        success: false,
        error: 'Authentication failed',
        message: 'User ID not found'
      }, 401);
    }

    const isVerified = await authManager.isEmailVerified(userId);

    return c.json({
      success: true,
      isVerified
    });
  } catch (error) {
    console.error('Check verification status error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default auth;
