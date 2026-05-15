/**
 * Notification Repository
 * Handles all database operations for notifications
 */

import { Pool, PoolClient } from 'pg';
import type {
  Endpoint,
  CreateEndpointRequest,
  UpdateEndpointRequest,
} from '../types/endpoint.js';
import type {
  NotificationLog,
  NotificationEvent,
  NotificationStatus,
  BusinessType,
} from '../types/notification.js';
import { createLogger, LogCategory } from '@payin/shared';

export class NotificationRepository {
  private readonly logger = createLogger(LogCategory.NOTIFICATION);

  constructor(private db: Pool) {}

  // ==================== Endpoints ====================

  /**
   * Create notification endpoint
   */
  async createEndpoint(request: CreateEndpointRequest): Promise<Endpoint> {
    const query = `
      INSERT INTO notification_endpoints (
        organization_id,
        endpoint_name,
        endpoint_type,
        is_enabled,
        config,
        subscribed_events,
        max_retries,
        timeout_ms,
        description,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      request.organization_id,
      request.endpoint_name,
      request.endpoint_type,
      request.is_enabled ?? true,
      JSON.stringify(request.config),
      JSON.stringify(request.subscribed_events),
      request.max_retries ?? 5,
      request.timeout_ms ?? 30000,
      request.description,
      request.metadata ? JSON.stringify(request.metadata) : null,
    ];

    const result = await this.db.query(query, values);
    return this.mapEndpointRow(result.rows[0]);
  }

  /**
   * Get endpoint by ID
   */
  async getEndpoint(id: string): Promise<Endpoint | null> {
    const query = 'SELECT * FROM notification_endpoints WHERE id = $1';
    const result = await this.db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapEndpointRow(result.rows[0]);
  }

  /**
   * Get endpoint by name
   */
  async getEndpointByName(name: string): Promise<Endpoint | null> {
    const query = 'SELECT * FROM notification_endpoints WHERE endpoint_name = $1';
    const result = await this.db.query(query, [name]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapEndpointRow(result.rows[0]);
  }

  /**
   * List endpoints with filters
   */
  async listEndpoints(filters?: {
    organization_id?: string; // Multi-tenant filtering
    endpoint_type?: string;
    is_enabled?: boolean;
  }): Promise<Endpoint[]> {
    let query = 'SELECT * FROM notification_endpoints WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.organization_id) {
      query += ` AND organization_id = $${paramIndex++}`;
      values.push(filters.organization_id);
    }

    if (filters?.endpoint_type) {
      query += ` AND endpoint_type = $${paramIndex++}`;
      values.push(filters.endpoint_type);
    }

    if (filters?.is_enabled !== undefined) {
      query += ` AND is_enabled = $${paramIndex++}`;
      values.push(filters.is_enabled);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapEndpointRow(row));
  }

  /**
   * Get endpoints subscribed to specific event type
   */
  async getEndpointsByEventType(eventType: string): Promise<Endpoint[]> {
    const query = `
      SELECT * FROM notification_endpoints
      WHERE is_enabled = true
        AND subscribed_events @> $1::jsonb
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [JSON.stringify([eventType])]);
    return result.rows.map(row => this.mapEndpointRow(row));
  }

  /**
   * Update endpoint
   */
  async updateEndpoint(id: string, updates: UpdateEndpointRequest): Promise<Endpoint> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.endpoint_name !== undefined) {
      setClauses.push(`endpoint_name = $${paramIndex++}`);
      values.push(updates.endpoint_name);
    }

    if (updates.is_enabled !== undefined) {
      setClauses.push(`is_enabled = $${paramIndex++}`);
      values.push(updates.is_enabled);
    }

    if (updates.config !== undefined) {
      setClauses.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.config));
    }

    if (updates.subscribed_events !== undefined) {
      setClauses.push(`subscribed_events = $${paramIndex++}`);
      values.push(JSON.stringify(updates.subscribed_events));
    }

    if (updates.max_retries !== undefined) {
      setClauses.push(`max_retries = $${paramIndex++}`);
      values.push(updates.max_retries);
    }

    if (updates.timeout_ms !== undefined) {
      setClauses.push(`timeout_ms = $${paramIndex++}`);
      values.push(updates.timeout_ms);
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    setClauses.push(`updated_at = NOW()`);

    values.push(id);

    const query = `
      UPDATE notification_endpoints
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error(`Endpoint ${id} not found`);
    }

    return this.mapEndpointRow(result.rows[0]);
  }

  /**
   * Delete endpoint
   */
  async deleteEndpoint(id: string): Promise<void> {
    const query = 'DELETE FROM notification_endpoints WHERE id = $1';
    await this.db.query(query, [id]);
  }

  // ==================== Notification Logs ====================

  /**
   * Create notification log
   */
  async createNotificationLog(data: {
    organization_id: string; // Multi-tenant isolation
    endpoint_id: string;
    event_type: string;
    event_id: string;
    business_type?: BusinessType;
    business_id?: string;
    payload: NotificationEvent;
    status: NotificationStatus;
    next_retry_at?: Date;
  }): Promise<NotificationLog> {
    const query = `
      INSERT INTO notification_logs (
        organization_id,
        endpoint_id,
        event_type,
        event_id,
        business_type,
        business_id,
        payload,
        status,
        next_retry_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (event_id, endpoint_id) DO NOTHING
      RETURNING *
    `;

    const values = [
      data.organization_id,
      data.endpoint_id,
      data.event_type,
      data.event_id,
      data.business_type,
      data.business_id,
      JSON.stringify(data.payload),
      data.status,
      data.next_retry_at,
    ];

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      // Duplicate event_id + endpoint_id, fetch existing
      const existing = await this.db.query(
        'SELECT * FROM notification_logs WHERE event_id = $1 AND endpoint_id = $2',
        [data.event_id, data.endpoint_id]
      );
      return this.mapNotificationLogRow(existing.rows[0]);
    }

    return this.mapNotificationLogRow(result.rows[0]);
  }

  /**
   * Update notification log
   */
  async updateNotificationLog(
    id: string,
    updates: {
      status?: NotificationStatus;
      retry_count?: number;
      http_status_code?: number;
      response_body?: string;
      response_time_ms?: number;
      error_message?: string;
      sent_at?: Date;
      completed_at?: Date;
      next_retry_at?: Date;
    }
  ): Promise<NotificationLog> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        setClauses.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    });

    if (setClauses.length === 0) {
      throw new Error('No updates provided');
    }

    values.push(id);

    const query = `
      UPDATE notification_logs
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error(`Notification log ${id} not found`);
    }

    return this.mapNotificationLogRow(result.rows[0]);
  }

  /**
   * Get notification log by ID
   */
  async getNotificationLog(id: string): Promise<NotificationLog | null> {
    const query = 'SELECT * FROM notification_logs WHERE id = $1';
    const result = await this.db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapNotificationLogRow(result.rows[0]);
  }

  /**
   * Get pending notifications for retry
   */
  async getPendingNotifications(limit: number = 100): Promise<NotificationLog[]> {
    const query = `
      SELECT * FROM notification_logs
      WHERE status = 'pending'
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);

    return result.rows.map(row => this.mapNotificationLogRow(row));
  }

  /**
   * Get notification logs with filters
   */
  async getNotificationLogs(filters: {
    organization_id?: string; // Multi-tenant filtering
    endpoint_id?: string;
    event_type?: string;
    status?: NotificationStatus;
    business_type?: BusinessType;
    business_id?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    logs: NotificationLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.organization_id) {
      whereClause += ` AND organization_id = $${paramIndex++}`;
      values.push(filters.organization_id);
    }

    if (filters.endpoint_id) {
      whereClause += ` AND endpoint_id = $${paramIndex++}`;
      values.push(filters.endpoint_id);
    }

    if (filters.event_type) {
      whereClause += ` AND event_type = $${paramIndex++}`;
      values.push(filters.event_type);
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.business_type) {
      whereClause += ` AND business_type = $${paramIndex++}`;
      values.push(filters.business_type);
    }

    if (filters.business_id) {
      whereClause += ` AND business_id = $${paramIndex++}`;
      values.push(filters.business_id);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM notification_logs ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const query = `
      SELECT * FROM notification_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);

    const result = await this.db.query(query, values);
    const logs = result.rows.map(row => this.mapNotificationLogRow(row));

    return { logs, total, page, limit };
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
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    // CRITICAL: Filter by organization for multi-tenant isolation
    if (organizationId) {
      whereClause += ` AND organization_id = $${paramIndex++}`;
      values.push(organizationId);
    }

    if (endpointId) {
      whereClause += ` AND endpoint_id = $${paramIndex++}`;
      values.push(endpointId);
    }

    if (dateRange) {
      whereClause += ` AND created_at >= $${paramIndex++} AND created_at <= $${paramIndex++}`;
      values.push(dateRange.startDate, dateRange.endDate);
    }

    const query = `
      SELECT
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE status = 'success') as total_success,
        COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
        COUNT(*) FILTER (WHERE retry_count > 0) as total_retried,
        AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL) as avg_response_time_ms
      FROM notification_logs
      ${whereClause}
    `;

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  // ==================== Helper Methods ====================

  private mapEndpointRow(row: any): Endpoint {
    return {
      id: row.id,
      organization_id: row.organization_id, // Multi-tenant isolation
      endpoint_name: row.endpoint_name,
      endpoint_type: row.endpoint_type,
      is_enabled: row.is_enabled,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      subscribed_events: typeof row.subscribed_events === 'string'
        ? JSON.parse(row.subscribed_events)
        : row.subscribed_events,
      max_retries: row.max_retries,
      timeout_ms: row.timeout_ms,
      description: row.description,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
    };
  }

  private mapNotificationLogRow(row: any): NotificationLog {
    return {
      id: row.id,
      organization_id: row.organization_id, // Multi-tenant isolation
      endpoint_id: row.endpoint_id,
      event_type: row.event_type,
      event_id: row.event_id,
      business_type: row.business_type,
      business_id: row.business_id,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      status: row.status,
      retry_count: row.retry_count,
      http_status_code: row.http_status_code,
      response_body: row.response_body,
      response_time_ms: row.response_time_ms,
      error_message: row.error_message,
      created_at: row.created_at,
      sent_at: row.sent_at,
      completed_at: row.completed_at,
      next_retry_at: row.next_retry_at,
    };
  }
}
