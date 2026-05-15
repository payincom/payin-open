/**
 * Webhook Notifier
 * Sends notifications via HTTP POST with HMAC signature
 */

import { BaseNotifier } from './base-notifier.js';
import { generateSignature, generateDeliveryId } from '../utils/signature.js';
import type { NotificationEvent, NotificationResult } from '../types/notification.js';
import { createLogger, LogCategory } from '@payin/shared';

export interface WebhookConfig {
  url: string;
  secret: string;
  timeoutMs?: number;
}

export class WebhookNotifier extends BaseNotifier {
  private readonly logger = createLogger(LogCategory.NOTIFICATION);

  constructor(private config: WebhookConfig) {
    super();
  }

  async send(event: NotificationEvent): Promise<NotificationResult> {
    const startTime = performance.now();

    try {
      // Generate signature
      const signature = generateSignature(event, this.config.secret);

      // Generate unique delivery ID
      const deliveryId = generateDeliveryId();

      // Prepare request
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PayIn-Signature': signature,
          'X-PayIn-Event-Type': event.type,
          'X-PayIn-Event-Id': event.id,
          'X-PayIn-Delivery-Id': deliveryId,
          'User-Agent': 'PayIn-Webhook/1.0',
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(this.config.timeoutMs || 30000),
      });

      const responseTime = Math.round(Math.max(performance.now() - startTime, 1));
      const responseBody = await response.text();

      this.logger.info(`Webhook sent: ${event.type} to ${this.config.url}`, {
        status: response.status,
        responseTime,
        deliveryId,
      });

      return {
        success: response.ok,
        httpStatusCode: response.status,
        responseBody,
        responseTime,
        deliveryId,
      };
    } catch (error: any) {
      const responseTime = Math.round(Math.max(performance.now() - startTime, 1));

      this.logger.error(`Webhook failed: ${event.type} to ${this.config.url}`, error);

      return {
        success: false,
        httpStatusCode: null,
        responseBody: null,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
      };
    }
  }

  async test(): Promise<boolean> {
    try {
      const testEvent: NotificationEvent = {
        id: `test_${Date.now()}`,
        type: 'test.event',
        created_at: new Date().toISOString(),
        data: {
          message: 'This is a test notification from PayIn',
        },
      };

      const result = await this.send(testEvent);
      return result.success;
    } catch {
      return false;
    }
  }
}
