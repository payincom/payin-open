/**
 * Notification Queue
 * Manages notification delivery queue with retry mechanism
 */

import { NotificationRepository } from '../repository/notification.repository.js';
import { WebhookNotifier } from '../notifiers/webhook-notifier.js';
import type { Endpoint, WebhookConfig } from '../types/endpoint.js';
import type { NotificationEvent, NotificationLog, QueueItem } from '../types/notification.js';
import { calculateNextRetryAt, shouldScheduleRetry } from '../utils/retry-strategy.js';
import { createLogger, LogCategory } from '@payin/shared';

export interface QueueConfig {
  maxConcurrency?: number;
  checkIntervalMs?: number;
  batchSize?: number;
}

const DEFAULT_QUEUE_CONFIG: Required<QueueConfig> = {
  maxConcurrency: 10,
  checkIntervalMs: 5000,
  batchSize: 50,
};

export class NotificationQueue {
  private readonly logger = createLogger(LogCategory.NOTIFICATION);
  private readonly config: Required<QueueConfig>;
  private isRunning = false;
  private checkTimer?: NodeJS.Timeout;
  private activeJobs = 0;

  constructor(
    private repository: NotificationRepository,
    config?: QueueConfig
  ) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  /**
   * Start queue processing
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Queue already running');
      return;
    }

    this.isRunning = true;

    this.logger.info('Starting notification queue...', {
      maxConcurrency: this.config.maxConcurrency,
      checkIntervalMs: this.config.checkIntervalMs,
    });

    this.scheduleNextCheck();
  }

  /**
   * Stop queue processing
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = undefined;
    }

    // Wait for active jobs to complete
    while (this.activeJobs > 0) {
      this.logger.info(`Waiting for ${this.activeJobs} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.logger.info('Notification queue stopped');
  }

  /**
   * Enqueue notification for delivery
   *
   * @param item - Queue item with endpoint and event
   */
  async enqueue(item: QueueItem): Promise<void> {
    const { endpointId, event } = item;

    try {
      // Get endpoint to retrieve organization_id
      const endpoint = await this.repository.getEndpoint(endpointId);
      if (!endpoint) {
        throw new Error(`Endpoint ${endpointId} not found`);
      }

      // Extract business context from event
      const businessType = this.extractBusinessType(event.type);
      const businessId = this.extractBusinessId(event);

      // Create notification log (with idempotency check)
      await this.repository.createNotificationLog({
        organization_id: endpoint.organization_id, // Multi-tenant isolation
        endpoint_id: endpointId,
        event_type: event.type,
        event_id: event.id,
        business_type: businessType,
        business_id: businessId,
        payload: event,
        status: 'pending',
      });

      this.logger.debug(`Enqueued notification: ${event.type} for endpoint ${endpointId}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue notification:`, error);
      throw error;
    }
  }

  /**
   * Manually retry a failed notification
   *
   * @param logId - Notification log ID
   */
  async retryNotification(logId: string): Promise<void> {
    const log = await this.repository.getNotificationLog(logId);

    if (!log) {
      throw new Error(`Notification log ${logId} not found`);
    }

    if (log.status !== 'failed' && log.status !== 'pending') {
      throw new Error(`Cannot retry notification in status: ${log.status}`);
    }

    // Reset to pending for retry
    await this.repository.updateNotificationLog(logId, {
      status: 'pending',
      next_retry_at: new Date(), // Retry immediately
    });

    this.logger.info(`Manually queued notification ${logId} for retry`);
  }

