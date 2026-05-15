/**
 * Base Notifier Abstract Class
 * All notifiers (Webhook, Email, Telegram) extend this class
 */

import { NotificationEvent, NotificationResult } from '../types/notification.js';

export abstract class BaseNotifier {
  /**
   * Send notification
   *
   * @param event - Notification event to send
   * @returns Notification result with status and metadata
   */
  abstract send(event: NotificationEvent): Promise<NotificationResult>;

  /**
   * Test notification endpoint
   *
   * @returns true if endpoint is reachable and valid
   */
  abstract test(): Promise<boolean>;
}
