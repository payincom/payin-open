/**
 * HTTP API Test for Multi-tenancy Features
 * Tests the complete multi-tenancy workflow via real HTTP API calls
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface TestContext {
  jwtToken?: string;
  userId?: string;
  organizationId?: string;
  apiKey?: string;
  apiKeyId?: string;
  memberId?: string;
}

const context: TestContext = {};

function log(emoji: string, message: string, data?: any) {
  console.log(`${emoji} ${message}`);
  if (data) {
    console.log(`   ${JSON.stringify(data, null, 2)}`);
  }
}

function success(message: string, data?: any) {
  log('✅', message, data);
}

function info(message: string, data?: any) {
  log('📋', message, data);
}

function error(message: string, data?: any) {
  log('❌', message, data);
}

async function httpRequest(
  method: string,
  path: string,
  options: {
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<any> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function testHttpApi() {
  console.log('🧪 Starting HTTP API Multi-tenancy Test\n');
  console.log('=' .repeat(60));
  console.log();

  try {
    // ==================== Test 1: Login ====================
    console.log('📖 Test 1: User Login\n');

    info('Step 1.1: Login with admin credentials');
    const loginResponse = await httpRequest('POST', '/api/v1/auth/login', {
      body: {
        username: 'admin',
        password: 'admin123',
      },
    });

    context.jwtToken = loginResponse.data.token;
    context.userId = loginResponse.data.user.id;

    success('Login successful', {
      userId: context.userId,
      username: loginResponse.data.user.username,
      tokenPrefix: context.jwtToken.substring(0, 20) + '...',
    });
    console.log();

    // ==================== Test 2: Create Organization ====================
    console.log('=' .repeat(60));
    console.log('📖 Test 2: Create Organization\n');

    info('Step 2.1: Create new organization');
    const orgResponse = await httpRequest('POST', '/api/v1/organizations', {
      headers: {
        Authorization: `Bearer ${context.jwtToken}`,
      },
      body: {
        name: `Test Company ${Date.now()}`,
        website: 'https://test.com',
        description: 'HTTP API Test Organization',
      },
    });

    context.organizationId = orgResponse.organization.id;

    success('Organization created', {
      id: orgResponse.organization.id,
      name: orgResponse.organization.name,
      slug: orgResponse.organization.slug,
    });
    console.log();

    // ==================== Test 3: List Organizations ====================
    console.log('=' .repeat(60));
    console.log('📖 Test 3: List User Organizations\n');

    info('Step 3.1: Get all organizations for current user');
    const orgsResponse = await httpRequest('GET', '/api/v1/organizations', {
      headers: {
        Authorization: `Bearer ${context.jwtToken}`,
      },
    });

    success(`Found ${orgsResponse.organizations.length} organization(s)`, {
      count: orgsResponse.organizations.length,
      orgs: orgsResponse.organizations.map((o: any) => ({
        name: o.name,
        role: o.role,
      })),
    });
    console.log();

    // ==================== Test 4: Create API Key ====================
    console.log('=' .repeat(60));
    console.log('📖 Test 4: Create API Key\n');

    info('Step 4.1: Create API Key for organization');
    const apiKeyResponse = await httpRequest(
      'POST',
      `/api/v1/organizations/${context.organizationId}/api-keys`,
      {
        headers: {
          Authorization: `Bearer ${context.jwtToken}`,
          'X-Organization-ID': context.organizationId!,
        },
        body: {
          name: 'Test API Key',
        },
      }
    );

    context.apiKey = apiKeyResponse.apiKey;
    context.apiKeyId = apiKeyResponse.metadata.id;

    success('API Key created', {
      id: apiKeyResponse.metadata.id,
      name: apiKeyResponse.metadata.name,
      keyPrefix: context.apiKey.substring(0, 15) + '...',
      organizationId: apiKeyResponse.metadata.organizationId,
    });
    console.log();

    // ==================== Test 5: List API Keys ====================
    console.log('=' .repeat(60));
    console.log('📖 Test 5: List Organization API Keys\n');

    info('Step 5.1: Get all API keys for organization');
    const apiKeysResponse = await httpRequest(
      'GET',
      `/api/v1/organizations/${context.organizationId}/api-keys`,
      {
        headers: {
          Authorization: `Bearer ${context.jwtToken}`,
          'X-Organization-ID': context.organizationId!,
        },
      }
    );

    success(`Found ${apiKeysResponse.apiKeys.length} API key(s)`, {
      count: apiKeysResponse.apiKeys.length,
      keys: apiKeysResponse.apiKeys.map((k: any) => ({
        name: k.name,
        isActive: k.isActive,
      })),
    });
    console.log();

    // ==================== Test 6: Add Member ====================
    console.log('=' .repeat(60));
    console.log('📖 Test 6: Add Organization Member\n');

    info('Step 6.1: Create a new user first');
    const newUserResponse = await httpRequest('POST', '/api/v1/auth/register', {
      body: {
        username: `testuser_${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        password: 'Test123!',
      },
    });

    context.memberId = newUserResponse.data.user.id;

    success('New user created', {
      id: newUserResponse.data.user.id,
      username: newUserResponse.data.user.username,
    });

    info('Step 6.2: Add user as member to organization');
    const addMemberResponse = await httpRequest(
      'POST',
      `/api/v1/organizations/${context.organizationId}/members`,
      {
        headers: {
          Authorization: `Bearer ${context.jwtToken}`,
          'X-Organization-ID': context.organizationId!,
        },
        body: {
          targetUserId: context.memberId,
          role: 'member',
        },
      }
    );

    success('Member added', {
      userId: addMemberResponse.member.userId,
      role: addMemberResponse.member.role,
      status: addMemberResponse.member.status,
    });
    console.log();

    // ==================== Test 7: List Members ====================
    console.log('=' .repeat(60));
    console.log('📖 Test 7: List Organization Members\n');

    info('Step 7.1: Get all members');
    const membersResponse = await httpRequest(
      'GET',
      `/api/v1/organizations/${context.organizationId}/members`,
      {
        headers: {
          Authorization: `Bearer ${context.jwtToken}`,
          'X-Organization-ID': context.organizationId!,
        },
      }
    );

    success(`Found ${membersResponse.members.length} member(s)`, {
      count: membersResponse.members.length,
      members: membersResponse.members.map((m: any) => ({
        userId: m.userId,
        role: m.role,
        status: m.status,
      })),
    });
    console.log();

    // ==================== Test 8: Update Member Role ====================
    console.log('=' .repeat(60));
    console.log('📖 Test 8: Update Member Role\n');

    info('Step 8.1: Promote member to admin');
    const updateMemberResponse = await httpRequest(
      'PATCH',
      `/api/v1/organizations/${context.organizationId}/members/${context.memberId}`,
      {
        headers: {
          Authorization: `Bearer ${context.jwtToken}`,
          'X-Organization-ID': context.organizationId!,
        },
        body: {
          role: 'admin',
        },
      }
    );

    success('Member role updated', {
      userId: updateMemberResponse.member.userId,
      oldRole: 'member',
      newRole: updateMemberResponse.member.role,
    });
    console.log();

    // ==================== Test 9: Get Organization Details ====================
    console.log('=' .repeat(60));
    console.log('📖 Test 9: Get Organization Details\n');

    info('Step 9.1: Get organization details');
    const orgDetailsResponse = await httpRequest(
      'GET',
      `/api/v1/organizations/${context.organizationId}`,
      {
        headers: {
          Authorization: `Bearer ${context.jwtToken}`,
          'X-Organization-ID': context.organizationId!,
        },
      }
    );

    success('Organization details retrieved', {
      id: orgDetailsResponse.organization.id,
      name: orgDetailsResponse.organization.name,
      planType: orgDetailsResponse.organization.planType,
      userRole: orgDetailsResponse.role,
    });
    console.log();

    // ==================== Test 10: Revoke API Key ====================
    console.log('=' .repeat(60));
    console.log('📖 Test 10: Revoke API Key\n');

    info('Step 10.1: Revoke API key');
    await httpRequest(
      'DELETE',
      `/api/v1/organizations/${context.organizationId}/api-keys/${context.apiKeyId}`,
      {
        headers: {
          Authorization: `Bearer ${context.jwtToken}`,
          'X-Organization-ID': context.organizationId!,
        },
      }
    );

    success('API Key revoked');
    console.log();

    // ==================== Test 11: Remove Member ====================
    console.log('=' .repeat(60));
    console.log('📖 Test 11: Remove Organization Member\n');

    info('Step 11.1: Remove member from organization');
    await httpRequest(
      'DELETE',
      `/api/v1/organizations/${context.organizationId}/members/${context.memberId}`,
      {
        headers: {
          Authorization: `Bearer ${context.jwtToken}`,
          'X-Organization-ID': context.organizationId!,
        },
      }
    );

    success('Member removed from organization');
    console.log();

    // ==================== Final Summary ====================
    console.log('=' .repeat(60));
    console.log('📊 Test Summary\n');

    success('All HTTP API tests passed!', {
      'Total tests': 11,
      'Organization created': context.organizationId,
      'API Key created and revoked': true,
      'Member added and removed': true,
    });

    console.log();
    console.log('=' .repeat(60));
    console.log('🎉 HTTP API Test Suite PASSED!\n');

    return true;
  } catch (err: any) {
    console.log();
    console.log('=' .repeat(60));
    error('Test FAILED', { error: err.message });
    console.error(err);
    return false;
  }
}

// Run HTTP API test
testHttpApi()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
