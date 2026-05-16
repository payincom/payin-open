/**
 * Organization Management API Routes
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import type { OrganizationRole } from '@payin/auth';
import { createAuthMiddleware } from '@payin/auth';
import { getAuth } from '../auth-instance.js';

const app = new Hono();

// Lazy auth middleware - requires organization context
const requireAuth = () => {
  return async (c: Context, next: Next) => {
    const middleware = createAuthMiddleware(getAuth());
    return await middleware(c, next);
  };
};

// Basic JWT auth - no organization context required
const requireBasicAuth = () => {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.substring(7);
    const authManager = getAuth();
    const verification = await authManager.verifyToken(token);

    if (!verification.valid || !verification.userId || !verification.username) {
      return c.json({ error: 'Unauthorized', message: verification.error || 'Invalid token' }, 401);
    }

    c.set('userId', verification.userId);
    c.set('username', verification.username);
    c.set('token', token);

    await next();
  };
};

// ==================== Organization Management ====================

/**
 * List user's organizations
 * GET /api/organizations
 */
app.get('/', requireBasicAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const userId = c.get('userId') as string;

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const organizations = await authManager.organizations.listUserOrganizations(userId);
    return c.json({ organizations });
  } catch (error: any) {
    return c.json({ error: 'Failed to list organizations', details: error.message }, 500);
  }
});

/**
 * Get organization details
 * GET /api/organizations/:orgId
 */
app.get('/:orgId', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    // Use organizationId from auth context (already verified by middleware)
    const orgId = c.get('organizationId') as string;
    const organizationRole = c.get('organizationRole');

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    const organization = await authManager.organizations.getOrganizationById(orgId);
    if (!organization) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    return c.json({ organization, role: typeof organizationRole === 'string' ? organizationRole : null });
  } catch (error: any) {
    return c.json({ error: 'Failed to get organization', details: error.message }, 500);
  }
});

/**
 * Create new organization
 * POST /api/organizations
 */
app.post('/', requireBasicAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const userId = c.get('userId') as string;
    const body = await c.req.json();
    const { name, slug, website, description } = body;

    if (!name) {
      return c.json({ error: 'Organization name is required' }, 400);
    }

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const organization = await authManager.organizations.createOrganization(userId, {
      name, slug, website, description
    });

    return c.json({ organization }, 201);
  } catch (error: any) {
    if (error.message.includes('duplicate') || error.code === '23505') {
      return c.json({ error: 'Organization slug already exists' }, 409);
    }
    return c.json({ error: 'Failed to create organization', details: error.message }, 500);
  }
});

/**
 * Update organization
 * PATCH /api/organizations/:orgId
 */
app.patch('/:orgId', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const orgId = c.get('organizationId') as string;
    const organizationRole = c.get('organizationRole');
    const body = await c.req.json();

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    if (typeof organizationRole !== 'string' || (organizationRole !== 'owner' && organizationRole !== 'admin')) {
      return c.json({ error: 'Insufficient permissions to update organization' }, 403);
    }

    const organization = await authManager.organizations.updateOrganization(orgId, body);
    return c.json({ organization });
  } catch (error: any) {
    return c.json({ error: 'Failed to update organization', details: error.message }, 500);
  }
});

/**
 * Delete organization
 * DELETE /api/organizations/:orgId
 */
app.delete('/:orgId', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const orgId = c.get('organizationId') as string;
    const organizationRole = c.get('organizationRole');

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    if (typeof organizationRole !== 'string' || organizationRole !== 'owner') {
      return c.json({ error: 'Only organization owners can delete organizations' }, 403);
    }

    await authManager.organizations.deleteOrganization(orgId);
    return c.json({ message: 'Organization deleted successfully' });
  } catch (error: any) {
    return c.json({ error: 'Failed to delete organization', details: error.message }, 500);
  }
});

// ==================== Member Management ====================

/**
 * List organization members
 * GET /api/organizations/:orgId/members
 */
app.get('/:orgId/members', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const orgId = c.get('organizationId') as string;

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    const members = await authManager.organizations.listMembers(orgId);
    return c.json({ members });
  } catch (error: any) {
    return c.json({ error: 'Failed to list members', details: error.message }, 500);
  }
});

