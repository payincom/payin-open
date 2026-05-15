import type { PostgreSQLDatabase } from '../database/database.js';

// This is the TRUE representation of the orders table based on schema in database.ts.
export interface OrderDbObject {
  id: string;
  organization_id: string; // Multi-tenant isolation
  order_reference: string;
  amount: string;
  token: string;
  chain: string;
  address: string;
  required_confirmations: number;
  status: string;
  created_at: Date;
  payment_window_ends_at: Date;
  grace_period_ends_at: Date;
  payment_window_minutes: number;
  grace_period_minutes: number;
  first_transfer_detected_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
  confirmed_received: string;
  metadata: Record<string, any> | null;
  success_url: string | null;
  cancel_url: string | null;
}

export type CreateOrderData = Omit<OrderDbObject, 'created_at' | 'updated_at' | 'first_transfer_detected_at' | 'completed_at'>;
export type UpdateOrderData = Partial<Omit<OrderDbObject, 'id' | 'created_at' | 'updated_at'>>;

export class OrderRepository {
  constructor(private db: PostgreSQLDatabase) {}

  private mapRowToOrder(row: any): OrderDbObject | null {
    if (!row) return null;
    return {
      id: row.id,
      organization_id: row.organization_id, // Multi-tenant isolation
      order_reference: row.order_reference,
      amount: row.amount,
      token: row.token,
      chain: row.chain,
      address: row.address,
      required_confirmations: row.required_confirmations,
      status: row.status,
      created_at: new Date(row.created_at),
      payment_window_ends_at: new Date(row.payment_window_ends_at),
      grace_period_ends_at: new Date(row.grace_period_ends_at),
      payment_window_minutes: row.payment_window_minutes,
      grace_period_minutes: row.grace_period_minutes,
      first_transfer_detected_at: row.first_transfer_detected_at ? new Date(row.first_transfer_detected_at) : null,
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      updated_at: new Date(row.updated_at),
      confirmed_received: row.confirmed_received,
      metadata: row.metadata,
      success_url: row.success_url,
      cancel_url: row.cancel_url,
    };
  }

  public async findById(id: string, organizationId?: string): Promise<OrderDbObject | null> {
    if (organizationId) {
      // Multi-tenant filtering - only return order if it belongs to the specified organization
      const rows = await this.db.query(
        'SELECT * FROM orders WHERE id = $1 AND organization_id = $2',
        [id, organizationId]
      );
      return this.mapRowToOrder(rows[0]);
    } else {
      // Internal use without filtering
      const rows = await this.db.query('SELECT * FROM orders WHERE id = $1', [id]);
      return this.mapRowToOrder(rows[0]);
    }
  }

  public async findPendingOrders(): Promise<OrderDbObject[]> {
    const rows = await this.db.query(`SELECT * FROM orders WHERE status = 'pending'`);
    return rows.map(row => this.mapRowToOrder(row)!).filter(Boolean) as OrderDbObject[];
  }

  public async findByStatus(status: string): Promise<OrderDbObject[]> {
    const rows = await this.db.query(`SELECT * FROM orders WHERE status = $1 ORDER BY created_at ASC`, [status]);
    return rows.map(row => this.mapRowToOrder(row)!).filter(Boolean) as OrderDbObject[];
  }

  public async create(data: CreateOrderData): Promise<OrderDbObject> {
    const sql = `
      INSERT INTO orders (
        id, order_reference, amount, token, chain, address, required_confirmations,
        status, payment_window_ends_at, grace_period_ends_at, payment_window_minutes,
        grace_period_minutes, confirmed_received, metadata, success_url, cancel_url, organization_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *;
    `;
    const params = [
      data.id,
      data.order_reference,
      data.amount,
      data.token,
      data.chain,
      data.address,
      data.required_confirmations,
      data.status,
      data.payment_window_ends_at,
      data.grace_period_ends_at,
      data.payment_window_minutes,
      data.grace_period_minutes,
      data.confirmed_received,
      data.metadata,
      data.success_url,
      data.cancel_url,
      data.organization_id,
    ];

    const rows = await this.db.query(sql, params);
    return this.mapRowToOrder(rows[0])!;
  }

