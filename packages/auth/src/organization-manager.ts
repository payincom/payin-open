/**
 * Organization Manager
 * Handles organization and membership management for multi-tenancy
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  OrganizationRole,
  type Organization,
  type OrganizationMember,
  type OrganizationWithRole,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
  type UpdateMemberInput,
  type MembershipVerificationResult,
  type MemberStatus,
  type OrganizationPlan,
} from './types/organizations.js';

export class OrganizationManager {
  constructor(private readonly db: Pool) {}

  // ==================== Organization Management ====================

  /**
   * Create a new organization
   */
  async createOrganization(
    ownerId: string,
    input: CreateOrganizationInput
  ): Promise<Organization> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Generate slug if not provided
      const slug = input.slug || (await this.generateUniqueSlug(input.name));

      // Create organization
      const orgResult = await client.query(
        `INSERT INTO organizations (id, name, slug, website, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [randomUUID(), input.name, slug, input.website || null, input.description || null]
      );

      const org = orgResult.rows[0];

      // Add owner as first member
      await client.query(
        `INSERT INTO organization_members (
          id, organization_id, user_id, role, status
        ) VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), org.id, ownerId, OrganizationRole.OWNER, 'active']
      );

      await client.query('COMMIT');

      return this.mapOrganization(org);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(orgId: string): Promise<Organization | null> {
    const result = await this.db.query(
      `SELECT * FROM organizations WHERE id = $1`,
      [orgId]
    );

    return result.rows[0] ? this.mapOrganization(result.rows[0]) : null;
  }

  /**
   * Get organization by slug
   */
  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const result = await this.db.query(
      `SELECT * FROM organizations WHERE slug = $1`,
      [slug]
    );

    return result.rows[0] ? this.mapOrganization(result.rows[0]) : null;
  }

  /**
   * Update organization
   */
  async updateOrganization(
    orgId: string,
    input: UpdateOrganizationInput
  ): Promise<Organization> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }

    if (input.slug !== undefined) {
      updates.push(`slug = $${paramIndex++}`);
      values.push(input.slug);
    }

    if (input.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(input.avatarUrl);
    }

    if (input.website !== undefined) {
      updates.push(`website = $${paramIndex++}`);
      values.push(input.website);
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }

    if (input.planType !== undefined) {
      updates.push(`plan_type = $${paramIndex++}`);
      values.push(input.planType);
    }

    if (input.monthlyOrderLimit !== undefined) {
      updates.push(`monthly_order_limit = $${paramIndex++}`);
      values.push(input.monthlyOrderLimit);
    }

    updates.push('updated_at = NOW()');
    values.push(orgId);

    const result = await this.db.query(
      `UPDATE organizations SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return this.mapOrganization(result.rows[0]);
  }

  /**
   * Delete organization
   */
  async deleteOrganization(orgId: string): Promise<void> {
    await this.db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
  }

  /**
   * List organizations for a user
   */
  async listUserOrganizations(userId: string): Promise<OrganizationWithRole[]> {
    const result = await this.db.query(
      `SELECT o.*, om.role, om.status AS member_status
       FROM organizations o
       JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      avatarUrl: row.avatar_url,
      planType: row.plan_type as OrganizationPlan,
      role: row.role as OrganizationRole,
      memberStatus: row.member_status as MemberStatus,
      createdAt: row.created_at,
    }));
  }

  // ==================== Membership Management ====================

  /**
   * Verify user membership in an organization
   */
  async verifyMembership(
    userId: string,
    orgId: string
  ): Promise<MembershipVerificationResult> {
    const result = await this.db.query(
      `SELECT role, status FROM organization_members
       WHERE user_id = $1 AND organization_id = $2`,
      [userId, orgId]
    );

    if (result.rows.length === 0) {
      return { valid: false, error: 'Not a member of this organization' };
    }

    const member = result.rows[0];

    if (member.status !== 'active') {
      return {
        valid: false,
        role: member.role as OrganizationRole,
        status: member.status as MemberStatus,
        error: `Membership status is ${member.status}`,
      };
    }

    return {
      valid: true,
      role: member.role as OrganizationRole,
      status: member.status as MemberStatus,
    };
  }

  /**
   * Add a member to an organization
   */
  async addMember(
    orgId: string,
    userId: string,
    role: OrganizationRole,
    invitedBy?: string
  ): Promise<OrganizationMember> {
    const result = await this.db.query(
      `INSERT INTO organization_members (
        id, organization_id, user_id, role, status, invited_by, invited_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        randomUUID(),
        orgId,
        userId,
        role,
        'active',
        invitedBy || null,
        invitedBy ? new Date() : null,
      ]
    );

    return this.mapMember(result.rows[0]);
  }

  /**
   * Update member role or status
   */
  async updateMember(
    orgId: string,
    userId: string,
    input: UpdateMemberInput
  ): Promise<OrganizationMember> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(input.role);
    }

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }

    values.push(orgId, userId);

    const result = await this.db.query(
      `UPDATE organization_members SET ${updates.join(', ')}
       WHERE organization_id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    return this.mapMember(result.rows[0]);
  }

  /**
   * Remove a member from an organization
   */
  async removeMember(orgId: string, userId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [orgId, userId]
    );
  }

  /**
   * List all members of an organization
   */
  async listMembers(orgId: string): Promise<OrganizationMember[]> {
    const result = await this.db.query(
      `SELECT * FROM organization_members
       WHERE organization_id = $1
       ORDER BY created_at ASC`,
      [orgId]
    );

    return result.rows.map(this.mapMember);
  }

  /**
   * Get member by organization and user ID
   */
  async getMember(orgId: string, userId: string): Promise<OrganizationMember | null> {
    const result = await this.db.query(
      `SELECT * FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [orgId, userId]
    );

    return result.rows[0] ? this.mapMember(result.rows[0]) : null;
  }

  // ==================== Helper Methods ====================

  /**
   * Generate a unique slug from organization name
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const db = this.db;

    // Convert to lowercase and replace spaces/special chars with hyphens
    let baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let counter = 0;

    // Check if slug exists, append counter if needed
    while (true) {
      const result = await db.query(
        'SELECT EXISTS(SELECT 1 FROM organizations WHERE slug = $1)',
        [slug]
      );

      if (!result.rows[0].exists) {
        break;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }

  /**
   * Map database row to Organization type
   */
  private mapOrganization(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      avatarUrl: row.avatar_url,
      website: row.website,
      description: row.description,
      planType: row.plan_type as OrganizationPlan,
      monthlyOrderLimit: row.monthly_order_limit,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to OrganizationMember type
   */
  private mapMember(row: any): OrganizationMember {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role as OrganizationRole,
      status: row.status as MemberStatus,
      invitedBy: row.invited_by,
      invitedAt: row.invited_at,
      joinedAt: row.joined_at,
      createdAt: row.created_at,
    };
  }

  // ==================== Ownership Transfer ====================

  /**
   * Initiate ownership transfer
   * Only current owner can initiate transfer
   */
  async initiateOwnershipTransfer(
    orgId: string,
    currentOwnerId: string,
    input: import('./types/organizations.js').InitiateTransferInput
  ): Promise<import('./types/organizations.js').OwnershipTransferRequest> {
    // Verify current user is the owner
    const currentMember = await this.db.query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [orgId, currentOwnerId]
    );

    if (!currentMember.rows[0] || currentMember.rows[0].role !== 'owner') {
      throw new Error('Only the current owner can initiate ownership transfer');
    }

    // Verify target user is a member
    const targetMember = await this.db.query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [orgId, input.toUserId]
    );

    if (!targetMember.rows[0]) {
      throw new Error('Target user must be a member of the organization');
    }

    // Check if there's already a pending transfer
    const existingTransfer = await this.db.query(
      `SELECT id FROM ownership_transfer_requests
       WHERE organization_id = $1 AND status = 'pending'`,
      [orgId]
    );

    if (existingTransfer.rows[0]) {
      throw new Error('There is already a pending ownership transfer for this organization');
    }

    // Create transfer request
    const expiresInDays = input.expiresInDays || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const result = await this.db.query(
      `INSERT INTO ownership_transfer_requests (
        organization_id, from_user_id, to_user_id, status, initiated_by, message, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [orgId, currentOwnerId, input.toUserId, 'pending', currentOwnerId, input.message || null, expiresAt]
    );

    // Log audit
    await this.db.query(
      `INSERT INTO ownership_transfer_audit (transfer_request_id, action, performed_by)
       VALUES ($1, $2, $3)`,
      [result.rows[0].id, 'initiated', currentOwnerId]
    );

    return this.mapTransferRequest(result.rows[0]);
  }

  /**
   * Accept ownership transfer
   * Target user accepts the transfer
   */
  async acceptOwnershipTransfer(
    transferRequestId: string,
    acceptingUserId: string
  ): Promise<import('./types/organizations.js').OwnershipTransferRequest> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Get transfer request
      const transferResult = await client.query(
        'SELECT * FROM ownership_transfer_requests WHERE id = $1',
        [transferRequestId]
      );

      if (!transferResult.rows[0]) {
        throw new Error('Transfer request not found');
      }

      const transfer = transferResult.rows[0];

      // Verify the accepting user is the target
      if (transfer.to_user_id !== acceptingUserId) {
        throw new Error('Only the designated recipient can accept this transfer');
      }

      // Check status
      if (transfer.status !== 'pending') {
        throw new Error(`Transfer request is ${transfer.status}, cannot accept`);
      }

      // Check expiration
      if (new Date() > new Date(transfer.expires_at)) {
        await client.query(
          'UPDATE ownership_transfer_requests SET status = $1 WHERE id = $2',
          ['expired', transferRequestId]
        );
        throw new Error('Transfer request has expired');
      }

      // Update transfer status to accepted
      await client.query(
        `UPDATE ownership_transfer_requests
         SET status = $1, accepted_at = NOW()
         WHERE id = $2`,
        ['accepted', transferRequestId]
      );

      // Execute the transfer: demote current owner to admin, promote new user to owner
      await client.query(
        'UPDATE organization_members SET role = $1 WHERE organization_id = $2 AND user_id = $3',
        ['admin', transfer.organization_id, transfer.from_user_id]
      );

      await client.query(
        'UPDATE organization_members SET role = $1 WHERE organization_id = $2 AND user_id = $3',
        ['owner', transfer.organization_id, transfer.to_user_id]
      );

      // Mark transfer as completed
      await client.query(
        `UPDATE ownership_transfer_requests
         SET status = $1, completed_at = NOW()
         WHERE id = $2`,
        ['completed', transferRequestId]
      );

      // Log audit
      await client.query(
        `INSERT INTO ownership_transfer_audit (transfer_request_id, action, performed_by)
         VALUES ($1, $2, $3)`,
        [transferRequestId, 'accepted', acceptingUserId]
      );

      await client.query(
        `INSERT INTO ownership_transfer_audit (transfer_request_id, action, performed_by)
         VALUES ($1, $2, $3)`,
        [transferRequestId, 'completed', acceptingUserId]
      );

      await client.query('COMMIT');

      // Return updated transfer request
      const updatedResult = await this.db.query(
        'SELECT * FROM ownership_transfer_requests WHERE id = $1',
        [transferRequestId]
      );

      return this.mapTransferRequest(updatedResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject ownership transfer
   */
  async rejectOwnershipTransfer(
    transferRequestId: string,
    rejectingUserId: string
  ): Promise<import('./types/organizations.js').OwnershipTransferRequest> {
    // Get transfer request
    const transferResult = await this.db.query(
      'SELECT * FROM ownership_transfer_requests WHERE id = $1',
      [transferRequestId]
    );

    if (!transferResult.rows[0]) {
      throw new Error('Transfer request not found');
    }

    const transfer = transferResult.rows[0];

    // Verify the rejecting user is the target
    if (transfer.to_user_id !== rejectingUserId) {
      throw new Error('Only the designated recipient can reject this transfer');
    }

    // Check status
    if (transfer.status !== 'pending') {
      throw new Error(`Transfer request is ${transfer.status}, cannot reject`);
    }

    // Update status
    await this.db.query(
      `UPDATE ownership_transfer_requests
       SET status = $1, rejected_at = NOW()
       WHERE id = $2`,
      ['rejected', transferRequestId]
    );

    // Log audit
    await this.db.query(
      `INSERT INTO ownership_transfer_audit (transfer_request_id, action, performed_by)
       VALUES ($1, $2, $3)`,
      [transferRequestId, 'rejected', rejectingUserId]
    );

    // Return updated transfer request
    const updatedResult = await this.db.query(
      'SELECT * FROM ownership_transfer_requests WHERE id = $1',
      [transferRequestId]
    );

    return this.mapTransferRequest(updatedResult.rows[0]);
  }

  /**
   * Cancel ownership transfer
   * Owner can cancel pending transfer
   */
  async cancelOwnershipTransfer(
    transferRequestId: string,
    cancellingUserId: string
  ): Promise<import('./types/organizations.js').OwnershipTransferRequest> {
    // Get transfer request
    const transferResult = await this.db.query(
      'SELECT * FROM ownership_transfer_requests WHERE id = $1',
      [transferRequestId]
    );

    if (!transferResult.rows[0]) {
      throw new Error('Transfer request not found');
    }

    const transfer = transferResult.rows[0];

    // Verify the cancelling user is the owner who initiated
    if (transfer.from_user_id !== cancellingUserId) {
      throw new Error('Only the owner who initiated the transfer can cancel it');
    }

    // Check status
    if (transfer.status !== 'pending') {
      throw new Error(`Transfer request is ${transfer.status}, cannot cancel`);
    }

    // Update status
    await this.db.query(
      `UPDATE ownership_transfer_requests
       SET status = $1, cancelled_at = NOW()
       WHERE id = $2`,
      ['cancelled', transferRequestId]
    );

    // Log audit
    await this.db.query(
      `INSERT INTO ownership_transfer_audit (transfer_request_id, action, performed_by)
       VALUES ($1, $2, $3)`,
      [transferRequestId, 'cancelled', cancellingUserId]
    );

    // Return updated transfer request
    const updatedResult = await this.db.query(
      'SELECT * FROM ownership_transfer_requests WHERE id = $1',
      [transferRequestId]
    );

    return this.mapTransferRequest(updatedResult.rows[0]);
  }

  /**
   * Get pending transfer request for organization
   */
  async getPendingTransfer(orgId: string): Promise<import('./types/organizations.js').OwnershipTransferRequest | null> {
    const result = await this.db.query(
      `SELECT * FROM ownership_transfer_requests
       WHERE organization_id = $1 AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId]
    );

    return result.rows[0] ? this.mapTransferRequest(result.rows[0]) : null;
  }

  /**
   * Map database row to OwnershipTransferRequest type
   */
  private mapTransferRequest(row: any): import('./types/organizations.js').OwnershipTransferRequest {
    return {
      id: row.id,
      organizationId: row.organization_id,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      status: row.status,
      initiatedBy: row.initiated_by,
      message: row.message,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
      rejectedAt: row.rejected_at ? new Date(row.rejected_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
      metadata: row.metadata,
    } as import('./types/organizations.js').OwnershipTransferRequest;
  }
}