/**
 * Add member to organization
 * POST /api/organizations/:orgId/members
 */
app.post('/:orgId/members', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const orgId = c.get('organizationId') as string;
    const userId = c.get('userId') as string;
    const organizationRole = c.get('organizationRole');
    const body = await c.req.json();
    const { targetUserId, role } = body;

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    if (!targetUserId || !role) {
      return c.json({ error: 'targetUserId and role are required' }, 400);
    }

    if (typeof organizationRole !== 'string' || (organizationRole !== 'owner' && organizationRole !== 'admin')) {
      return c.json({ error: 'Insufficient permissions to add members' }, 403);
    }

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const member = await authManager.organizations.addMember(orgId, targetUserId, role as OrganizationRole, userId);
    return c.json({ member }, 201);
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ error: 'User is already a member of this organization' }, 409);
    }
    return c.json({ error: 'Failed to add member', details: error.message }, 500);
  }
});

/**
 * Update member role
 * PATCH /api/organizations/:orgId/members/:targetUserId
 */
app.patch('/:orgId/members/:targetUserId', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const orgId = c.get('organizationId') as string;
    const targetUserId = c.req.param('targetUserId')!;
    const organizationRole = c.get('organizationRole');
    const body = await c.req.json();
    const { role, status } = body;

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    if (typeof organizationRole !== 'string' || (organizationRole !== 'owner' && organizationRole !== 'admin')) {
      return c.json({ error: 'Insufficient permissions to update members' }, 403);
    }

    const member = await authManager.organizations.updateMember(orgId, targetUserId, { role, status });
    return c.json({ member });
  } catch (error: any) {
    return c.json({ error: 'Failed to update member', details: error.message }, 500);
  }
});

/**
 * Remove member from organization
 * DELETE /api/organizations/:orgId/members/:targetUserId
 */
app.delete('/:orgId/members/:targetUserId', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const orgId = c.get('organizationId') as string;
    const targetUserId = c.req.param('targetUserId')!;
    const userId = c.get('userId') as string;
    const organizationRole = c.get('organizationRole');

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    if (typeof organizationRole !== 'string' || (organizationRole !== 'owner' && organizationRole !== 'admin')) {
      return c.json({ error: 'Insufficient permissions to remove members' }, 403);
    }
    if (typeof userId === 'string' && targetUserId === userId && organizationRole === 'owner') {
      return c.json({ error: 'Organization owners cannot remove themselves' }, 400);
    }

    await authManager.organizations.removeMember(orgId, targetUserId);
    return c.json({ message: 'Member removed successfully' });
  } catch (error: any) {
    return c.json({ error: 'Failed to remove member', details: error.message }, 500);
  }
});

// ==================== API Key Management ====================

/**
 * List organization API keys
 * GET /api/organizations/:orgId/api-keys
 */
app.get('/:orgId/api-keys', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    // Use organizationId from auth context
    const orgId = c.get('organizationId') as string;

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    const apiKeys = await authManager.listApiKeys(orgId);
    return c.json({ apiKeys });
  } catch (error: any) {
    return c.json({ error: 'Failed to list API keys', details: error.message }, 500);
  }
});

/**
 * Create new API key
 * POST /api/organizations/:orgId/api-keys
 */
app.post('/:orgId/api-keys', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    // Use organizationId from auth context instead of param
    const orgId = c.get('organizationId') as string;
    const userId = c.get('userId') as string;
    const body = await c.req.json();
    const { name, expiresAt } = body;

    if (!name) {
      return c.json({ error: 'API key name is required' }, 400);
    }

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const result = await authManager.createApiKey(userId, orgId, {
      name,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return c.json(result, 201);
  } catch (error: any) {
    if (error.message.includes('Insufficient permissions')) {
      return c.json({ error: error.message }, 403);
    }
    return c.json({ error: 'Failed to create API key', details: error.message }, 500);
  }
});

/**
 * Revoke API key
 * DELETE /api/organizations/:orgId/api-keys/:keyId
 */
