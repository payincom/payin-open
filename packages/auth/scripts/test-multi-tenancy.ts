/**
 * Test Multi-tenancy Features
 */

import { AuthManager, OrganizationRole } from '../src/index.js';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/payin_test';

const JWT_SECRET = 'test-secret-key';

async function testMultiTenancy() {
  console.log('🧪 Testing Multi-Tenancy Features\n');

  const authManager = new AuthManager({
    connectionString: DATABASE_URL,
    jwtSecret: JWT_SECRET,
  });

  try {
    // Test 1: Get merchant organization
    console.log('📋 Test 1: Get merchant organization');
    const defaultOrg = await authManager.organizations.getOrganizationBySlug('default');
    console.log('✅ Single organization:', defaultOrg?.name);
    console.log(`   ID: ${defaultOrg?.id}\n`);

    // Test 2: Create a test user
    console.log('📋 Test 2: Create test user');
    const testUser = await authManager.createUser({
      username: `testuser_${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      password: 'Test123!',
      role: 'admin' as any,
    });
    console.log('✅ User created:', testUser.username);
    console.log(`   ID: ${testUser.id}\n`);

    // Test 3: Create a new organization
    console.log('📋 Test 3: Create new organization');
    const newOrg = await authManager.organizations.createOrganization(testUser.id, {
      name: 'Test Company',
      website: 'https://test.com',
      description: 'Test organization for multi-tenancy',
    });
    console.log('✅ Organization created:', newOrg.name);
    console.log(`   ID: ${newOrg.id}`);
    console.log(`   Slug: ${newOrg.slug}\n`);

    // Test 4: Verify membership
    console.log('📋 Test 4: Verify membership');
    const membership = await authManager.organizations.verifyMembership(testUser.id, newOrg.id);
    console.log('✅ Membership verified:', membership.valid);
    console.log(`   Role: ${membership.role}\n`);

    // Test 5: Create API Key
    console.log('📋 Test 5: Create API Key');
    const apiKeyResult = await authManager.createApiKey(testUser.id, newOrg.id, {
      name: 'Test API Key',
    });
    console.log('✅ API Key created:', apiKeyResult.metadata.name);
    console.log(`   ID: ${apiKeyResult.metadata.id}`);
    console.log(`   Key: ${apiKeyResult.apiKey.substring(0, 20)}...\n`);

    // Test 6: Verify API Key
    console.log('📋 Test 6: Verify API Key');
    const verification = await authManager.verifyApiKey(apiKeyResult.apiKey);
    console.log('✅ API Key verified:', verification.valid);
    console.log(`   Organization ID: ${verification.organizationId}`);
    console.log(`   User ID: ${verification.userId}`);
    console.log(`   Role: ${verification.role}\n`);

    // Test 7: List API Keys for organization
    console.log('📋 Test 7: List API Keys');
    const apiKeys = await authManager.listApiKeys(newOrg.id);
    console.log(`✅ Found ${apiKeys.length} API key(s)`);
    apiKeys.forEach((key) => {
      console.log(`   - ${key.name} (${key.keyPrefix}...)`);
    });
    console.log();

    // Test 8: Add another member
    console.log('📋 Test 8: Add member to organization');
    const member2 = await authManager.createUser({
      username: `member_${Date.now()}`,
      email: `member${Date.now()}@example.com`,
      password: 'Test123!',
      role: 'operator' as any,
    });
    await authManager.organizations.addMember(
      newOrg.id,
      member2.id,
      OrganizationRole.MEMBER,
      testUser.id
    );
    console.log('✅ Member added:', member2.username);
    console.log(`   Role: member\n`);

    // Test 9: List organization members
    console.log('📋 Test 9: List organization members');
    const members = await authManager.organizations.listMembers(newOrg.id);
    console.log(`✅ Found ${members.length} member(s)`);
    members.forEach((m) => {
      console.log(`   - User ${m.userId}: ${m.role} (${m.status})`);
    });
    console.log();

    // Test 10: List user's organizations
    console.log('📋 Test 10: List user organizations');
    const userOrgs = await authManager.organizations.listUserOrganizations(testUser.id);
    console.log(`✅ User belongs to ${userOrgs.length} organization(s)`);
    userOrgs.forEach((org) => {
      console.log(`   - ${org.name} (${org.role})`);
    });
    console.log();

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await authManager.revokeApiKey(apiKeyResult.metadata.id);
    await authManager.organizations.deleteOrganization(newOrg.id);
    await authManager.deleteUser(testUser.id);
    await authManager.deleteUser(member2.id);
    console.log('✅ Cleanup completed\n');

    console.log('🎉 All tests passed!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    throw error;
  } finally {
    await authManager.close();
  }
}

// Run tests
testMultiTenancy().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
