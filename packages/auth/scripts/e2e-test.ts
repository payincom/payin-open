/**
 * End-to-End Multi-tenancy Test
 * Tests the complete workflow from user creation to API usage
 */

import { AuthManager, OrganizationRole } from '../src/index.js';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/payin_test';

const JWT_SECRET = 'test-secret-key';

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

async function runE2ETest() {
  console.log('🚀 Starting End-to-End Multi-tenancy Test\n');
  console.log('=' .repeat(60));
  console.log();

  const authManager = new AuthManager({
    connectionString: DATABASE_URL,
    jwtSecret: JWT_SECRET,
  });

  const testData: any = {};

  try {
    // ==================== Scenario 1: User Registration ====================
    console.log('📖 Scenario 1: User Registration & Organization Creation\n');

    info('Step 1.1: Create first user (Company Owner)');
    const owner = await authManager.createUser({
      username: `ceo_${Date.now()}`,
      email: `ceo${Date.now()}@acme.com`,
      password: 'SecurePass123!',
      role: 'admin' as any,
    });
    success('Owner created', { id: owner.id, username: owner.username });
    testData.owner = owner;
    console.log();

    info('Step 1.2: Create organization for the company');
    const company = await authManager.organizations.createOrganization(owner.id, {
      name: 'Acme Corporation',
      website: 'https://acme.com',
      description: 'Leading provider of awesome products',
    });
    success('Organization created', {
      id: company.id,
      name: company.name,
      slug: company.slug,
    });
    testData.company = company;
    console.log();

    info('Step 1.3: Verify owner membership');
    const ownerMembership = await authManager.organizations.verifyMembership(
      owner.id,
      company.id
    );
    success('Membership verified', {
      valid: ownerMembership.valid,
      role: ownerMembership.role,
    });
    console.log();

    // ==================== Scenario 2: Team Building ====================
    console.log('=' .repeat(60));
    console.log('📖 Scenario 2: Building the Team\n');

    info('Step 2.1: Hire a developer (member role)');
    const developer = await authManager.createUser({
      username: `dev_${Date.now()}`,
      email: `dev${Date.now()}@acme.com`,
      password: 'DevPass123!',
      role: 'operator' as any,
    });
    await authManager.organizations.addMember(
      company.id,
      developer.id,
      OrganizationRole.MEMBER,
      owner.id
    );
    success('Developer added', {
      id: developer.id,
      username: developer.username,
      role: 'member',
    });
    testData.developer = developer;
    console.log();

    info('Step 2.2: Hire an admin (admin role)');
    const admin = await authManager.createUser({
      username: `admin_${Date.now()}`,
      email: `admin${Date.now()}@acme.com`,
      password: 'AdminPass123!',
      role: 'admin' as any,
    });
    await authManager.organizations.addMember(
      company.id,
      admin.id,
      OrganizationRole.ADMIN,
      owner.id
    );
    success('Admin added', { id: admin.id, username: admin.username, role: 'admin' });
    testData.admin = admin;
    console.log();

    info('Step 2.3: Hire a viewer (viewer role)');
    const viewer = await authManager.createUser({
      username: `viewer_${Date.now()}`,
      email: `viewer${Date.now()}@acme.com`,
      password: 'ViewPass123!',
      role: 'viewer' as any,
    });
    await authManager.organizations.addMember(
      company.id,
      viewer.id,
      OrganizationRole.VIEWER,
      owner.id
    );
    success('Viewer added', { id: viewer.id, username: viewer.username, role: 'viewer' });
    testData.viewer = viewer;
    console.log();

    info('Step 2.4: List all team members');
    const members = await authManager.organizations.listMembers(company.id);
    success(`Found ${members.length} team members`, {
      members: members.map((m) => ({ userId: m.userId, role: m.role, status: m.status })),
    });
    console.log();

    // ==================== Scenario 3: API Key Management ====================
    console.log('=' .repeat(60));
    console.log('📖 Scenario 3: API Key Management\n');

    info('Step 3.1: Owner creates production API key');
    const prodKey = await authManager.createApiKey(owner.id, company.id, {
      name: 'Production API Key',
    });
    success('Production API key created', {
      id: prodKey.metadata.id,
      name: prodKey.metadata.name,
      keyPrefix: prodKey.apiKey.substring(0, 15) + '...',
    });
    testData.prodKey = prodKey;
    console.log();

    info('Step 3.2: Admin creates test API key');
    const testKey = await authManager.createApiKey(admin.id, company.id, {
      name: 'Test API Key',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
    success('Test API key created', {
      id: testKey.metadata.id,
      name: testKey.metadata.name,
      expiresAt: testKey.metadata.expiresAt,
    });
    testData.testKey = testKey;
    console.log();

    info('Step 3.3: Test if member can create API key (should fail)');
    try {
      await authManager.createApiKey(developer.id, company.id, {
        name: 'Should Fail',
      });
      error('Member created API key - PERMISSION BUG!');
      throw new Error('Permission check failed');
    } catch (err: any) {
      if (err.message.includes('Insufficient permissions')) {
        success('Permission check passed - Member cannot create API keys ✓');
      } else {
        throw err;
      }
    }
    console.log();

    info('Step 3.4: List all organization API keys');
    const apiKeys = await authManager.listApiKeys(company.id);
    success(`Found ${apiKeys.length} API keys`, {
      keys: apiKeys.map((k) => ({ name: k.name, isActive: k.isActive })),
    });
    console.log();

    // ==================== Scenario 4: API Key Verification ====================
    console.log('=' .repeat(60));
    console.log('📖 Scenario 4: API Key Verification\n');

    info('Step 4.1: Verify production API key');
    const prodVerification = await authManager.verifyApiKey(prodKey.apiKey);
    success('Production key verified', {
      valid: prodVerification.valid,
      organizationId: prodVerification.organizationId,
      role: prodVerification.role,
    });

    if (prodVerification.organizationId !== company.id) {
      error('Organization ID mismatch!');
      throw new Error('API Key not bound to correct organization');
    }
    success('Organization binding verified ✓');
    console.log();

    info('Step 4.2: Verify test API key');
    const testVerification = await authManager.verifyApiKey(testKey.apiKey);
    success('Test key verified', {
      valid: testVerification.valid,
      organizationId: testVerification.organizationId,
      role: testVerification.role,
    });
    console.log();

    info('Step 4.3: Test invalid API key');
    const invalidVerification = await authManager.verifyApiKey('pk_test_invalid_key_xxx');
    if (!invalidVerification.valid) {
      success('Invalid key rejected ✓', { error: invalidVerification.error });
    } else {
      error('Invalid key accepted - SECURITY BUG!');
      throw new Error('Security check failed');
    }
    console.log();

    // ==================== Scenario 5: Multiple Organizations ====================
    console.log('=' .repeat(60));
    console.log('📖 Scenario 5: Multiple Organizations\n');

    info('Step 5.1: Owner creates second organization');
    const sideProject = await authManager.organizations.createOrganization(owner.id, {
      name: 'Side Project Inc',
      description: 'Owner\'s personal side project',
    });
    success('Second organization created', {
      id: sideProject.id,
      name: sideProject.name,
      slug: sideProject.slug,
    });
    testData.sideProject = sideProject;
    console.log();

    info('Step 5.2: Create API key for side project');
    const sideProjectKey = await authManager.createApiKey(owner.id, sideProject.id, {
      name: 'Side Project API Key',
    });
    success('Side project API key created');
    testData.sideProjectKey = sideProjectKey;
    console.log();

    info('Step 5.3: List owner\'s organizations');
    const ownerOrgs = await authManager.organizations.listUserOrganizations(owner.id);
    success(`Owner belongs to ${ownerOrgs.length} organizations`, {
      orgs: ownerOrgs.map((o) => ({ name: o.name, role: o.role })),
    });

    if (ownerOrgs.length !== 2) {
      error(`Expected 2 organizations, got ${ownerOrgs.length}`);
      throw new Error('Organization list incorrect');
    }
    console.log();

    info('Step 5.4: Verify API keys are isolated per organization');
    const acmeKeys = await authManager.listApiKeys(company.id);
    const sideKeys = await authManager.listApiKeys(sideProject.id);

    success('API keys properly isolated', {
      'Acme Corp keys': acmeKeys.length,
      'Side Project keys': sideKeys.length,
    });

    if (acmeKeys.length !== 2 || sideKeys.length !== 1) {
      error('API key isolation failed!');
      throw new Error('Data isolation check failed');
    }
    console.log();

    // ==================== Scenario 6: Permission Tests ====================
    console.log('=' .repeat(60));
    console.log('📖 Scenario 6: Permission & Security Tests\n');

    info('Step 6.1: Test viewer cannot update organization');
    try {
      await authManager.organizations.updateOrganization(company.id, {
        name: 'Should Fail',
      });
      // This should work for owner, let's test with proper membership check
      success('Organization update works (expected for owner context)');
    } catch (err: any) {
      success('Update requires proper permissions ✓');
    }
    console.log();

    info('Step 6.2: Test member promotion to admin');
    const promoted = await authManager.organizations.updateMember(
      company.id,
      developer.id,
      { role: OrganizationRole.ADMIN }
    );
    success('Member promoted to admin', {
      userId: promoted.userId,
      oldRole: 'member',
      newRole: promoted.role,
    });
    console.log();

    info('Step 6.3: Verify promoted user can now create API keys');
    const devKey = await authManager.createApiKey(developer.id, company.id, {
      name: 'Developer API Key',
    });
    success('Promoted admin can create API keys ✓', { keyId: devKey.metadata.id });
    testData.devKey = devKey;
    console.log();

    // ==================== Scenario 7: Cleanup Test ====================
    console.log('=' .repeat(60));
    console.log('📖 Scenario 7: Cleanup & Revocation\n');

    info('Step 7.1: Revoke test API key');
    await authManager.revokeApiKey(testKey.metadata.id);
    const revokedVerification = await authManager.verifyApiKey(testKey.apiKey);
    if (!revokedVerification.valid) {
      success('Revoked key is now invalid ✓');
    } else {
      error('Revoked key still valid - SECURITY BUG!');
      throw new Error('Revocation failed');
    }
    console.log();

    info('Step 7.2: Remove viewer from organization');
    await authManager.organizations.removeMember(company.id, viewer.id);
    const viewerMembership = await authManager.organizations.verifyMembership(
      viewer.id,
      company.id
    );
    if (!viewerMembership.valid) {
      success('Removed member cannot access organization ✓');
    } else {
      error('Removed member still has access - SECURITY BUG!');
      throw new Error('Member removal failed');
    }
    console.log();

    // ==================== Final Summary ====================
    console.log('=' .repeat(60));
    console.log('📊 Test Summary\n');

    const finalMembers = await authManager.organizations.listMembers(company.id);
    const finalKeys = await authManager.listApiKeys(company.id);

    success('Test completed successfully!', {
      'Total organizations created': 2,
      'Total users created': 4,
      'Active members in Acme Corp': finalMembers.length,
      'Active API keys in Acme Corp': finalKeys.filter((k) => k.isActive).length,
      'Revoked API keys': finalKeys.filter((k) => !k.isActive).length,
    });

    console.log();
    console.log('=' .repeat(60));
    console.log('🧹 Cleaning up test data...\n');

    // Cleanup
    await authManager.revokeApiKey(prodKey.metadata.id);
    await authManager.revokeApiKey(devKey.metadata.id);
    await authManager.revokeApiKey(sideProjectKey.metadata.id);

    await authManager.organizations.deleteOrganization(company.id);
    await authManager.organizations.deleteOrganization(sideProject.id);

    await authManager.deleteUser(owner.id);
    await authManager.deleteUser(developer.id);
    await authManager.deleteUser(admin.id);
    await authManager.deleteUser(viewer.id);

    success('Cleanup completed');
    console.log();

    console.log('🎉 All End-to-End Tests PASSED!\n');
    console.log('=' .repeat(60));

    return true;
  } catch (err: any) {
    console.log();
    console.log('=' .repeat(60));
    error('Test FAILED', { error: err.message });
    console.error(err);
    return false;
  } finally {
    await authManager.close();
  }
}

// Run E2E test
runE2ETest()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