app.delete('/:orgId/api-keys/:keyId', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const orgId = c.get('organizationId') as string;
    const keyId = c.req.param('keyId')!;
    const organizationRole = c.get('organizationRole');

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    if (typeof organizationRole !== 'string' || (organizationRole !== 'owner' && organizationRole !== 'admin')) {
      return c.json({ error: 'Insufficient permissions to revoke API keys' }, 403);
    }

    const apiKey = await authManager.getApiKeyById(keyId);
    if (!apiKey || apiKey.organizationId !== orgId) {
      return c.json({ error: 'API key not found' }, 404);
    }

    await authManager.revokeApiKey(keyId);
    return c.json({ message: 'API key revoked successfully' });
  } catch (error: any) {
    return c.json({ error: 'Failed to revoke API key', details: error.message }, 500);
  }
});

// ==================== Ownership Transfer ====================

/**
 * Initiate ownership transfer
 * POST /api/organizations/:orgId/transfer
 */
app.post('/:orgId/transfer', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const orgId = c.get('organizationId') as string;
    const userId = c.get('userId') as string;
    const organizationRole = c.get('organizationRole');
    const body = await c.req.json();
    const { toUserId, message, expiresInDays } = body;

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    if (typeof organizationRole !== 'string' || organizationRole !== 'owner') {
      return c.json({ error: 'Only organization owners can initiate ownership transfer' }, 403);
    }

    if (!toUserId) {
      return c.json({ error: 'toUserId is required' }, 400);
    }

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const transferRequest = await authManager.organizations.initiateOwnershipTransfer(orgId, userId, {
      toUserId,
      message,
      expiresInDays
    });

    return c.json({ transferRequest }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to initiate ownership transfer', details: error.message }, 500);
  }
});

/**
 * Accept ownership transfer
 * POST /api/organizations/:orgId/transfer/:transferId/accept
 */
app.post('/:orgId/transfer/:transferId/accept', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const transferId = c.req.param('transferId')!;
    const userId = c.get('userId') as string;

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const transferRequest = await authManager.organizations.acceptOwnershipTransfer(transferId, userId);
    return c.json({ transferRequest });
  } catch (error: any) {
    return c.json({ error: 'Failed to accept ownership transfer', details: error.message }, 500);
  }
});

/**
 * Reject ownership transfer
 * POST /api/organizations/:orgId/transfer/:transferId/reject
 */
app.post('/:orgId/transfer/:transferId/reject', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const transferId = c.req.param('transferId')!;
   const userId = c.get('userId') as string;

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const transferRequest = await authManager.organizations.rejectOwnershipTransfer(transferId, userId);
    return c.json({ transferRequest });
  } catch (error: any) {
    return c.json({ error: 'Failed to reject ownership transfer', details: error.message }, 500);
  }
});

/**
 * Cancel ownership transfer
 * POST /api/organizations/:orgId/transfer/:transferId/cancel
 */
app.post('/:orgId/transfer/:transferId/cancel', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const transferId = c.req.param('transferId')!;
    const userId = c.get('userId') as string;

    if (typeof userId !== 'string' || userId.trim() === '') {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const transferRequest = await authManager.organizations.cancelOwnershipTransfer(transferId, userId);
    return c.json({ transferRequest });
  } catch (error: any) {
    return c.json({ error: 'Failed to cancel ownership transfer', details: error.message }, 500);
  }
});

/**
 * Get pending transfer for organization
 * GET /api/organizations/:orgId/transfer/pending
 */
app.get('/:orgId/transfer/pending', requireAuth(), async (c) => {
  try {
    const authManager = getAuth();
    const orgId = c.get('organizationId') as string;

    if (typeof orgId !== 'string' || orgId.trim() === '') {
      return c.json({ error: 'Organization context not found' }, 400);
    }

    const transferRequest = await authManager.organizations.getPendingTransfer(orgId);
    return c.json({ transferRequest });
  } catch (error: any) {
    return c.json({ error: 'Failed to get pending transfer', details: error.message }, 500);
  }
});

export default app;
