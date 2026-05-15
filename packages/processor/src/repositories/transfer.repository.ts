import type { PostgreSQLDatabase } from '../database/database.js';

export interface TransferDbObject {
  id: string;
  organization_id: string; // Multi-tenant isolation
  order_id: string | null;
  deposit_reference: string | null;
  business_type: 'order' | 'deposit';
  transaction_hash: string;
  block_number: number;
  event_index: number;
  chain: string;
  token: string;
  amount: string;
  from_address: string;
  to_address: string;
  last_checked_confirmations: number;
  required_confirmations: number;
  is_confirmed: boolean;
  is_failed: boolean;
  detected_at: Date;
  confirmed_at: Date | null;
  last_error: string | null;
}

export type CreateTransferData = Omit<TransferDbObject, 'confirmed_at' | 'last_error' | 'detected_at'>;
export type UpdateTransferData = Partial<Pick<TransferDbObject, 'is_confirmed' | 'is_failed' | 'confirmed_at' | 'last_checked_confirmations' | 'last_error'>
>;

export class TransferRepository {
  constructor(private db: PostgreSQLDatabase) {}

  private mapRowToTransfer(row: any): TransferDbObject | null {
    if (!row) return null;
    return {
      ...row,
      amount: row.amount.toString(),
      is_confirmed: Boolean(row.is_confirmed),
      is_failed: Boolean(row.is_failed),
      detected_at: new Date(row.detected_at),
      confirmed_at: row.confirmed_at ? new Date(row.confirmed_at) : null,
    };
  }

  public async findByTxHashAndEventIndex(txHash: string, eventIndex: number): Promise<TransferDbObject | null> {
    const rows = await this.db.query(
      `SELECT * FROM transfers WHERE transaction_hash = $1 AND event_index = $2`,
      [txHash, eventIndex]
    );
    return this.mapRowToTransfer(rows[0]);
  }

  public async findByTransactionHash(txHash: string): Promise<TransferDbObject[]> {
    const rows = await this.db.query(
      `SELECT * FROM transfers WHERE transaction_hash = $1 ORDER BY event_index ASC`,
      [txHash]
    );
    return rows.map(row => this.mapRowToTransfer(row)!).filter(Boolean);
  }

  public async findByOrderId(orderId: string): Promise<TransferDbObject[]> {
    const rows = await this.db.query(`SELECT * FROM transfers WHERE order_id = $1 ORDER BY detected_at ASC`, [orderId]);
    return rows.map(row => this.mapRowToTransfer(row)!).filter(Boolean);
  }
  
  public async findConfirmedByOrderId(orderId: string): Promise<TransferDbObject[]> {
    const rows = await this.db.query(`SELECT * FROM transfers WHERE order_id = $1 AND is_confirmed = true`, [orderId]);
    return rows.map(row => this.mapRowToTransfer(row)!).filter(Boolean);
  }

  public async findByDepositReference(depositReference: string): Promise<TransferDbObject[]> {
    const rows = await this.db.query(`SELECT * FROM transfers WHERE deposit_reference = $1 ORDER BY detected_at ASC`, [depositReference]);
    return rows.map(row => this.mapRowToTransfer(row)!).filter(Boolean);
  }

  public async create(data: CreateTransferData): Promise<TransferDbObject> {
    const sql = `
      INSERT INTO transfers (
        id, organization_id, order_id, deposit_reference, business_type, transaction_hash, block_number,
        event_index, chain, token, amount, from_address, to_address,
        last_checked_confirmations, required_confirmations, is_confirmed, is_failed, detected_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      RETURNING *;
    `;
    const params = [
      data.id, data.organization_id, data.order_id, data.deposit_reference, data.business_type, data.transaction_hash,
      data.block_number, data.event_index, data.chain, data.token, data.amount,
      data.from_address, data.to_address, data.last_checked_confirmations,
      data.required_confirmations, data.is_confirmed, data.is_failed
    ];
    const rows = await this.db.query(sql, params);
    return this.mapRowToTransfer(rows[0])!;
  }

