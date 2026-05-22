import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../src/notification-service.js';
import { NotificationQueue, type NotificationNotifierFactory } from '../src/queue/notification-queue.js';
import { BaseNotifier } from '../src/notifiers/base-notifier.js';
import type { NotificationRepository } from '../src/repository/notification.repository.js';
import type { Endpoint } from '../src/types/endpoint.js';
import type { NotificationEvent, NotificationLog, NotificationResult } from '../src/types/notification.js';

class FakeNotifier extends BaseNotifier {
  constructor(private result: NotificationResult = { success: true, httpStatusCode: 202 }) {
    super();
  }

  send = vi.fn(async () => this.result);

  async test(): Promise<boolean> {
    return true;
  }
}

const event: NotificationEvent = {
  id: 'evt_test_1',
  type: 'order.completed',
  created_at: '2026-05-22T00:00:00.000Z',
  data: {
    order_id: 'ord_123',
  },
};

const log: NotificationLog = {
  id: 'log_123',
  organization_id: 'org_123',
  endpoint_id: 'endpoint_123',
  event_type: event.type,
  event_id: event.id,
  payload: event,
  status: 'pending',
  retry_count: 0,
  created_at: new Date('2026-05-22T00:00:00.000Z'),
};

function webhookEndpoint(overrides: Partial<Endpoint> = {}): Endpoint {
  return {
    id: 'endpoint_123',
    organization_id: 'org_123',
    endpoint_name: 'Webhook endpoint',
    endpoint_type: 'webhook',
    is_enabled: true,
    config: {
      url: 'https://example.test/webhook',
      secret: 'whsec_test',
    },
    subscribed_events: ['order.completed'],
    max_retries: 3,
    timeout_ms: 1234,
    created_at: new Date('2026-05-22T00:00:00.000Z'),
    updated_at: new Date('2026-05-22T00:00:00.000Z'),
    ...overrides,
  };
}

function repositoryFor(endpoint: Endpoint) {
  return {
    getEndpoint: vi.fn(async () => endpoint),
    updateNotificationLog: vi.fn(async () => undefined),
  } as unknown as NotificationRepository & {
    getEndpoint: ReturnType<typeof vi.fn>;
    updateNotificationLog: ReturnType<typeof vi.fn>;
  };
}

describe('NotificationQueue notifier factory', () => {
  it('uses the default webhook notifier delivery path', async () => {
    const endpoint = webhookEndpoint();
    const repository = repositoryFor(endpoint);
    const queue = new NotificationQueue(repository);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'OK',
    });
    global.fetch = fetchMock;

    await (queue as any).processNotification(log);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.test/webhook');
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
    expect(repository.updateNotificationLog).toHaveBeenCalledWith(
      log.id,
      expect.objectContaining({ status: 'sending' })
    );
    expect(repository.updateNotificationLog).toHaveBeenCalledWith(
      log.id,
      expect.objectContaining({ status: 'success', http_status_code: 200, response_body: 'OK' })
    );
  });

  it('uses an injected factory and passes the endpoint to it', async () => {
    const endpoint = webhookEndpoint({ endpoint_name: 'Injected endpoint' });
    const repository = repositoryFor(endpoint);
    const notifier = new FakeNotifier({ success: true, httpStatusCode: 204, responseBody: 'accepted' });
    const notifierFactory: NotificationNotifierFactory = vi.fn(() => notifier);
    const queue = new NotificationQueue(repository, { notifierFactory });

    await (queue as any).processNotification(log);

    expect(notifierFactory).toHaveBeenCalledTimes(1);
    expect(notifierFactory).toHaveBeenCalledWith(endpoint);
    expect(notifier.send).toHaveBeenCalledWith(event);
    expect(repository.updateNotificationLog).toHaveBeenCalledWith(
      log.id,
      expect.objectContaining({ status: 'success', http_status_code: 204, response_body: 'accepted' })
    );
  });

  it('threads a service-level factory into the queue', async () => {
    const endpoint = webhookEndpoint({ endpoint_name: 'Service factory endpoint' });
    const notifier = new FakeNotifier();
    const notifierFactory: NotificationNotifierFactory = vi.fn(() => notifier);
    const service = new NotificationService({
      database: { connectionString: 'postgres://payin:payin@localhost:5432/payin_test' },
      notifierFactory,
    });

    try {
      expect((service as any).queue.createNotifier(endpoint)).toBe(notifier);
      expect(notifierFactory).toHaveBeenCalledWith(endpoint);
    } finally {
      await (service as any).db.end();
    }
  });

  it('keeps the default unsupported non-webhook behavior', () => {
    const endpoint = webhookEndpoint({
      endpoint_type: 'email',
      config: {
        to: ['ops@example.test'],
      },
    });
    const queue = new NotificationQueue(repositoryFor(endpoint));

    expect(() => (queue as any).createNotifier(endpoint)).toThrow('Unsupported endpoint type: email');
  });
});
