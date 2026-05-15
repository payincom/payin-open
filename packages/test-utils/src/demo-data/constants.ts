/**
 * Demo Data Constants
 *
 * Fixed UUIDs and configurations for demo organizations and users
 */

export interface DemoOrganization {
  id: string;
  slug: string;
  name: string;
  description: string;
  mnemonic: string; // Each org has its own HD wallet
}

export interface DemoUser {
  id: string;
  username: string;
  email: string;
  password: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

/**
 * Demo Organizations (Fixed UUIDs for consistency)
 */
export const DEMO_ORGANIZATIONS: readonly DemoOrganization[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    slug: 'tech-corp',
    name: 'TechCorp',
    description: 'Technology solutions provider',
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', // BIP39 test mnemonic
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    slug: 'game-studio',
    name: 'GameStudio',
    description: 'Online gaming platform',
    mnemonic: 'legal winner thank year wave sausage worth useful legal winner thank yellow', // Different mnemonic
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    slug: 'e-commerce',
    name: 'ECommerce',
    description: 'E-commerce marketplace',
    mnemonic: 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above', // Different mnemonic
  },
] as const;

/**
 * Demo Users (Fixed UUIDs for consistency)
 */
export const DEMO_USERS: readonly DemoUser[] = [
  // TechCorp users
  {
    id: '650e8400-e29b-41d4-a716-446655440001',
    username: 'alice_owner',
    email: 'alice.owner@techcorp.com',
    password: 'Test1234!',
    organizationId: '550e8400-e29b-41d4-a716-446655440001',
    role: 'owner',
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440002',
    username: 'alice_admin',
    email: 'alice.admin@techcorp.com',
    password: 'Test1234!',
    organizationId: '550e8400-e29b-41d4-a716-446655440001',
    role: 'admin',
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440003',
    username: 'alice_member',
    email: 'alice.member@techcorp.com',
    password: 'Test1234!',
    organizationId: '550e8400-e29b-41d4-a716-446655440001',
    role: 'member',
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440004',
    username: 'alice_viewer',
    email: 'alice.viewer@techcorp.com',
    password: 'Test1234!',
    organizationId: '550e8400-e29b-41d4-a716-446655440001',
    role: 'viewer',
  },

  // GameStudio users
  {
    id: '650e8400-e29b-41d4-a716-446655440005',
    username: 'bob_owner',
    email: 'bob.owner@gamestudio.com',
    password: 'Test1234!',
    organizationId: '550e8400-e29b-41d4-a716-446655440002',
    role: 'owner',
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440006',
    username: 'bob_admin',
    email: 'bob.admin@gamestudio.com',
    password: 'Test1234!',
    organizationId: '550e8400-e29b-41d4-a716-446655440002',
    role: 'admin',
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440007',
    username: 'bob_member',
    email: 'bob.member@gamestudio.com',
    password: 'Test1234!',
    organizationId: '550e8400-e29b-41d4-a716-446655440002',
    role: 'member',
  },

  // ECommerce users
  {
    id: '650e8400-e29b-41d4-a716-446655440008',
    username: 'carol_owner',
    email: 'carol.owner@ecommerce.com',
    password: 'Test1234!',
    organizationId: '550e8400-e29b-41d4-a716-446655440003',
    role: 'owner',
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440009',
    username: 'carol_viewer',
    email: 'carol.viewer@ecommerce.com',
    password: 'Test1234!',
    organizationId: '550e8400-e29b-41d4-a716-446655440003',
    role: 'viewer',
  },
] as const;

/**
 * Address pool configuration
 */
export const ADDRESS_POOL_CONFIG = {
  perOrganization: {
    evm: 30,       // 30 EVM addresses per org (enough for demos)
    solana: 15,    // 15 Solana addresses per org
    tron: 15,      // 15 Tron addresses per org (currently mock)
  },
} as const;

/**
 * Demo data counts
 */
export const DEMO_DATA_COUNTS = {
  ordersPerOrg: 8,           // 8 orders per organization (various states)
  depositBindingsPerOrg: 5,  // 5 deposit bindings per organization
  paymentLinksPerOrg: 3,     // 3 payment links per organization
} as const;