  public async update(txHash: string, eventIndex: number, data: UpdateTransferData): Promise<TransferDbObject | null> {
    const fields = Object.keys(data);
    const params = Object.values(data);

    if (fields.length === 0) {
      return this.findByTxHashAndEventIndex(txHash, eventIndex);
    }

    const setClause = fields.map((field, i) => `"${field}" = $${i + 3}`).join(', ');
    const sql = `
      UPDATE transfers
      SET ${setClause}
      WHERE transaction_hash = $1 AND event_index = $2
      RETURNING *;
    `;
    const rows = await this.db.query(sql, [txHash, eventIndex, ...params]);
    return this.mapRowToTransfer(rows[0]);
  }

  public async updateConfirmationProgress(txHash: string, confirmations: number): Promise<void> {
    const sql = `
      UPDATE transfers
      SET last_checked_confirmations = $1
      WHERE transaction_hash = $2
    `;
    await this.db.query(sql, [confirmations, txHash]);
  }

  public async markAsConfirmed(txHash: string, confirmations: number): Promise<void> {
    const sql = `
      UPDATE transfers
      SET is_confirmed = true, confirmed_at = NOW(), last_checked_confirmations = $1
      WHERE transaction_hash = $2
    `;
    await this.db.query(sql, [confirmations, txHash]);
  }

  /**
   * Find transfers with filtering, pagination and sorting
   */
  public async findAll(filters: {
    organizationId?: string; // Multi-tenant filtering
    orderId?: string;
    depositReference?: string;
    businessType?: 'order' | 'deposit';
    chain?: string;
    token?: string;
    isConfirmed?: boolean;
    isFailed?: boolean;
    detectedAfter?: Date;
    detectedBefore?: Date;
    page?: number;
    limit?: number;
    sortBy?: 'detected_at' | 'confirmed_at' | 'amount';
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<{ transfers: TransferDbObject[]; total: number; page: number; limit: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    // Multi-tenant filtering - ALWAYS filter by organization if provided
    if (filters.organizationId) {
      conditions.push(`organization_id = $${paramIndex++}`);
      params.push(filters.organizationId);
    }

    if (filters.orderId) {
      conditions.push(`order_id = $${paramIndex++}`);
      params.push(filters.orderId);
    }

    if (filters.depositReference) {
      conditions.push(`deposit_reference = $${paramIndex++}`);
      params.push(filters.depositReference);
    }

    if (filters.businessType) {
      conditions.push(`business_type = $${paramIndex++}`);
      params.push(filters.businessType);
    }

    if (filters.chain) {
      conditions.push(`chain = $${paramIndex++}`);
      params.push(filters.chain);
    }

    if (filters.token) {
      conditions.push(`token = $${paramIndex++}`);
      params.push(filters.token);
    }

    if (filters.isConfirmed !== undefined) {
      conditions.push(`is_confirmed = $${paramIndex++}`);
      params.push(filters.isConfirmed);
    }

    if (filters.isFailed !== undefined) {
      conditions.push(`is_failed = $${paramIndex++}`);
      params.push(filters.isFailed);
    }

    if (filters.detectedAfter) {
      conditions.push(`detected_at >= $${paramIndex++}`);
      params.push(filters.detectedAfter);
    }

    if (filters.detectedBefore) {
      conditions.push(`detected_at <= $${paramIndex++}`);
      params.push(filters.detectedBefore);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Sorting
    const sortBy = filters.sortBy || 'detected_at';
    const sortOrder = filters.sortOrder || 'DESC';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM transfers ${whereClause}`;
    const countResult = await this.db.query(countSql, params);
    const total = parseInt(countResult[0]?.total || '0', 10);

    // Get transfers
    const sql = `
      SELECT * FROM transfers
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const rows = await this.db.query(sql, [...params, limit, offset]);
    const transfers = rows.map(row => this.mapRowToTransfer(row)!).filter(Boolean);

    return { transfers, total, page, limit };
  }
}
