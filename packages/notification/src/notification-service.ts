/**
 * Notification Service
 * Main service for sending notifications via webhook, email, telegram, etc.
 */

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { NotificationRepository } from './repository/notification.repository.js';
import { NotificationQueue, QueueConfig } from './queue/notification-queue.js';
import { initializeDatabase } from './database/database.js';
import type {
  NotificationEvent,
  Endpoint,
  CreateEndpointRequest,
  UpdateEndpointRequest,
} from './types/index.js';
import { createLogger, LogCategory } from '@payin/shared';

export interface NotificationPaymentScope {
  id: string;
  kind?: string;
  label?: string;
}

export type NotificationRuntimeScope =
  | NotificationPaymentScope
  | { paymentScope: NotificationPaymentScope };

export function notificationRuntimeScopeToOrganizationId(
  scope: NotificationRuntimeScope | undefined
): string | undefined {
  if (!scope) return undefined;

  if ('paymentScope' in scope) {
    return scope.paymentScope.id;
  }

  return scope.id;
}

export interface NotificationServiceConfig {
  database: {
    connectionString: string;
  };
  queue?: QueueConfig;
}

export class NotificationService extends EventEmitter {
  private readonly logger = createLogger(LogCategory.NOTIFICATION);
  private readonly db: Pool;
  private readonly repository: NotificationRepository;
  private readonly queue: NotificationQueue;
  private isStarted = false;

  constructor(private config: NotificationServiceConfig) {
    super();
    this.db = new Pool({ connectionString: config.database.connectionString });
    this.repository = new NotificationRepository(this.db);
    this.queue = new NotificationQueue(this.repository, config.queue);
  }

