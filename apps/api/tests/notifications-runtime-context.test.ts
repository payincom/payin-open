import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';

const mocks = vi.hoisted(() => {
  const notification = {
    createEndpoint: vi.fn(),
    getEndpoint: vi.fn(),
    listEndpoints: vi.fn(),
    updateEndpoint: vi.fn(),
    deleteEndpoint: vi.fn(),
    testEndpoint: vi.fn(),
    getNotificationLogs: vi.fn(),
    getNotificationLog: vi.fn(),
    retryNotification: vi.fn(),
    retryFailedNotifications: vi.fn(),
    getStatistics: vi.fn(),
    createEndpointForRuntimeScope: vi.fn(),
    getEndpointForRuntimeScope: vi.fn(),
    listEndpointsForRuntimeScope: vi.fn(),
    updateEndpointForRuntimeScope: vi.fn(),
    deleteEndpointForRuntimeScope: vi.fn(),
    testEndpointForRuntimeScope: vi.fn(),
    getNotificationLogsForRuntimeScope: vi.fn(),
    getNotificationLogForRuntimeScope: vi.fn(),
    retryFailedNotificationsForRuntimeScope: vi.fn(),
    getStatisticsForRuntimeScope: vi.fn(),
    getQueueStatus: vi.fn(),
  };

  const manager = {
    getNotificationService: vi.fn(() => notification),
  };

  return { manager, notification };
});

vi.mock('../src/manager-instance.js', () => ({
  getManager: () => mocks.manager,
}));

vi.mock('../src/auth-instance.js', () => ({
  getAuth: () => ({}),
}));

