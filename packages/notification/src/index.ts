/**
 * @payin/notification
 * Notification service for PayIn
 */

// Types
export * from './types/index.js';

// Utils
export {
  generateSignature,
  verifySignature,
  generateEventId,
  generateDeliveryId,
} from './utils/signature.js';
export {
  calculateRetryDelay,
  calculateNextRetryAt,
  shouldRetry,
  hasRetriesLeft,
  shouldScheduleRetry,
} from './utils/retry-strategy.js';
export { mapOrderStatusEvent, mapDepositEvent } from './utils/event-mapper.js';

// Database
export { ALL_SCHEMAS, TABLE_NAMES } from './database/schema.js';

// Notifiers
export { BaseNotifier } from './notifiers/base-notifier.js';
export { WebhookNotifier } from './notifiers/webhook-notifier.js';

// Main service
export {
  NotificationService,
  notificationRuntimeScopeToOrganizationId,
} from './notification-service.js';
export type {
  NotificationServiceConfig,
  NotificationRuntimeScope,
} from './notification-service.js';

// Repository
export { NotificationRepository } from './repository/notification.repository.js';

// Queue
export { NotificationQueue } from './queue/notification-queue.js';
export type { NotificationNotifierFactory, QueueConfig } from './queue/notification-queue.js';

// Database
export { initializeDatabase, dropAllTables, tablesExist } from './database/database.js';
