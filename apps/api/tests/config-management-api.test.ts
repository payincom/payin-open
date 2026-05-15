/**
 * Configuration Management API Integration Tests
 *
 * Test scenarios:
 * 1. Super admin can manage global configs
 * 2. Organization owner/admin can manage organization configs
 * 3. Regular users cannot manage configs
 * 4. Configuration inheritance works correctly
 */

import { describe, test, expect, beforeAll } from 'vitest';

const API_BASE = 'http://localhost:3000/api/v1';

// Test users
const SUPER_ADMIN = {
  username: 'alice_owner',
  password: 'Test1234!',
  token: ''
};

const ORG_OWNER = {
  username: 'bob_owner',
  password: 'Test1234!',
  token: ''
};

const ORG_MEMBER = {
  username: 'bob_member',
  password: 'Test1234!',
  token: ''
};

// Test organization ID
const TECHCORP_ORG_ID = 'f060ae05-b98a-4296-8947-fa296edd8e32'; // TechCorp
const GAMESTUDIO_ORG_ID = '0c1f7859-b41a-45c5-a356-537d9372c7fd'; // GameStudio

/**
 * Helper: Login and get JWT token
 */
async function login(username: string, password: string): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    throw new Error(`Login failed for ${username}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.token;
}

/**
 * Setup: Login all test users
 */
beforeAll(async () => {
  SUPER_ADMIN.token = await login(SUPER_ADMIN.username, SUPER_ADMIN.password);
  ORG_OWNER.token = await login(ORG_OWNER.username, ORG_OWNER.password);
  ORG_MEMBER.token = await login(ORG_MEMBER.username, ORG_MEMBER.password);

  console.log('✅ All test users logged in');
});

describe('Configuration Management API', () => {

  // ==================== Metadata Tests ====================

  test('GET /config-management/metadata - List all metadata', async () => {
    const response = await fetch(`${API_BASE}/config-management/metadata`, {
      headers: { 'Authorization': `Bearer ${SUPER_ADMIN.token}` }
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);

    console.log(`✅ Found ${data.total} configuration metadata items`);
  });

  test('GET /config-management/metadata/:key - Get specific metadata', async () => {
    const response = await fetch(
      `${API_BASE}/config-management/metadata/services.orders_enabled`,
      { headers: { 'Authorization': `Bearer ${SUPER_ADMIN.token}` } }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.key).toBe('services.orders_enabled');
    expect(data.data.type).toBe('boolean');

    console.log(`✅ Got metadata for services.orders_enabled`);
  });

  // ==================== Global Config Tests (Super Admin) ====================

  test('POST /config-management/values - Super admin can create global config', async () => {
    const response = await fetch(`${API_BASE}/config-management/values`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPER_ADMIN.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'orders.payment_window_minutes',
        value: 15,
        organization_id: null  // Global config
      })
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.value).toBe(15);
    expect(data.data.organization_id).toBeNull();

    console.log(`✅ Super admin created global config: payment_window_minutes=15`);
  });

  test('GET /config-management/values - List global configs', async () => {
    const response = await fetch(
      `${API_BASE}/config-management/values?scope=global`,
      { headers: { 'Authorization': `Bearer ${SUPER_ADMIN.token}` } }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.scope).toBe('global');
    expect(Array.isArray(data.data)).toBe(true);

    console.log(`✅ Found ${data.total} global configurations`);
  });

  test('POST /config-management/values - Regular user cannot create global config', async () => {
    const response = await fetch(`${API_BASE}/config-management/values`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ORG_MEMBER.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'orders.payment_window_minutes',
        value: 20,
        organization_id: null
      })
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Permission denied');

    console.log(`✅ Regular user blocked from global config`);
  });

  // ==================== Organization Config Tests ====================

  test('POST /config-management/values - Org owner can create organization config', async () => {
    const response = await fetch(`${API_BASE}/config-management/values`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ORG_OWNER.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'orders.payment_window_minutes',
        value: 20,
        organization_id: GAMESTUDIO_ORG_ID
      })
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.value).toBe(20);
    expect(data.data.organization_id).toBe(GAMESTUDIO_ORG_ID);

    console.log(`✅ Org owner created organization config: payment_window_minutes=20`);
  });

  test('GET /config-management/values - List organization configs', async () => {
    const response = await fetch(
      `${API_BASE}/config-management/values?scope=organization&organization_id=${GAMESTUDIO_ORG_ID}`,
      { headers: { 'Authorization': `Bearer ${ORG_OWNER.token}` } }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.scope).toBe('organization');
    expect(data.organization_id).toBe(GAMESTUDIO_ORG_ID);

    console.log(`✅ Found ${data.total} organization configurations`);
  });

  test('POST /config-management/values - Regular member cannot create organization config', async () => {
    const response = await fetch(`${API_BASE}/config-management/values`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ORG_MEMBER.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'orders.payment_window_minutes',
        value: 25,
        organization_id: GAMESTUDIO_ORG_ID
      })
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Permission denied');

    console.log(`✅ Regular member blocked from organization config`);
  });

  // ==================== Configuration Inheritance Tests ====================

  test('GET /config-management/values/:key - Configuration inheritance works', async () => {
    const response = await fetch(
      `${API_BASE}/config-management/values/orders.payment_window_minutes?organization_id=${GAMESTUDIO_ORG_ID}&show_inheritance=true`,
      { headers: { 'Authorization': `Bearer ${ORG_OWNER.token}` } }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);

    const inheritance = data.data;
    expect(inheritance.key).toBe('orders.payment_window_minutes');
    expect(inheritance.metadata).toBeDefined();
    expect(inheritance.global_value).toBe(15);  // From global config
    expect(inheritance.organization_value).toBe(20);  // From org config
    expect(inheritance.effective_value).toBe(20);  // Org overrides global
    expect(inheritance.effective_source).toBe('organization');

    console.log(`✅ Configuration inheritance: global=15, org=20, effective=20 (organization)`);
  });

  test('GET /config-management/values/:key - Falls back to global when no org config', async () => {
    const response = await fetch(
      `${API_BASE}/config-management/values/orders.payment_window_minutes?organization_id=${TECHCORP_ORG_ID}&show_inheritance=true`,
      { headers: { 'Authorization': `Bearer ${SUPER_ADMIN.token}` } }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();

    const inheritance = data.data;
    expect(inheritance.effective_value).toBe(15);  // Falls back to global
    expect(inheritance.effective_source).toBe('global');
    expect(inheritance.organization_value).toBeUndefined();  // No org config

    console.log(`✅ Configuration inheritance: no org config, falls back to global=15`);
  });

  // ==================== Delete Tests ====================

  test('DELETE /config-management/values/:key - Org owner can delete organization config', async () => {
    const response = await fetch(
      `${API_BASE}/config-management/values/orders.payment_window_minutes?organization_id=${GAMESTUDIO_ORG_ID}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${ORG_OWNER.token}` }
      }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);

    console.log(`✅ Org owner deleted organization config`);
  });

  test('DELETE /config-management/values/:key - Super admin can delete global config', async () => {
    const response = await fetch(
      `${API_BASE}/config-management/values/orders.payment_window_minutes`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${SUPER_ADMIN.token}` }
      }
    );

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);

    console.log(`✅ Super admin deleted global config`);
  });

  // ==================== Validation Tests ====================

  test('POST /config-management/values - Type validation works (number)', async () => {
    const response = await fetch(`${API_BASE}/config-management/values`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPER_ADMIN.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'orders.payment_window_minutes',
        value: 'invalid_number',  // Should be number
        organization_id: null
      })
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');

    console.log(`✅ Type validation rejected invalid number`);
  });

  test('POST /config-management/values - Type validation works (boolean)', async () => {
    const response = await fetch(`${API_BASE}/config-management/values`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPER_ADMIN.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'services.orders_enabled',
        value: 123,  // Should be boolean
        organization_id: null
      })
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');

    console.log(`✅ Type validation rejected invalid boolean`);
  });

});

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Configuration Management API Tests\n');
  console.log('Starting API tests...\n');
}