vi.mock('@payin/auth', () => ({
  createAuthMiddleware: () => async (c: any, next: any) => {
    const organizationId = c.req.header('x-test-organization-id');
    if (organizationId) c.set('organizationId', organizationId);
    c.set('authType', 'jwt');
    c.set('userId', 'test-user');
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => {
    await next();
  },
}));

const { createNotificationsRoutes } = await import('../src/routes/notifications.js');

function createNotificationsApp(deps: Parameters<typeof createNotificationsRoutes>[0] = {}) {
  const app = new Hono();
  app.route('/notifications', createNotificationsRoutes(deps));
  return app;
}

const runtimeScope = (organizationId: string) =>
  expect.objectContaining({
    paymentScope: expect.objectContaining({ id: organizationId }),
  });

function setRuntime(runtime: string) {
  const previous = process.env.PAYIN_RUNTIME;
  process.env.PAYIN_RUNTIME = runtime;
  return () => {
    if (previous === undefined) delete process.env.PAYIN_RUNTIME;
    else process.env.PAYIN_RUNTIME = previous;
  };
}

describe('notifications route runtime context resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager.getNotificationService.mockReturnValue(mocks.notification);
    mocks.notification.createEndpoint.mockResolvedValue({ id: 'endpoint-1' });
    mocks.notification.createEndpointForRuntimeScope.mockResolvedValue({ id: 'endpoint-1' });
    mocks.notification.getEndpoint.mockResolvedValue({ id: 'endpoint-1' });
    mocks.notification.getEndpointForRuntimeScope.mockResolvedValue({ id: 'endpoint-1' });
    mocks.notification.listEndpoints.mockResolvedValue([]);
    mocks.notification.listEndpointsForRuntimeScope.mockResolvedValue([]);
    mocks.notification.updateEndpoint.mockResolvedValue({ id: 'endpoint-1', is_enabled: false });
    mocks.notification.updateEndpointForRuntimeScope.mockResolvedValue({
      id: 'endpoint-1',
      is_enabled: false,
    });
    mocks.notification.deleteEndpoint.mockResolvedValue(undefined);
    mocks.notification.deleteEndpointForRuntimeScope.mockResolvedValue(undefined);
    mocks.notification.testEndpoint.mockResolvedValue(true);
    mocks.notification.testEndpointForRuntimeScope.mockResolvedValue(true);
    mocks.notification.getNotificationLogs.mockResolvedValue({
      logs: [],
      total: 0,
      page: 1,
      limit: 50,
    });
    mocks.notification.getNotificationLogsForRuntimeScope.mockResolvedValue({
      logs: [],
      total: 0,
      page: 1,
      limit: 50,
    });
    mocks.notification.getNotificationLog.mockResolvedValue({
      id: 'log-1',
      organization_id: DEFAULT_OPEN_ORGANIZATION_ID,
    });
    mocks.notification.getNotificationLogForRuntimeScope.mockResolvedValue({
      id: 'log-1',
      organization_id: DEFAULT_OPEN_ORGANIZATION_ID,
    });
    mocks.notification.retryNotification.mockResolvedValue(undefined);
    mocks.notification.retryFailedNotifications.mockResolvedValue(2);
    mocks.notification.retryFailedNotificationsForRuntimeScope.mockResolvedValue(2);
    mocks.notification.getStatistics.mockResolvedValue({ total_sent: 0 });
    mocks.notification.getStatisticsForRuntimeScope.mockResolvedValue({ total_sent: 0 });
    mocks.notification.getQueueStatus.mockReturnValue({
      isRunning: true,
      activeJobs: 0,
      maxConcurrency: 5,
    });
  });

  it('can be composed as a factory with injected notification, middleware, and runtime dependencies', async () => {
    const runtimeContext = { paymentScope: { id: 'injected-org' } } as any;
    const injectedNotification = {
      listEndpointsForRuntimeScope: vi.fn().mockResolvedValue([{ id: 'injected-endpoint' }]),
    } as any;
    const injectedAuth = { source: 'injected-auth' } as any;
    const getNotificationService = vi.fn(() => injectedNotification);
    const getAuth = vi.fn(() => injectedAuth);
    const createAuthMiddleware = vi.fn((auth: any) => async (c: any, next: any) => {
      c.set('authType', `auth:${auth.source}`);
      await next();
    });
    const requirePermission = vi.fn((permission: string) => async (c: any, next: any) => {
      c.set('permission', permission);
      await next();
    });
    const resolveRuntimeContext = vi.fn((c: any) => {
      expect(c.get('authType')).toBe('auth:injected-auth');
      expect(c.get('permission')).toBe('webhooks:read');
      return runtimeContext;
    });
    const organizationContextRequiredMessage = vi.fn(
      () => 'Injected organization context required'
    );

    const app = new Hono();
    app.route(
      '/notifications',
      createNotificationsRoutes({
        getNotificationService,
        getAuth,
        createAuthMiddleware,
        requirePermission,
        resolveRuntimeContext,
        organizationContextRequiredMessage,
      })
    );

    const response = await app.request('/notifications/endpoints?is_enabled=true');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ endpoints: [{ id: 'injected-endpoint' }], total: 1 });
    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(createAuthMiddleware).toHaveBeenCalledWith(injectedAuth);
    expect(requirePermission).toHaveBeenCalledWith('webhooks:read');
    expect(getNotificationService).toHaveBeenCalledTimes(1);
    expect(resolveRuntimeContext).toHaveBeenCalledTimes(1);
    expect(injectedNotification.listEndpointsForRuntimeScope).toHaveBeenCalledWith(runtimeContext, {
      is_enabled: true,
    });
    expect(mocks.manager.getNotificationService).not.toHaveBeenCalled();
    expect(mocks.notification.listEndpointsForRuntimeScope).not.toHaveBeenCalled();
    expect(organizationContextRequiredMessage).not.toHaveBeenCalled();
  });

  it('uses the default single-merchant scope for endpoint listing in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createNotificationsApp().request('/notifications/endpoints');

      expect(response.status).toBe(200);
      expect(mocks.notification.listEndpointsForRuntimeScope).toHaveBeenCalledWith(
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID),
        {}
      );
      expect(mocks.notification.listEndpoints).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime has no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createNotificationsApp().request('/notifications/endpoints');
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope instead of the Open default when present', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '33333333-3333-4333-8333-333333333333';
    try {
      const response = await createNotificationsApp().request('/notifications/endpoints', {
        headers: { 'x-test-organization-id': authenticatedOrganizationId },
      });

      expect(response.status).toBe(200);
      expect(mocks.notification.listEndpointsForRuntimeScope).toHaveBeenCalledWith(
        runtimeScope(authenticatedOrganizationId),
        {}
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope when creating an endpoint in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createNotificationsApp().request('/notifications/endpoints', {
        method: 'POST',
        body: JSON.stringify({
          endpoint_name: 'Open webhook',
          endpoint_type: 'webhook',
          config: { url: 'https://example.test/webhook' },
          subscribed_events: ['order.created'],
        }),
      });

      expect(response.status).toBe(201);
      expect(mocks.notification.createEndpointForRuntimeScope).toHaveBeenCalledWith(
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID),
        {
          endpoint_name: 'Open webhook',
          endpoint_type: 'webhook',
          config: { url: 'https://example.test/webhook' },
          subscribed_events: ['order.created'],
        }
      );
      expect(mocks.notification.createEndpoint).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('prevents endpoint creation when injected notification policy denies it', async () => {
    const restoreRuntime = setRuntime('open');
    const notificationPolicy = {
      check: vi.fn().mockResolvedValue({
        allowed: false,
        code: 'NOTIFICATION_CREATE_DENIED',
        message: 'Endpoint creation denied by injected policy.',
        status: 403,
      }),
    };
    const notificationEventSink = { record: vi.fn() };

    try {
      const response = await createNotificationsApp({
        notificationPolicy,
        notificationEventSink,
      }).request('/notifications/endpoints', {
        method: 'POST',
        body: JSON.stringify({
          endpoint_name: 'Denied webhook',
          endpoint_type: 'webhook',
          config: { url: 'https://example.test/webhook' },
          subscribed_events: ['order.created'],
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toMatchObject({
        success: false,
        code: 'NOTIFICATION_CREATE_DENIED',
        message: 'Endpoint creation denied by injected policy.',
      });
      expect(notificationPolicy.check).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create_endpoint',
          runtimeContext: runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID),
          request: expect.objectContaining({ endpoint_name: 'Denied webhook' }),
        })
      );
      expect(mocks.notification.createEndpointForRuntimeScope).not.toHaveBeenCalled();
      expect(notificationEventSink.record).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('records a neutral event envelope after successful endpoint creation', async () => {
    const restoreRuntime = setRuntime('open');
    const notificationEventSink = { record: vi.fn() };
    mocks.notification.createEndpointForRuntimeScope.mockResolvedValueOnce({
      id: 'endpoint-created',
      endpoint_name: 'Recorded webhook',
      endpoint_type: 'webhook',
    });

    try {
      const response = await createNotificationsApp({ notificationEventSink }).request(
        '/notifications/endpoints',
        {
          method: 'POST',
          headers: { 'x-request-id': 'request-123' },
          body: JSON.stringify({
            endpoint_name: 'Recorded webhook',
            endpoint_type: 'webhook',
            config: { url: 'https://example.test/webhook' },
            subscribed_events: ['order.created'],
          }),
        }
      );

      expect(response.status).toBe(201);
      expect(notificationEventSink.record).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'notification.endpoint.created',
          operation: 'create_endpoint',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
          actor: { type: 'operator', id: 'test-user' },
          requestId: 'request-123',
          source: 'apps/api',
          endpoint: {
            id: 'endpoint-created',
            name: 'Recorded webhook',
            type: 'webhook',
          },
        })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('does not fail endpoint creation when injected event sink fails', async () => {
    const restoreRuntime = setRuntime('open');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const notificationEventSink = { record: vi.fn().mockRejectedValue(new Error('sink failed')) };

    try {
      const response = await createNotificationsApp({ notificationEventSink }).request(
        '/notifications/endpoints',
        {
          method: 'POST',
          body: JSON.stringify({
            endpoint_name: 'Best effort webhook',
            endpoint_type: 'webhook',
            config: { url: 'https://example.test/webhook' },
            subscribed_events: ['order.created'],
          }),
        }
      );

      expect(response.status).toBe(201);
      expect(mocks.notification.createEndpointForRuntimeScope).toHaveBeenCalledTimes(1);
      expect(notificationEventSink.record).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime creates an endpoint with no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createNotificationsApp().request('/notifications/endpoints', {
        method: 'POST',
        body: JSON.stringify({
          endpoint_name: 'Cloud webhook',
          endpoint_type: 'webhook',
          config: { url: 'https://example.test/webhook' },
          subscribed_events: ['order.created'],
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope instead of the Open default when creating an endpoint', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '44444444-4444-4444-8444-444444444444';
    try {
      const response = await createNotificationsApp().request('/notifications/endpoints', {
        method: 'POST',
        headers: { 'x-test-organization-id': authenticatedOrganizationId },
        body: JSON.stringify({
          endpoint_name: 'Org webhook',
          endpoint_type: 'webhook',
          config: { url: 'https://example.test/webhook' },
          subscribed_events: ['order.created'],
        }),
      });

      expect(response.status).toBe(201);
      expect(mocks.notification.createEndpointForRuntimeScope).toHaveBeenCalledWith(
        runtimeScope(authenticatedOrganizationId),
        {
          endpoint_name: 'Org webhook',
          endpoint_type: 'webhook',
          config: { url: 'https://example.test/webhook' },
          subscribed_events: ['order.created'],
        }
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope when getting an endpoint in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createNotificationsApp().request(
        '/notifications/endpoints/endpoint-1'
      );

      expect(response.status).toBe(200);
      expect(mocks.notification.getEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID)
      );
      expect(mocks.notification.getEndpoint).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime gets an endpoint with no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createNotificationsApp().request(
        '/notifications/endpoints/endpoint-1'
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope instead of the Open default when getting an endpoint', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '55555555-5555-4555-8555-555555555555';
    try {
      const response = await createNotificationsApp().request(
        '/notifications/endpoints/endpoint-1',
        {
          headers: { 'x-test-organization-id': authenticatedOrganizationId },
        }
      );

      expect(response.status).toBe(200);
      expect(mocks.notification.getEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(authenticatedOrganizationId)
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope when updating an endpoint in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createNotificationsApp().request(
        '/notifications/endpoints/endpoint-1',
        {
          method: 'PUT',
          body: JSON.stringify({ is_enabled: false }),
        }
      );

      expect(response.status).toBe(200);
      expect(mocks.notification.getEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID)
      );
      expect(mocks.notification.updateEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        { is_enabled: false },
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID)
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime updates an endpoint with no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createNotificationsApp().request(
        '/notifications/endpoints/endpoint-1',
        {
          method: 'PUT',
          body: JSON.stringify({ is_enabled: false }),
        }
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope instead of the Open default when updating an endpoint', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '66666666-6666-4666-8666-666666666666';
    try {
      const response = await createNotificationsApp().request(
        '/notifications/endpoints/endpoint-1',
        {
          method: 'PUT',
          headers: { 'x-test-organization-id': authenticatedOrganizationId },
          body: JSON.stringify({ is_enabled: false }),
        }
      );

      expect(response.status).toBe(200);
      expect(mocks.notification.getEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(authenticatedOrganizationId)
      );
      expect(mocks.notification.updateEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        { is_enabled: false },
        runtimeScope(authenticatedOrganizationId)
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope when deleting an endpoint in Open runtime without an authenticated organization id', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createNotificationsApp().request(
        '/notifications/endpoints/endpoint-1',
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(200);
      expect(mocks.notification.getEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID)
      );
      expect(mocks.notification.deleteEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID)
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime deletes an endpoint with no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createNotificationsApp().request(
        '/notifications/endpoints/endpoint-1',
        {
          method: 'DELETE',
        }
      );
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Organization context is required for hosted multi-tenant operations.',
      });
    } finally {
      restoreRuntime();
    }
  });

  it('uses an authenticated organization scope instead of the Open default when deleting an endpoint', async () => {
    const restoreRuntime = setRuntime('open');
    const authenticatedOrganizationId = '77777777-7777-4777-8777-777777777777';
    try {
      const response = await createNotificationsApp().request(
        '/notifications/endpoints/endpoint-1',
        {
          method: 'DELETE',
          headers: { 'x-test-organization-id': authenticatedOrganizationId },
        }
      );

      expect(response.status).toBe(200);
      expect(mocks.notification.getEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(authenticatedOrganizationId)
      );
      expect(mocks.notification.deleteEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(authenticatedOrganizationId)
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope when testing an endpoint in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createNotificationsApp().request(
        '/notifications/endpoints/endpoint-1/test',
        { method: 'POST' }
      );

      expect(response.status).toBe(200);
      expect(mocks.notification.getEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID)
      );
      expect(mocks.notification.testEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID)
      );
      expect(mocks.notification.testEndpoint).not.toHaveBeenCalled();
    } finally {
      restoreRuntime();
    }
  });

  it('records endpoint test identifiers after a successful test operation', async () => {
    const restoreRuntime = setRuntime('open');
    const notificationEventSink = { record: vi.fn() };
    mocks.notification.getEndpointForRuntimeScope.mockResolvedValueOnce({
      id: 'endpoint-1',
      endpoint_name: 'Tested webhook',
      endpoint_type: 'webhook',
    });

    try {
      const response = await createNotificationsApp({ notificationEventSink }).request(
        '/notifications/endpoints/endpoint-1/test',
        {
          method: 'POST',
          headers: { 'x-request-id': 'request-test-123' },
        }
      );

      expect(response.status).toBe(200);
      expect(notificationEventSink.record).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'notification.endpoint.tested',
          operation: 'test_endpoint',
          paymentScope: expect.objectContaining({ id: DEFAULT_OPEN_ORGANIZATION_ID }),
          actor: { type: 'operator', id: 'test-user' },
          requestId: 'request-test-123',
          source: 'apps/api',
          endpoint: {
            id: 'endpoint-1',
            name: 'Tested webhook',
            type: 'webhook',
          },
          test: { success: true },
        })
      );
    } finally {
      restoreRuntime();
    }
  });

  it('filters notification logs by the default single-merchant scope in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createNotificationsApp().request(
        '/notifications/logs?endpoint_id=endpoint-1&status=failed&page=2&limit=10'
      );

      expect(response.status).toBe(200);
      expect(mocks.notification.getNotificationLogsForRuntimeScope).toHaveBeenCalledWith(
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID),
        {
          endpoint_id: 'endpoint-1',
          event_type: undefined,
          status: 'failed',
          business_type: undefined,
          business_id: undefined,
          page: 2,
          limit: 10,
        }
      );
    } finally {
      restoreRuntime();
    }
  });

  it('keeps hosted organization-context-required behavior when Cloud runtime lists logs with no context', async () => {
    const restoreRuntime = setRuntime('cloud');
    try {
      const response = await createNotificationsApp().request('/notifications/logs');
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
      });
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope when retrying failed notifications', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createNotificationsApp().request('/notifications/retry-failed', {
        method: 'POST',
        body: JSON.stringify({ endpoint_id: 'endpoint-1', event_type: 'order.created' }),
      });

      expect(response.status).toBe(200);
      expect(mocks.notification.getEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID)
      );
      expect(mocks.notification.retryFailedNotificationsForRuntimeScope).toHaveBeenCalledWith(
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID),
        { endpoint_id: 'endpoint-1', event_type: 'order.created' }
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope when reading notification statistics', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createNotificationsApp().request(
        '/notifications/statistics?endpoint_id=endpoint-1&start_date=2026-01-01&end_date=2026-01-31'
      );

      expect(response.status).toBe(200);
      expect(mocks.notification.getEndpointForRuntimeScope).toHaveBeenCalledWith(
        'endpoint-1',
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID)
      );
      expect(mocks.notification.getStatisticsForRuntimeScope).toHaveBeenCalledWith(
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID),
        'endpoint-1',
        { startDate: '2026-01-01', endDate: '2026-01-31' }
      );
    } finally {
      restoreRuntime();
    }
  });

  it('uses the default single-merchant scope for webhook aliases in Open runtime', async () => {
    const restoreRuntime = setRuntime('open');
    try {
      const response = await createNotificationsApp().request('/notifications/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          endpoint_name: 'Alias webhook',
          endpoint_type: 'webhook',
          config: { url: 'https://example.test/webhook' },
          subscribed_events: ['order.created'],
        }),
      });

      expect(response.status).toBe(201);
      expect(mocks.notification.createEndpointForRuntimeScope).toHaveBeenCalledWith(
        runtimeScope(DEFAULT_OPEN_ORGANIZATION_ID),
        {
          endpoint_name: 'Alias webhook',
          endpoint_type: 'webhook',
          config: { url: 'https://example.test/webhook' },
          subscribed_events: ['order.created'],
        }
      );
    } finally {
      restoreRuntime();
    }
  });
});
