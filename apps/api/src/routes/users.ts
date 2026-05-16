/**
 * User Management Routes (Admin Only)
 * Provides CRUD operations for user accounts
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { getAuth } from '../auth-instance.js';
import { createAuthMiddleware } from '@payin/auth';

const users = new Hono();

// Lazy middleware factories - only get Auth instance when request comes in
const authMiddleware = () => {
  return async (c: Context, next: Next) => {
    const middleware = createAuthMiddleware(getAuth());
    return await middleware(c, next);
  };
};


// ==================== Admin-Only Routes ====================

/**
 * List all users
 * GET /users
 * Required permission: users:read
 */
users.get(
  '/',
  authMiddleware(),
  async (c) => {
    try {
      const authManager = getAuth();
      const usersList = await authManager.listUsers();

      return c.json({
        success: true,
        data: usersList
      });
    } catch (error) {
      console.error('List users error:', error);
      return c.json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Get user by ID
 * GET /users/:userId
 * Required permission: users:read
 */
users.get(
  '/:userId',
  authMiddleware(),
  async (c) => {
    try {
      const authManager = getAuth();
      const userId = c.req.param('userId')!;

      const user = await authManager.getUserById(userId);

      if (!user) {
        return c.json({
          success: false,
          error: 'User not found'
        }, 404);
      }

      return c.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get user error:', error);
      return c.json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Create new user
 * POST /users
 * Body: { username, email, password, role }
 * Required permission: users:write
 */
users.post(
  '/',
  authMiddleware(),
  async (c) => {
    try {
      const authManager = getAuth();
      const { username, email, password, role } = await c.req.json();

      // Validation
      if (!username || !email || !password || !role) {
        return c.json({
          success: false,
          error: 'Validation failed',
          message: 'Username, email, password, and role are required'
        }, 400);
      }

      // Validate role
      if (!['admin', 'operator', 'viewer'].includes(role)) {
        return c.json({
          success: false,
          error: 'Validation failed',
          message: 'Role must be one of: admin, operator, viewer'
        }, 400);
      }

      const newUser = await authManager.createUser({
        username,
        email,
        password
      });

      return c.json({
        success: true,
        data: newUser,
        message: 'User created successfully'
      }, 201);
    } catch (error) {
      console.error('Create user error:', error);
      return c.json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Update user
 * PUT /users/:userId
 * Body: { email?, password?, role?, isActive? }
 * Required permission: users:write
 */
users.put(
  '/:userId',
  authMiddleware(),
  async (c) => {
    try {
      const authManager = getAuth();
      const userId = c.req.param('userId')!;
      const updates = await c.req.json();

      // Validate role if provided
      if (updates.role && !['admin', 'operator', 'viewer'].includes(updates.role)) {
        return c.json({
          success: false,
          error: 'Validation failed',
          message: 'Role must be one of: admin, operator, viewer'
        }, 400);
      }

      const { role: _ignoredRole, ...userUpdates } = updates;

      const updatedUser = await authManager.updateUser(userId, userUpdates);

      return c.json({
        success: true,
        data: updatedUser,
        message: 'User updated successfully'
      });
    } catch (error) {
      console.error('Update user error:', error);
      return c.json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

/**
 * Delete user
 * DELETE /users/:userId
 * Required permission: users:delete
 */
users.delete(
  '/:userId',
  authMiddleware(),
  async (c) => {
    try {
      const authManager = getAuth();
      const userId = c.req.param('userId')!;
      const currentUserId = c.get('userId') as string;

      // Prevent self-deletion
      if (userId === currentUserId) {
        return c.json({
          success: false,
          error: 'Forbidden',
          message: 'Cannot delete your own account'
        }, 403);
      }

      await authManager.deleteUser(userId);

      return c.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      return c.json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

export default users;
