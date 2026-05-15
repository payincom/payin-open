import type { PostgreSQLDatabase } from '../database/database.js';
import { AddressLogsRepository } from './address-logs.repository.js';
import type { ConfigProvider } from '@payin/shared';

export interface AddressPoolDbObject {
  address: string;
  organization_id: string; // Multi-tenant isolation
  derivation_index: number;
  protocol: 'evm' | 'tron' | 'solana';
  state: 'available' | 'allocated' | 'bound' | 'archived';
  order_id: string | null;
  deposit_reference: string | null;
  allocated_at: Date | null;
  recycled_at: Date | null;
  cooldown_until: Date | null;
  master_public_key: string | null;
  created_at: Date;
}

export interface AddressPoolStats {
  total: number;
  available: number;
  allocated: number;
  bound: number;
  coolingDown: number;
  archived: number;
}

export interface AllocateOrderAddressResult {
  address: string;
  allocated_at: Date;
}

export class AddressPoolRepository {
  private addressLogsRepository: AddressLogsRepository;
  private cooldownMinutes: number;
  private configProvider?: ConfigProvider;

  constructor(
    private db: PostgreSQLDatabase,
    cooldownMinutes: number = 30,
    configProvider?: ConfigProvider
  ) {
    this.addressLogsRepository = new AddressLogsRepository(db);
    this.cooldownMinutes = cooldownMinutes;
    this.configProvider = configProvider;
  }

  /**
   * Get cooldown minutes with organization isolation
   * Priority: organization config > global config > constructor default
   */
  private async getCooldownMinutes(organizationId: string): Promise<number> {
    if (!this.configProvider) {
      return this.cooldownMinutes;
    }

    const configValue = await this.configProvider.getConfig(
      'address_pool.cooldown_minutes',
      organizationId
    );

    return configValue || this.cooldownMinutes;
  }

  private mapRowToAddressPool(row: any): AddressPoolDbObject | null {
    if (!row) return null;
    return {
      ...row,
      state: row.state as 'available' | 'allocated' | 'bound',
      protocol: row.protocol as 'evm' | 'tron' | 'solana',
      allocated_at: row.allocated_at ? new Date(row.allocated_at) : null,
      recycled_at: row.recycled_at ? new Date(row.recycled_at) : null,
      cooldown_until: row.cooldown_until ? new Date(row.cooldown_until) : null,
      created_at: new Date(row.created_at),
    };
  }

  async initializeAddressPool(addresses: Array<{
    address: string;
    derivationIndex: number;
    protocol: 'evm' | 'tron' | 'solana';
    masterPublicKey: string;
    organizationId: string;
  }>): Promise<void> {
    const sql = `
      INSERT INTO address_pool (address, organization_id, derivation_index, protocol, master_public_key)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (address) DO NOTHING
    `;

    for (const addr of addresses) {
      await this.db.query(sql, [addr.address, addr.organizationId, addr.derivationIndex, addr.protocol, addr.masterPublicKey]);
    }
  }