  /**
   * Process queue (called periodically)
   */
  private async processQueue(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Check how many slots available
      const availableSlots = this.config.maxConcurrency - this.activeJobs;

      if (availableSlots <= 0) {
        this.logger.debug('Queue at max concurrency, skipping');
        return;
      }

      // Fetch pending notifications
      const fetchLimit = Math.min(availableSlots, this.config.batchSize);

      const pending = await this.repository.getPendingNotifications(fetchLimit);

      if (pending.length === 0) {
        return;
      }

      this.logger.debug(`Processing ${pending.length} pending notifications`);

      // Process each notification (in parallel up to concurrency limit)
      const promises = pending.map(log => this.processNotification(log));
      await Promise.all(promises);

    } catch (error) {
      this.logger.error('Error processing queue:', error);
    } finally {
      this.scheduleNextCheck();
    }
  }

  /**
   * Process single notification
   */
  private async processNotification(log: NotificationLog): Promise<void> {
    this.activeJobs++;

    try {
      // Get endpoint
      const endpoint = await this.repository.getEndpoint(log.endpoint_id);

      if (!endpoint) {
        this.logger.error(`Endpoint ${log.endpoint_id} not found for notification ${log.id}`);
        await this.repository.updateNotificationLog(log.id, {
          status: 'failed',
          error_message: 'Endpoint not found',
          completed_at: new Date(),
        });
        return;
      }

      if (!endpoint.is_enabled) {
        this.logger.warn(`Endpoint ${log.endpoint_id} is disabled, cancelling notification ${log.id}`);
        await this.repository.updateNotificationLog(log.id, {
          status: 'cancelled',
          completed_at: new Date(),
        });
        return;
      }

      // Update status to sending
      await this.repository.updateNotificationLog(log.id, {
        status: 'sending',
        sent_at: new Date(),
      });

      // Send notification
      const notifier = this.createNotifier(endpoint);
      const result = await notifier.send(log.payload);

      // Update based on result
      if (result.success) {
        // Success
        await this.repository.updateNotificationLog(log.id, {
          status: 'success',
          http_status_code: result.httpStatusCode,
          response_body: result.responseBody,
          response_time_ms: result.responseTime,
          completed_at: new Date(),
        });

        this.logger.info(`Notification ${log.id} delivered successfully`);
      } else {
        // Failed - check if should retry
        const shouldRetry = shouldScheduleRetry(
          result.httpStatusCode,
          log.retry_count,
          {
            maxRetries: endpoint.max_retries,
            initialDelayMs: 1000,
            maxDelayMs: 16000,
            backoffMultiplier: 2,
          }
        );

        if (shouldRetry) {
          // Schedule retry
          const nextRetryAt = calculateNextRetryAt(log.retry_count, {
            maxRetries: endpoint.max_retries,
            initialDelayMs: 1000,
            maxDelayMs: 16000,
            backoffMultiplier: 2,
          });

          await this.repository.updateNotificationLog(log.id, {
            status: 'pending',
            retry_count: log.retry_count + 1,
            http_status_code: result.httpStatusCode || undefined,
            response_body: result.responseBody || undefined,
            response_time_ms: result.responseTime,
            error_message: result.errorMessage,
            next_retry_at: nextRetryAt,
          });

          this.logger.warn(`Notification ${log.id} failed, scheduled retry ${log.retry_count + 1}/${endpoint.max_retries}`);
        } else {
          // Max retries reached or non-retryable error
          await this.repository.updateNotificationLog(log.id, {
            status: 'failed',
            http_status_code: result.httpStatusCode || undefined,
            response_body: result.responseBody || undefined,
            response_time_ms: result.responseTime,
            error_message: result.errorMessage,
            completed_at: new Date(),
          });

          this.logger.error(`Notification ${log.id} permanently failed`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing notification ${log.id}:`, error);

      // Mark as failed
      await this.repository.updateNotificationLog(log.id, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date(),
      });
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * Schedule next queue check
   */
  private scheduleNextCheck(): void {
    if (!this.isRunning) {
      return;
    }

    this.checkTimer = setTimeout(() => {
      this.processQueue();
    }, this.config.checkIntervalMs);
  }

  /**
   * Create notifier based on endpoint type
   */
  private createNotifier(endpoint: Endpoint): WebhookNotifier {
    switch (endpoint.endpoint_type) {
      case 'webhook':
        return new WebhookNotifier({
          url: (endpoint.config as WebhookConfig).url,
          secret: (endpoint.config as WebhookConfig).secret,
          timeoutMs: endpoint.timeout_ms,
        });
      default:
        throw new Error(`Unsupported endpoint type: ${endpoint.endpoint_type}`);
    }
  }

  /**
   * Extract business type from event type
   */
  private extractBusinessType(eventType: string): 'order' | 'deposit' | 'transfer' | undefined {
    if (eventType.startsWith('order.')) return 'order';
    if (eventType.startsWith('deposit.')) return 'deposit';
    if (eventType.startsWith('transfer.')) return 'transfer';
    return undefined;
  }

  /**
   * Extract business ID from event data
   */
  private extractBusinessId(event: NotificationEvent): string | undefined {
    const data = event.data;

    if (data.order_id) return data.order_id;
    if (data.deposit_reference) return data.deposit_reference;
    if (data.tx_hash) return data.tx_hash;

    return undefined;
  }

  /**
   * Get queue status
   */
  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    maxConcurrency: number;
  } {
    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs,
      maxConcurrency: this.config.maxConcurrency,
    };
  }
}
