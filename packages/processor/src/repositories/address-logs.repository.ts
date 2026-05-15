import type { PostgreSQLDatabase } from '../database/database.js';

export interface AddressLogDbObject {
  id: string;
  address: string;
  order_id: string | null;
  deposit_reference: string | null;
  action: 'allocate' | 'release' | 'bind' | 'unbind' | 'archive' | 'unarchive';
  business_type: 'order' | 'deposit' | 'system';
  created_at: Date;
}

export class AddressLogsRepository {
  constructor(private db: PostgreSQLDatabase) {}

  private mapRowToAddressLog(row: any): AddressLogDbObject | null {
    if (!row) return null;
    return {
      ...row,
      action: row.action as 'allocate' | 'release' | 'bind' | 'unbind' | 'archive' | 'unarchive',
      business_type: row.business_type as 'order' | 'deposit' | 'system',
      created_at: new Date(row.created_at),
    };
  }

  /**
   * Log order address allocation
   */
  async logOrderAllocation(address: string, orderId: string): Promise<void> {
    await this.db.execute(`
      INSERT INTO address_logs (address, order_id, action, business_type, created_at)
      VALUES ($1, $2, 'allocate', 'order', NOW())
    `, [address, orderId]);
  }

  /**
   * Log order address release
   */
  async logOrderRelease(address: string, orderId: string): Promise<void> {
    await this.db.execute(`
      INSERT INTO address_logs (address, order_id, action, business_type, created_at)
      VALUES ($1, $2, 'release', 'order', NOW())
    `, [address, orderId]);
  }

  /**
   * Log deposit address binding
   */
  async logDepositBind(address: string, depositReference: string): Promise<void> {
    await this.db.execute(`
      INSERT INTO address_logs (address, deposit_reference, action, business_type, created_at)
      VALUES ($1, $2, 'bind', 'deposit', NOW())
    `, [address, depositReference]);
  }

  /**
   * Log deposit address unbinding
   */
  async logDepositUnbind(address: string, depositReference: string): Promise<void> {
    await this.db.execute(`
      INSERT INTO address_logs (address, deposit_reference, action, business_type, created_at)
      VALUES ($1, $2, 'unbind', 'deposit', NOW())
    `, [address, depositReference]);
  }

  /**
   * Get address operation history
   */
  async getAddressHistory(address: string, limit: number = 50): Promise<AddressLogDbObject[]> {
    const rows = await this.db.query(`
      SELECT * FROM address_logs
      WHERE LOWER(address) = LOWER($1)
      ORDER BY created_at DESC
      LIMIT $2
    `, [address, limit]);

    return rows.map(row => this.mapRowToAddressLog(row)).filter(Boolean) as AddressLogDbObject[];
  }

  /**
   * Get order address operation history
   */
  async getOrderAddressHistory(orderId: string): Promise<AddressLogDbObject[]> {
    const rows = await this.db.query(`
      SELECT * FROM address_logs
      WHERE order_id = $1
      ORDER BY created_at DESC
    `, [orderId]);

    return rows.map(row => this.mapRowToAddressLog(row)).filter(Boolean) as AddressLogDbObject[];
  }

  /**
   * Get deposit address operation history
   */
  async getDepositAddressHistory(depositReference: string): Promise<AddressLogDbObject[]> {
    const rows = await this.db.query(`
      SELECT * FROM address_logs
      WHERE deposit_reference = $1
      ORDER BY created_at DESC
    `, [depositReference]);

    return rows.map(row => this.mapRowToAddressLog(row)).filter(Boolean) as AddressLogDbObject[];
  }

  /**
   * Get address logs by business type
   */
  async getLogsByBusinessType(businessType: 'order' | 'deposit' | 'system', limit: number = 100): Promise<AddressLogDbObject[]> {
    const rows = await this.db.query(`
      SELECT * FROM address_logs
      WHERE business_type = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [businessType, limit]);

    return rows.map(row => this.mapRowToAddressLog(row)).filter(Boolean) as AddressLogDbObject[];
  }

  /**
   * Log address archival (soft delete)
   */
  async logArchive(address: string): Promise<void> {
    await this.db.execute(`
      INSERT INTO address_logs (address, action, business_type, created_at)
      VALUES ($1, 'archive', 'system', NOW())
    `, [address]);
  }

  /**
   * Log address unarchival (restore)
   */
  async logUnarchive(address: string): Promise<void> {
    await this.db.execute(`
      INSERT INTO address_logs (address, action, business_type, created_at)
      VALUES ($1, 'unarchive', 'system', NOW())
    `, [address]);
  }
}