  /**
   * Start notification service
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('NotificationService already started');
      return;
    }

    this.logger.info('Starting NotificationService...');

    try {
      // Initialize database tables
      await initializeDatabase(this.config.database.connectionString);

      // Start queue
      await this.queue.start();

      this.isStarted = true;
      this.logger.info('NotificationService started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start NotificationService:', error);
      throw error;
    }
  }

  /**
   * Stop notification service
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.logger.info('Stopping NotificationService...');

    try {
      // Stop queue
      await this.queue.stop();

      // Close database connection
      await this.db.end();

      this.isStarted = false;
      this.logger.info('NotificationService stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error stopping NotificationService:', error);
      throw error;
    }
  }

  /**
   * Send notification to all subscribed endpoints
   *
   * @param event - Notification event
   */
  async sendNotification(event: NotificationEvent): Promise<void> {
    if (!this.isStarted) {
      throw new Error('NotificationService not started');
    }

    try {
      // Get all enabled endpoints that subscribe to this event type
      const endpoints = await this.repository.getEndpointsByEventType(event.type);

      if (endpoints.length === 0) {
        this.logger.debug(`No endpoints subscribed to event type: ${event.type}`);
        return;
      }

      this.logger.info(`Sending notification: ${event.type} to ${endpoints.length} endpoints`, {
        eventId: event.id,
        eventType: event.type,
      });

      // Queue notifications for each endpoint
      for (const endpoint of endpoints) {
        await this.queue.enqueue({
          endpointId: endpoint.id,
          event,
        });
      }

      this.emit('notification_queued', { event, endpointCount: endpoints.length });
    } catch (error) {
      this.logger.error('Failed to send notification:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // ==================== Endpoint Management ====================

  /**
   * Create notification endpoint
   */
  async createEndpoint(request: CreateEndpointRequest): Promise<Endpoint> {
    return await this.repository.createEndpoint(request);
  }

  /**
   * Create endpoint with neutral runtime/payment scope.
   *
   * Compatibility seam: callers pass RuntimeContext/PaymentScope while the
   * repository still persists organization_id.
   */
  async createEndpointForRuntimeScope(
    scope: NotificationRuntimeScope,
    request: Omit<CreateEndpointRequest, 'organization_id'> & Record<string, unknown>
  ): Promise<Endpoint> {
    return await this.createEndpoint({
      ...request,
      organization_id: notificationRuntimeScopeToOrganizationId(scope) as string,
    } as CreateEndpointRequest);
  }

  /**
   * Get endpoint by ID
   */
  async getEndpoint(id: string, organizationId?: string): Promise<Endpoint | null> {
    return await this.repository.getEndpoint(id, organizationId);
  }

  async getEndpointForRuntimeScope(
    id: string,
    scope: NotificationRuntimeScope
  ): Promise<Endpoint | null> {
    return await this.getEndpoint(id, notificationRuntimeScopeToOrganizationId(scope));
  }

  /**
   * Get endpoint by name
   */
  async getEndpointByName(name: string): Promise<Endpoint | null> {
    return await this.repository.getEndpointByName(name);
  }

  /**
   * List all endpoints
   */
  async listEndpoints(filters?: {
    organization_id?: string;
    endpoint_type?: string;
    is_enabled?: boolean;
  }): Promise<Endpoint[]> {
    return await this.repository.listEndpoints(filters);
  }

  async listEndpointsForRuntimeScope(
    scope: NotificationRuntimeScope,
    filters: Omit<
      NonNullable<Parameters<NotificationService['listEndpoints']>[0]>,
      'organization_id'
    > = {}
  ): Promise<Endpoint[]> {
    return await this.listEndpoints({
      ...filters,
      organization_id: notificationRuntimeScopeToOrganizationId(scope),
    });
  }

  /**
   * Update endpoint
   */
  async updateEndpoint(
    id: string,
    updates: UpdateEndpointRequest,
    organizationId?: string
  ): Promise<Endpoint> {
    return await this.repository.updateEndpoint(id, updates, organizationId);
  }

  async updateEndpointForRuntimeScope(
    id: string,
    updates: UpdateEndpointRequest,
    scope: NotificationRuntimeScope
  ): Promise<Endpoint> {
    return await this.updateEndpoint(id, updates, notificationRuntimeScopeToOrganizationId(scope));
  }

  /**
   * Delete endpoint
   */
  async deleteEndpoint(id: string, organizationId?: string): Promise<void> {
    await this.repository.deleteEndpoint(id, organizationId);
  }

  async deleteEndpointForRuntimeScope(id: string, scope: NotificationRuntimeScope): Promise<void> {
    await this.deleteEndpoint(id, notificationRuntimeScopeToOrganizationId(scope));
  }

  /**
   * Test endpoint by sending a test notification
   */
  async testEndpoint(id: string, organizationId?: string): Promise<boolean> {
    const endpoint = await this.repository.getEndpoint(id, organizationId);

    if (!endpoint) {
      throw new Error(`Endpoint ${id} not found`);
    }

    const testEvent: NotificationEvent = {
      id: `test_${Date.now()}`,
      type: 'test.event',
      created_at: new Date().toISOString(),
      data: {
        message: 'This is a test notification from PayIn',
        endpoint_id: id,
        endpoint_name: endpoint.endpoint_name,
      },
    };

    // Send directly without queuing
    try {
      await this.queue.enqueue({
        endpointId: id,
        event: testEvent,
      });

      return true;
    } catch {
      return false;
    }
  }

  async testEndpointForRuntimeScope(id: string, scope: NotificationRuntimeScope): Promise<boolean> {
    return await this.testEndpoint(id, notificationRuntimeScopeToOrganizationId(scope));
  }

  // ==================== Notification Logs ====================

  /**
   * Get notification logs
   */
  async getNotificationLogs(filters: {
    organization_id?: string;
    endpoint_id?: string;
    event_type?: string;
    status?: string;
    business_type?: string;
    business_id?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    return await this.repository.getNotificationLogs(filters as any);
  }

  async getNotificationLogsForRuntimeScope(
    scope: NotificationRuntimeScope,
    filters: Omit<Parameters<NotificationService['getNotificationLogs']>[0], 'organization_id'>
  ): Promise<any> {
    return await this.getNotificationLogs({
      ...filters,
      organization_id: notificationRuntimeScopeToOrganizationId(scope),
    });
  }

  /**
   * Get notification log by ID
   */
  async getNotificationLog(id: string): Promise<any> {
    return await this.repository.getNotificationLog(id);
  }

  async getNotificationLogForRuntimeScope(
    id: string,
    scope: NotificationRuntimeScope
  ): Promise<any | null> {
    const log = await this.getNotificationLog(id);
    if (!log || log.organization_id !== notificationRuntimeScopeToOrganizationId(scope)) {
      return null;
    }
    return log;
  }

  /**
   * Manual retry notification
   */
  async retryNotification(logId: string): Promise<void> {
    await this.queue.retryNotification(logId);
  }

  /**
   * Batch retry failed notifications
   */
  async retryFailedNotificationsForRuntimeScope(
    scope: NotificationRuntimeScope,
    filters: Omit<Parameters<NotificationService['retryFailedNotifications']>[0], 'organization_id'>
  ): Promise<number> {
    return await this.retryFailedNotifications({
      ...filters,
      organization_id: notificationRuntimeScopeToOrganizationId(scope),
    });
  }

  async retryFailedNotifications(filters: {
    organization_id?: string;
    endpoint_id?: string;
    event_type?: string;
    failed_after?: string;
  }): Promise<number> {
    const logs = await this.repository.getNotificationLogs({
      ...filters,
      status: 'failed' as any,
      limit: 1000,
    });

    let retried = 0;

    for (const log of logs.logs) {
      try {
        await this.queue.retryNotification(log.id);
        retried++;
      } catch (error) {
        this.logger.error(`Failed to retry notification ${log.id}:`, error);
      }
    }

    this.logger.info(`Retried ${retried} failed notifications`);
    return retried;
  }

  // ==================== Statistics ====================

  /**
   * Get notification statistics
   */
  async getStatistics(
    organizationId?: string,
    endpointId?: string,
    dateRange?: { startDate: string; endDate: string }
  ): Promise<any> {
    return await this.repository.getStatistics(organizationId, endpointId, dateRange);
  }

  async getStatisticsForRuntimeScope(
    scope: NotificationRuntimeScope,
    endpointId?: string,
    dateRange?: { startDate: string; endDate: string }
  ): Promise<any> {
    return await this.getStatistics(
      notificationRuntimeScopeToOrganizationId(scope),
      endpointId,
      dateRange
    );
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    isRunning: boolean;
    activeJobs: number;
    maxConcurrency: number;
  } {
    return this.queue.getStatus();
  }

  /**
   * Get service status
   */
  getStatus(): {
    isStarted: boolean;
    queue: ReturnType<typeof this.queue.getStatus>;
  } {
    return {
      isStarted: this.isStarted,
      queue: this.queue.getStatus(),
    };
  }

  // ==================== Static Factory Method ====================

  /**
   * Create NotificationService instance
   */
  static async create(config: NotificationServiceConfig): Promise<NotificationService> {
    const service = new NotificationService(config);
    return service;
  }
}
