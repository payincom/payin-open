/**
 * Demo Organizations and Users Generator
 *
 * Generates demo organizations and users with proper authentication
 */

import { Pool } from 'pg';
import { hash } from 'bcrypt';
import { DEMO_ORGANIZATIONS, DEMO_USERS } from './constants.js';

const BCRYPT_ROUNDS = 10;

/**
 * Generate demo organizations and users
 */
export async function generateOrganizations(db: Pool): Promise<void> {
  console.log('  📂 Creating organizations...');

  // 1. Insert organizations
  for (const org of DEMO_ORGANIZATIONS) {
    await db.query(
      `INSERT INTO organizations (id, slug, name, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [org.id, org.slug, org.name, org.description]
    );
  }
  console.log(`     ✓ Created ${DEMO_ORGANIZATIONS.length} organizations`);

  // 2. Insert users with hashed passwords
  console.log('  👥 Creating users...');
  for (const user of DEMO_USERS) {
    const passwordHash = await hash(user.password, BCRYPT_ROUNDS);

    await db.query(
      `INSERT INTO users (id, username, email, password_hash, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.username, user.email, passwordHash]
    );
  }
  console.log(`     ✓ Created ${DEMO_USERS.length} users`);

  // 3. Insert organization memberships
  console.log('  🔗 Creating organization memberships...');
  for (const user of DEMO_USERS) {
    await db.query(
      `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [user.organizationId, user.id, user.role]
    );
  }
  console.log(`     ✓ Created ${DEMO_USERS.length} memberships`);
}

/**
 * Get organization by slug helper
 */
export function getOrgById(orgId: string) {
  return DEMO_ORGANIZATIONS.find(org => org.id === orgId);
}

/**
 * Get users by organization
 */
export function getUsersByOrg(orgId: string) {
  return DEMO_USERS.filter(user => user.organizationId === orgId);
}

/**
 * Get owner user for organization
 */
export function getOwnerUser(orgId: string) {
  return DEMO_USERS.find(user => user.organizationId === orgId && user.role === 'owner');
}

/**
 * Add admin user to demo organizations
 * This allows the default admin user to access and view demo data
 */
export async function addAdminUserToOrganizations(db: Pool): Promise<void> {
  console.log('  👤 Adding admin user to demo organizations...');

  // Find the admin user
  const adminResult = await db.query(
    `SELECT id FROM users WHERE username = 'admin' LIMIT 1`
  );

  if (adminResult.rows.length === 0) {
    console.log('     ⚠ Admin user not found, skipping');
    return;
  }

  const adminUserId = adminResult.rows[0].id;

  // Add admin to all demo organizations as admin role
  let added = 0;
  for (const org of DEMO_ORGANIZATIONS) {
    await db.query(
      `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
       VALUES ($1, $2, 'admin', NOW())
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [org.id, adminUserId]
    );
    added++;
  }

  console.log(`     ✓ Added admin user to ${added} demo organizations`);
}