  async getAddressPoolStats(organizationId: string, protocol: 'evm' | 'tron' | 'solana'): Promise<AddressPoolStats> {
    const stats = await this.db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN state = 'idle' AND (cooldown_until IS NULL OR cooldown_until <= NOW()) THEN 1 END) as available,
        COUNT(CASE WHEN state = 'allocated' THEN 1 END) as allocated,
        COUNT(CASE WHEN state = 'bound' THEN 1 END) as bound,
        COUNT(CASE WHEN state = 'idle' AND cooldown_until > NOW() THEN 1 END) as cooling_down,
        COUNT(CASE WHEN state = 'archived' THEN 1 END) as archived
      FROM address_pool
      WHERE organization_id = $1 AND protocol = $2
    `, [organizationId, protocol]);

    const result = stats[0];
    return {
      total: parseInt(result.total),
      available: parseInt(result.available),
      allocated: parseInt(result.allocated),
      bound: parseInt(result.bound),
      coolingDown: parseInt(result.cooling_down),
      archived: parseInt(result.archived)
    };
  }

  async listAddresses(params: {
    organizationId: string;
    protocol?: 'evm' | 'tron' | 'solana';
    page?: number;
    pageSize?: number;
  }): Promise<{
    addresses: Array<{
      address: string;
      protocol: 'evm' | 'tron' | 'solana';
      status: 'available' | 'allocated' | 'bound';
      type: 'order' | 'deposit' | null;
      externalId: string | null;
      allocatedAt: Date | null;
      recycledAt: Date | null;
      cooldownUntil: Date | null;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const offset = (page - 1) * pageSize;

    // Build WHERE clause
    const whereConditions: string[] = ['organization_id = $1'];
    const queryParams: any[] = [params.organizationId];
    let paramIndex = 2;

    if (params.protocol) {
      whereConditions.push(`protocol = $${paramIndex++}`);
      queryParams.push(params.protocol);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Count total
    const countResult = await this.db.query(
      `SELECT COUNT(*) as total FROM address_pool ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult[0].total);

    // Query addresses with pagination
    const addressesResult = await this.db.query(
      `
      SELECT
        address,
        protocol,
        state,
        order_id,
        deposit_reference,
        allocated_at,
        recycled_at,
        cooldown_until,
        created_at
      FROM address_pool
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `,
      [...queryParams, pageSize, offset]
    );

    const addresses = addressesResult.map((row: any) => ({
      address: row.address,
      protocol: row.protocol,
      status: row.state,
      type: row.order_id ? ('order' as const) : row.deposit_reference ? ('deposit' as const) : null,
      externalId: row.order_id || row.deposit_reference,
      allocatedAt: row.allocated_at ? new Date(row.allocated_at) : null,
      recycledAt: row.recycled_at ? new Date(row.recycled_at) : null,
      cooldownUntil: row.cooldown_until ? new Date(row.cooldown_until) : null,
      createdAt: new Date(row.created_at),
    }));

    return { addresses, total };
  }

  async allocateOrderAddress(organizationId: string, protocol: 'evm' | 'tron' | 'solana', orderId: string, orderReference: string): Promise<AllocateOrderAddressResult | null> {
    const result = await this.db.query(`
      UPDATE address_pool
      SET state = 'allocated',
          order_id = $3,
          allocated_at = NOW(),
          recycled_at = NULL,
          cooldown_until = NULL
      WHERE address = (
        SELECT address
        FROM address_pool
        WHERE organization_id = $1
          AND protocol = $2
          AND state = 'idle'
          AND order_id IS NULL
          AND deposit_reference IS NULL
          AND (cooldown_until IS NULL OR cooldown_until <= NOW())
        ORDER BY recycled_at NULLS FIRST, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING address, allocated_at
    `, [organizationId, protocol, orderId]);

    if (result.length > 0) {
      // Log the allocation
      await this.addressLogsRepository.logOrderAllocation(result[0].address, orderId);

      return {
        address: result[0].address,
        allocated_at: new Date(result[0].allocated_at)
      };
    }

    return null;
  }

  async releaseOrderAddress(address: string): Promise<void> {
    // First get the current order_id and organization_id for logging and config lookup
    const current = await this.db.query(`
      SELECT order_id, organization_id FROM address_pool WHERE LOWER(address) = LOWER($1)
    `, [address]);

    const orderId = current[0]?.order_id;
    const organizationId = current[0]?.organization_id;

    // Get cooldown minutes with organization isolation
    const cooldownMinutes = organizationId
      ? await this.getCooldownMinutes(organizationId)
      : this.cooldownMinutes;

    // Release the address with configured cooldown
    await this.db.query(`
      UPDATE address_pool
      SET state = 'idle',
          order_id = NULL,
          allocated_at = NULL,
          recycled_at = NOW(),
          cooldown_until = NOW() + INTERVAL '1 minute' * $2
      WHERE LOWER(address) = LOWER($1)
    `, [address, cooldownMinutes]);

    // Log the release if there was an order_id
    if (orderId) {
      await this.addressLogsRepository.logOrderRelease(address, orderId);
    }
  }

  async getUserDepositAddress(organizationId: string, depositReference: string, protocol: 'evm' | 'tron' | 'solana'): Promise<AddressPoolDbObject | null> {
    const result = await this.db.query(`
      SELECT * FROM address_pool
      WHERE organization_id = $1 AND deposit_reference = $2 AND protocol = $3
    `, [organizationId, depositReference, protocol]);

    return this.mapRowToAddressPool(result[0]);
  }

  /**
   * Get deposit address by address (for public endpoints)
   * Address is the primary key, so this is fast and guarantees uniqueness
   * @param address - Blockchain address
   * @returns Address pool record or null if not found
   */
  async getDepositByAddress(address: string): Promise<AddressPoolDbObject | null> {
    const result = await this.db.query(`
      SELECT * FROM address_pool
      WHERE LOWER(address) = LOWER($1)
    `, [address]);

    return this.mapRowToAddressPool(result[0]);
  }

  async bindAddress(organizationId: string, depositReference: string, protocol: 'evm' | 'tron' | 'solana'): Promise<AddressPoolDbObject | null> {
    const result = await this.db.query(`
      UPDATE address_pool
      SET state = 'bound',
          deposit_reference = $3,
          allocated_at = NOW(),
          recycled_at = NULL,
          cooldown_until = NULL
      WHERE address = (
        SELECT address
        FROM address_pool
        WHERE organization_id = $1
          AND protocol = $2
          AND state = 'idle'
          AND order_id IS NULL
          AND deposit_reference IS NULL
          AND (cooldown_until IS NULL OR cooldown_until <= NOW())
        ORDER BY recycled_at NULLS FIRST, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `, [organizationId, protocol, depositReference]);

    const addressPool = this.mapRowToAddressPool(result[0]);

    // Log the binding if successful
    if (addressPool) {
      await this.addressLogsRepository.logDepositBind(addressPool.address, depositReference);
    }

    return addressPool;
  }

  async unbindAddress(organizationId: string, depositReference: string, protocol: 'evm' | 'tron' | 'solana'): Promise<void> {
    // First get the address(es) for logging
    const addresses = await this.db.query(`
      SELECT address FROM address_pool
      WHERE organization_id = $1 AND deposit_reference = $2 AND protocol = $3
    `, [organizationId, depositReference, protocol]);

    // Get cooldown minutes with organization isolation
    const cooldownMinutes = await this.getCooldownMinutes(organizationId);

    // Update the address pool with configured cooldown
    await this.db.query(`
      UPDATE address_pool
      SET state = 'idle',
          deposit_reference = NULL,
          allocated_at = NULL,
          recycled_at = NOW(),
          cooldown_until = NOW() + INTERVAL '1 minute' * $4
      WHERE organization_id = $1 AND deposit_reference = $2 AND protocol = $3
    `, [organizationId, depositReference, protocol, cooldownMinutes]);

    // Log the unbinding for all affected addresses
    for (const row of addresses) {
      await this.addressLogsRepository.logDepositUnbind(row.address, depositReference);
    }
  }

  async getBoundAddresses(organizationId: string): Promise<AddressPoolDbObject[]> {
    const rows = await this.db.query(`
      SELECT * FROM address_pool
      WHERE organization_id = $1 AND state = 'bound' AND deposit_reference IS NOT NULL
      ORDER BY protocol, address
    `, [organizationId]);
    return rows.map(row => this.mapRowToAddressPool(row));
  }

  /**
   * Unbind address by address (not by depositReference)
   */
  async unbindAddressByAddress(organizationId: string, address: string, protocol: 'evm' | 'tron' | 'solana'): Promise<void> {
    // First get the deposit reference for logging
    const result = await this.db.query(`
      SELECT deposit_reference FROM address_pool
      WHERE organization_id = $1 AND address = $2 AND protocol = $3
    `, [organizationId, address, protocol]);

    if (result.length === 0) {
      throw new Error(`Address ${address} not found in pool for organization ${organizationId}`);
    }

    const depositReference = result[0].deposit_reference;

    // Get cooldown minutes with organization isolation
    const cooldownMinutes = await this.getCooldownMinutes(organizationId);

    // Update the address pool with configured cooldown
    await this.db.query(`
      UPDATE address_pool
      SET state = 'idle',
          deposit_reference = NULL,
          allocated_at = NULL,
          recycled_at = NOW(),
          cooldown_until = NOW() + INTERVAL '1 minute' * $4
      WHERE organization_id = $1 AND address = $2 AND protocol = $3
    `, [organizationId, address, protocol, cooldownMinutes]);

    // Log the unbinding
    if (depositReference) {
      await this.addressLogsRepository.logDepositUnbind(address, depositReference);
    }
  }

  /**
   * List deposit references with statistics
   */
  async listDepositReferences(filters: {
    organizationId?: string; // Multi-tenant filtering
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<{
    references: Array<{
      depositReference: string;
      protocols: string[];
      addressCount: number;
      totalDeposits: number;
      totalAmount: Record<string, number>;
      lastDepositAt: string | null;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Build search condition
    const conditions: string[] = ['a.deposit_reference IS NOT NULL'];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Multi-tenant filtering
    if (filters.organizationId) {
      conditions.push(`a.organization_id = $${paramIndex}`);
      queryParams.push(filters.organizationId);
      paramIndex++;
    }

    if (filters.search) {
      conditions.push(`a.deposit_reference ILIKE $${paramIndex}`);
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    const searchCondition = `WHERE ${conditions.join(' AND ')}`;

    // Get total count
    const countResult = await this.db.query(`
      SELECT COUNT(DISTINCT a.deposit_reference) as total
      FROM address_pool a
      ${searchCondition}
    `, queryParams);

    const total = parseInt(countResult[0]?.total || '0');

    // Get references with statistics
    queryParams.push(limit, offset);
    const rows = await this.db.query(`
      WITH token_sums AS (
        SELECT
          a.deposit_reference,
          t.token,
          SUM(CAST(t.amount AS DECIMAL)) as amount
        FROM address_pool a
        LEFT JOIN transfers t ON t.to_address = a.address AND t.business_type = 'deposit'
        ${searchCondition}
        GROUP BY a.deposit_reference, t.token
      )
      SELECT
        a.deposit_reference,
        array_agg(DISTINCT a.protocol) as protocols,
        COUNT(DISTINCT a.address) as address_count,
        COUNT(DISTINCT t.id) as total_deposits,
        COALESCE(
          (
            SELECT jsonb_object_agg(ts.token, ts.amount)
            FROM token_sums ts
            WHERE ts.deposit_reference = a.deposit_reference AND ts.token IS NOT NULL
          ),
          '{}'::jsonb
        ) as total_amount,
        MAX(t.detected_at) as last_deposit_at
      FROM address_pool a
      LEFT JOIN transfers t ON t.to_address = a.address AND t.business_type = 'deposit'
      ${searchCondition}
      GROUP BY a.deposit_reference
      ORDER BY MAX(t.detected_at) DESC NULLS LAST, a.deposit_reference
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, queryParams);

    const references = rows.map((row: any) => ({
      depositReference: row.deposit_reference,
      protocols: row.protocols || [],
      addressCount: parseInt(row.address_count || '0'),
      totalDeposits: parseInt(row.total_deposits || '0'),
      totalAmount: row.total_amount || {},
      lastDepositAt: row.last_deposit_at || null
    }));

    return {
      references,
      total,
      page,
      limit
    };
  }

  /**
   * Archive an address (soft delete)
   * Archived addresses cannot be allocated or bound
   * @param organizationId - Organization ID for multi-tenant isolation
   * @param address - Address to archive
   */
  async archiveAddress(organizationId: string, address: string): Promise<void> {
    // Check current state - cannot archive if allocated or bound
    const current = await this.db.query(`
      SELECT state, order_id, deposit_reference FROM address_pool
      WHERE organization_id = $1 AND address = $2
    `, [organizationId, address]);

    if (current.length === 0) {
      throw new Error(`Address ${address} not found in pool for organization ${organizationId}`);
    }

    const currentState = current[0].state;
    if (currentState === 'allocated') {
      throw new Error(`Cannot archive address ${address}: currently allocated to order ${current[0].order_id}`);
    }
    if (currentState === 'bound') {
      throw new Error(`Cannot archive address ${address}: currently bound to deposit ${current[0].deposit_reference}`);
    }
    if (currentState === 'archived') {
      throw new Error(`Address ${address} is already archived`);
    }

    // Archive the address
    await this.db.query(`
      UPDATE address_pool
      SET state = 'archived',
          recycled_at = NOW()
      WHERE organization_id = $1 AND address = $2
    `, [organizationId, address]);

    // Log the archival
    await this.addressLogsRepository.logArchive(address);
  }

  /**
   * Unarchive an address (restore to available state)
   * @param organizationId - Organization ID for multi-tenant isolation
   * @param address - Address to unarchive
   */
  async unarchiveAddress(organizationId: string, address: string): Promise<void> {
    // Check current state
    const current = await this.db.query(`
      SELECT state FROM address_pool
      WHERE organization_id = $1 AND address = $2
    `, [organizationId, address]);

    if (current.length === 0) {
      throw new Error(`Address ${address} not found in pool for organization ${organizationId}`);
    }

    const currentState = current[0].state;
    if (currentState !== 'archived') {
      throw new Error(`Cannot unarchive address ${address}: current state is ${currentState}, not archived`);
    }

    // Unarchive the address (restore to idle state)
    await this.db.query(`
      UPDATE address_pool
      SET state = 'idle',
          recycled_at = NOW(),
          cooldown_until = NULL
      WHERE organization_id = $1 AND address = $2
    `, [organizationId, address]);

    // Log the unarchival
    await this.addressLogsRepository.logUnarchive(address);
  }
}