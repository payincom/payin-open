/**
 * WebhookNotifier Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookNotifier } from '../src/notifiers/webhook-notifier';
import { NotificationEvent } from '../src/types/notification';

describe('WebhookNotifier', () => {
  const testConfig = {
    url: 'https://example.com/webhook',
    secret: 'whsec_test_12345',
    timeoutMs: 5000,
  };

  const testEvent: NotificationEvent = {
    id: 'evt_order_completed_ord_123',
    type: 'order.completed',
    created_at: '2024-12-31T10:00:00Z',
    data: {
      order_id: 'ord_123',
      order_reference: 'ORDER_001',
      amount: '100.00',
      currency: 'USDT',
    },
  };

  let notifier: WebhookNotifier;

  beforeEach(() => {
    notifier = new WebhookNotifier(testConfig);
    // Clear any existing fetch mocks
    vi.clearAllMocks();
  });

  describe('send', () => {
    it('should send webhook with correct headers', async () => {
      // Mock successful response
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      });
      global.fetch = mockFetch;

      const result = await notifier.send(testEvent);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      expect(url).toBe(testConfig.url);
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['X-PayIn-Signature']).toBeDefined();
      expect(options.headers['X-PayIn-Event-Type']).toBe('order.completed');
      expect(options.headers['X-PayIn-Event-Id']).toBe('evt_order_completed_ord_123');
      expect(options.headers['X-PayIn-Delivery-Id']).toMatch(/^dlv_/);
      expect(options.headers['User-Agent']).toBe('PayIn-Webhook/1.0');
      expect(JSON.parse(options.body)).toEqual(testEvent);
    });

    it('should return success result for 200 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'Success',
      });

      const result = await notifier.send(testEvent);

      expect(result.success).toBe(true);
      expect(result.httpStatusCode).toBe(200);
      expect(result.responseBody).toBe('Success');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.deliveryId).toMatch(/^dlv_/);
    });

    it('should return failure for 4xx response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      });

      const result = await notifier.send(testEvent);

      expect(result.success).toBe(false);
      expect(result.httpStatusCode).toBe(404);
      expect(result.responseBody).toBe('Not Found');
    });

    it('should return failure for 5xx response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await notifier.send(testEvent);

      expect(result.success).toBe(false);
      expect(result.httpStatusCode).toBe(500);
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await notifier.send(testEvent);

      expect(result.success).toBe(false);
      expect(result.httpStatusCode).toBeNull();
      expect(result.errorMessage).toBe('Network error');
    });

    it('should handle timeout errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('TimeoutError'));

      const result = await notifier.send(testEvent);

      expect(result.success).toBe(false);
      expect(result.httpStatusCode).toBeNull();
      expect(result.errorMessage).toContain('TimeoutError');
    });

    it('should measure response time', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          ok: true,
          status: 200,
          text: async () => 'OK',
        };
      });

      const result = await notifier.send(testEvent);

      // CI and shared runners can wake timers slightly early/late, so assert
      // that timing is measured without making this test dependent on exact
      // scheduler precision.
      expect(result.responseTime).toBeGreaterThanOrEqual(75);
      expect(result.responseTime).toBeLessThan(300);
    });
  });

  describe('test', () => {
    it('should return true for successful test', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      });

      const result = await notifier.test();

      expect(result).toBe(true);
    });

    it('should return false for failed test', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      });

      const result = await notifier.test();

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await notifier.test();

      expect(result).toBe(false);
    });

    it('should send test event with correct format', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      });
      global.fetch = mockFetch;

      await notifier.test();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body.type).toBe('test.event');
      expect(body.data.message).toContain('test notification');
    });
  });
});