  public async update(id: string, data: UpdateOrderData): Promise<OrderDbObject | null> {
    const fields = Object.keys(data);
    const params = Object.values(data);

    if (fields.length === 0) {
      return this.findById(id);
    }

    const setClause = fields.map((field, index) => `"${field}" = $${index + 2}`).join(', ');

    const sql = `
      UPDATE orders
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    const rows = await this.db.query(sql, [id, ...params]);
    return this.mapRowToOrder(rows[0]);
  }

  /**
   * Find orders with filtering, pagination and sorting
   */
  public async findAll(filters: {
    organizationId?: string; // Multi-tenant filtering
    status?: string | string[];
    chain?: string;
    token?: string;
    orderReference?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    page?: number;
    limit?: number;
    sortBy?: 'created_at' | 'updated_at' | 'amount';
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<{ orders: OrderDbObject[]; total: number; page: number; limit: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    // Multi-tenant filtering - ALWAYS filter by organization if provided
    if (filters.organizationId) {
      conditions.push(`organization_id = $${paramIndex++}`);
      params.push(filters.organizationId);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        const placeholders = filters.status.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`status IN (${placeholders})`);
        params.push(...filters.status);
      } else {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filters.status);
      }
    }

    if (filters.chain) {
      conditions.push(`chain = $${paramIndex++}`);
      params.push(filters.chain);
    }

    if (filters.token) {
      conditions.push(`token = $${paramIndex++}`);
      params.push(filters.token);
    }

    if (filters.orderReference) {
      conditions.push(`order_reference ILIKE $${paramIndex++}`);
      params.push(`%${filters.orderReference}%`);
    }

    if (filters.createdAfter) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.createdAfter);
    }

    if (filters.createdBefore) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.createdBefore);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Sorting
    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'DESC';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM orders ${whereClause}`;
    const countResult = await this.db.query(countSql, params);
    const total = parseInt(countResult[0]?.total || '0', 10);

    // Get orders
    const sql = `
      SELECT * FROM orders
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const rows = await this.db.query(sql, [...params, limit, offset]);
    const orders = rows.map(row => this.mapRowToOrder(row)!).filter(Boolean);

    return { orders, total, page, limit };
  }

  /**
   * Get order statistics
   */
  public async getStatistics(filters: {
    organizationId?: string; // Multi-tenant filtering
    chain?: string;
    token?: string;
    createdAfter?: Date;
    createdBefore?: Date;
  } = {}): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    expiredOrders: number;
    totalAmount: string;
    completedAmount: string;
    avgPaymentTimeSeconds: number;
    byStatus: Record<string, number>;
    byChain: Record<string, number>;
    byToken: Record<string, number>;
  }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Multi-tenant filtering - ALWAYS filter by organization if provided
    if (filters.organizationId) {
      conditions.push(`o.organization_id = $${paramIndex++}`);
      params.push(filters.organizationId);
    }

    if (filters.chain) {
      conditions.push(`o.chain = $${paramIndex++}`);
      params.push(filters.chain);
    }

    if (filters.token) {
      conditions.push(`o.token = $${paramIndex++}`);
      params.push(filters.token);
    }

    if (filters.createdAfter) {
      conditions.push(`o.created_at >= $${paramIndex++}`);
      params.push(filters.createdAfter);
    }

    if (filters.createdBefore) {
      conditions.push(`o.created_at <= $${paramIndex++}`);
      params.push(filters.createdBefore);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get overall statistics with avg payment time from transfers table
    const sql = `
      WITH first_transfers AS (
        SELECT
          order_id,
          MIN(detected_at) as first_detected_at
        FROM transfers
        WHERE business_type = 'order'
        GROUP BY order_id
      )
      SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN o.status = 'expired' THEN 1 END) as expired_orders,
        COALESCE(SUM(o.amount::numeric), 0) as total_amount,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.amount::numeric ELSE 0 END), 0) as completed_amount,
        COALESCE(
          AVG(
            EXTRACT(EPOCH FROM (ft.first_detected_at - o.created_at))
          ),
          0
        ) as avg_payment_time_seconds
      FROM orders o
      LEFT JOIN first_transfers ft ON o.id = ft.order_id
      ${whereClause}
    `;

    const result = await this.db.query(sql, params);
    const stats = result[0];

    // Get by status
    const statusSql = `
      SELECT status, COUNT(*) as count
      FROM orders o
      ${whereClause}
      GROUP BY status
    `;
    const statusResult = await this.db.query(statusSql, params);
    const byStatus: Record<string, number> = {};
    statusResult.forEach((row: any) => {
      byStatus[row.status] = parseInt(row.count, 10);
    });

    // Get by chain
    const chainSql = `
      SELECT chain, COUNT(*) as count
      FROM orders o
      ${whereClause}
      GROUP BY chain
    `;
    const chainResult = await this.db.query(chainSql, params);
    const byChain: Record<string, number> = {};
    chainResult.forEach((row: any) => {
      byChain[row.chain] = parseInt(row.count, 10);
    });

    // Get by token
    const tokenSql = `
      SELECT token, COUNT(*) as count
      FROM orders o
      ${whereClause}
      GROUP BY token
    `;
    const tokenResult = await this.db.query(tokenSql, params);
    const byToken: Record<string, number> = {};
    tokenResult.forEach((row: any) => {
      byToken[row.token] = parseInt(row.count, 10);
    });

    return {
      totalOrders: parseInt(stats.total_orders, 10),
      completedOrders: parseInt(stats.completed_orders, 10),
      pendingOrders: parseInt(stats.pending_orders, 10),
      expiredOrders: parseInt(stats.expired_orders, 10),
      totalAmount: stats.total_amount.toString(),
      completedAmount: stats.completed_amount.toString(),
      avgPaymentTimeSeconds: parseFloat(stats.avg_payment_time_seconds || '0'),
      byStatus,
      byChain,
      byToken,
    };
  }
}