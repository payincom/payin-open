import { Pool, PoolClient } from 'pg';
import { customAlphabet } from 'nanoid';
import type {
  PaymentLink,
  PaymentLinkCurrency,
  PaymentLinkOrder,
  PaymentLinkOrderStatus,
  PaymentLinkStatus,
  CreatePaymentLinkInput,
  UpdatePaymentLinkCurrenciesInput,
  PaymentLinkCheckoutResponse,
} from '../types.js';

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SLUG_LENGTH = 10;
const slugGenerator = customAlphabet(BASE58, SLUG_LENGTH);

export interface UpdatePaymentLinkInput {
  title?: string;
  description?: string | null;
  amount?: string;
  inventoryTotal?: number | null;
  expiresAt?: Date | null;
  metadata?: Record<string, any> | null;
  updatedBy?: string | null;
  amountType?: 'fixed' | 'user_input';
  ctaText?: string | null;
  theme?: 'dark' | 'light';
}

export interface PublishPaymentLinkInput {
  organizationId: string;
  paymentLinkId: string;
  slug?: string;
}

export interface PaymentLinkFilters {
  organizationId: string;
  status?: PaymentLinkStatus | PaymentLinkStatus[];
  search?: string;
  page?: number;
  limit?: number;
  includeArchived?: boolean;
  archivedOnly?: boolean;
}

export interface PaymentLinkListResult {
  links: PaymentLink[];
  total: number;
  page: number;
  limit: number;
}

export interface CreatePaymentLinkOrderInput {
  slug: string;
  buyerEmail: string;
  currency: string;
  chainId: string;
}

export interface CreatePaymentLinkOrderResult {
  paymentLink: PaymentLink;
  paymentLinkOrder: PaymentLinkOrder;
}

export interface SyncOrderStatusInput {
  orderReference: string;
  orderId: string;
  newStatus: PaymentLinkOrderStatus;
  completedAt?: Date | null;
}

export class PaymentLinkService {
  constructor(private readonly pool: Pool) {}

  private mapRowToCurrency(row: any): PaymentLinkCurrency {
    return {
      id: row.id,
      paymentlink_id: row.paymentlink_id,
      currency: row.currency,
      chain_options: row.chain_options ?? [],
      amount: row.amount ? row.amount.toString() : null,
      is_primary: row.is_primary,
      metadata: row.metadata,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private async loadPaymentLinkCurrencies(client: PoolClient | Pool, paymentLinkId: string): Promise<PaymentLinkCurrency[]> {
    const result = await client.query(
      `SELECT * FROM paymentlink_currencies WHERE paymentlink_id = $1 ORDER BY is_primary DESC, created_at ASC`,
      [paymentLinkId]
    );
    return result.rows.map((row) => this.mapRowToCurrency(row));
  }

  private mapRowToPaymentLink(row: any, currencies: PaymentLinkCurrency[]): PaymentLink {
    return {
      id: row.id,
      organization_id: row.organization_id,
      title: row.title,
      description: row.description,
      amount: row.amount.toString(),
      currency: row.currency, // For backward compatibility
      status: row.status,
      is_archived: row.is_archived,
      slug: row.slug,
      chain_options: row.chain_options, // For backward compatibility
      currencies, // Multi-currency support
      inventory_total: row.inventory_total,
      inventory_reserved: row.inventory_reserved,
      inventory_sold: row.inventory_sold,
      metadata: row.metadata,
      expires_at: row.expires_at ? new Date(row.expires_at) : null,
      published_at: row.published_at ? new Date(row.published_at) : null,
      created_by: row.created_by,
      updated_by: row.updated_by,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      amount_type: row.amount_type || 'fixed',
      cta_text: row.cta_text,
      theme: row.theme || 'dark',
    };
  }

  private mapRowToPaymentLinkOrder(row: any): PaymentLinkOrder {
    return {
      id: row.id,
      paymentlink_id: row.paymentlink_id,
      organization_id: row.organization_id,
      order_id: row.order_id,
      buyer_email: row.buyer_email,
      status: row.status,
      selected_chain: row.selected_chain,
      selected_currency: row.selected_currency,
      amount: row.amount.toString(),
      metadata: row.metadata,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
    };
  }

  private async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLink> {
    const {
      title,
      description,
      amount,
      currencies,
      inventory_total = null,
      expires_at = null,
      metadata = null,
      amount_type = 'fixed',
      cta_text = null,
      theme = 'dark',
    } = input;

    // Validate currencies
    if (!currencies || currencies.length === 0) {
      throw new Error('At least one currency must be specified');
    }

    const organizationId = (input as any).organizationId;
    const createdBy = (input as any).createdBy;

    return this.withTransaction(async (client) => {
      // Create the main payment link record
      const linkResult = await client.query(
        `
          INSERT INTO paymentlinks (
            organization_id, title, description, amount,
            status, inventory_total, metadata,
            expires_at, created_by, updated_by,
            amount_type, cta_text, theme
          )
          VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $8, $9, $10, $11)
          RETURNING *
        `,
        [
          organizationId,
          title,
          description ?? null,
          amount,
          inventory_total,
          metadata,
          expires_at,
          createdBy,
          amount_type,
          cta_text,
          theme,
        ]
      );

      const link = linkResult.rows[0];
      const linkId = link.id;

      // Create currency configurations
      for (const curr of currencies) {
        await client.query(
          `
            INSERT INTO paymentlink_currencies (
              paymentlink_id, currency, chain_options, amount, is_primary, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            linkId,
            curr.currency,
            curr.chain_options,
            curr.amount ?? null,
            curr.is_primary ?? false,
            curr.metadata ?? null,
          ]
        );
      }

      // Load and return the complete link with currencies
      const loadedCurrencies = await this.loadPaymentLinkCurrencies(client, linkId);
      return this.mapRowToPaymentLink(link, loadedCurrencies);
    });
  }

  async updatePaymentLink(
    paymentLinkId: string,
    organizationId: string,
    updates: UpdatePaymentLinkInput
  ): Promise<PaymentLink> {
    const fields: string[] = [];
    const values: any[] = [];
    let index = 1;

    const addUpdate = (column: string, value: any) => {
      fields.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    };

    if (updates.title !== undefined) addUpdate('title', updates.title);
    if (updates.description !== undefined) addUpdate('description', updates.description);
    if (updates.amount !== undefined) addUpdate('amount', updates.amount);
    if (updates.inventoryTotal !== undefined) addUpdate('inventory_total', updates.inventoryTotal);
    if (updates.expiresAt !== undefined) addUpdate('expires_at', updates.expiresAt);
    if (updates.metadata !== undefined) addUpdate('metadata', updates.metadata);
    if (updates.updatedBy !== undefined) addUpdate('updated_by', updates.updatedBy);
    if (updates.amountType !== undefined) addUpdate('amount_type', updates.amountType);
    if (updates.ctaText !== undefined) addUpdate('cta_text', updates.ctaText);
    if (updates.theme !== undefined) addUpdate('theme', updates.theme);

    if (fields.length === 0) {
      const existing = await this.getPaymentLinkById(paymentLinkId, organizationId);
      if (!existing) {
        throw new Error('Payment Link not found');
      }
      return existing;
    }

    values.push(paymentLinkId);
    values.push(organizationId);

    const result = await this.pool.query(
      `
        UPDATE paymentlinks
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${index} AND organization_id = $${index + 1}
        RETURNING *
      `,
      values
    );

    if (!result.rowCount || result.rowCount === 0) {
      throw new Error('Payment Link not found');
    }

    const currencies = await this.loadPaymentLinkCurrencies(this.pool, paymentLinkId);
    return this.mapRowToPaymentLink(result.rows[0], currencies);
  }

  /**
   * Update payment link currencies configuration
   */
  async updatePaymentLinkCurrencies(
    paymentLinkId: string,
    organizationId: string,
    input: UpdatePaymentLinkCurrenciesInput
  ): Promise<PaymentLink> {
    const { currencies } = input;

    if (!currencies || currencies.length === 0) {
      throw new Error('At least one currency must be specified');
    }

    return this.withTransaction(async (client) => {
      // Verify link exists
      const linkResult = await client.query(
        `SELECT * FROM paymentlinks WHERE id = $1 AND organization_id = $2`,
        [paymentLinkId, organizationId]
      );

      if (!linkResult.rowCount || linkResult.rowCount === 0) {
        throw new Error('Payment Link not found');
      }

      const link = linkResult.rows[0];

      // Delete old currencies
      await client.query(`DELETE FROM paymentlink_currencies WHERE paymentlink_id = $1`, [paymentLinkId]);

      // Insert new currencies
      for (const curr of currencies) {
        await client.query(
          `
            INSERT INTO paymentlink_currencies (
              paymentlink_id, currency, chain_options, amount, is_primary, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            paymentLinkId,
            curr.currency,
            curr.chain_options,
            curr.amount ?? null,
            curr.is_primary ?? false,
            curr.metadata ?? null,
          ]
        );
      }

      // Update link's updated_at
      await client.query(
        `UPDATE paymentlinks SET updated_at = NOW() WHERE id = $1`,
        [paymentLinkId]
      );

      const loadedCurrencies = await this.loadPaymentLinkCurrencies(client, paymentLinkId);
      return this.mapRowToPaymentLink(link, loadedCurrencies);
    });
  }

  async publishPaymentLink(input: PublishPaymentLinkInput): Promise<PaymentLink> {
    return await this.withTransaction(async (client) => {
      const { paymentLinkId, organizationId, slug } = input;

      const linkResult = await client.query(
        `SELECT * FROM paymentlinks WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [paymentLinkId, organizationId]
      );

      if (!linkResult.rowCount || linkResult.rowCount === 0) {
        throw new Error('Payment Link not found');
      }

      const link = linkResult.rows[0];

      // If already has a slug, keep it. Otherwise generate a new one
      let finalSlug = link.slug;
      if (!finalSlug) {
        finalSlug = await this.ensureUniqueSlug(client, slug ?? slugGenerator());
      }

      const publishResult = await client.query(
        `
          UPDATE paymentlinks
          SET status = 'published',
              slug = $3,
              published_at = COALESCE(published_at, NOW()),
              updated_at = NOW()
          WHERE id = $1 AND organization_id = $2
          RETURNING *
        `,
        [paymentLinkId, organizationId, finalSlug]
      );

      const currencies = await this.loadPaymentLinkCurrencies(client, paymentLinkId);
      return this.mapRowToPaymentLink(publishResult.rows[0], currencies);
    });
  }

  async unpublishPaymentLink(paymentLinkId: string, organizationId: string): Promise<PaymentLink> {
    const result = await this.pool.query(
      `
        UPDATE paymentlinks
        SET status = 'draft',
            updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING *
      `,
      [paymentLinkId, organizationId]
    );

    if (!result.rowCount || result.rowCount === 0) {
      throw new Error('Payment Link not found');
    }

    const currencies = await this.loadPaymentLinkCurrencies(this.pool, paymentLinkId);
    return this.mapRowToPaymentLink(result.rows[0], currencies);
  }

  async archivePaymentLink(paymentLinkId: string, organizationId: string): Promise<PaymentLink> {
    const result = await this.pool.query(
      `
        UPDATE paymentlinks
        SET is_archived = true,
            updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING *
      `,
      [paymentLinkId, organizationId]
    );

    if (!result.rowCount || result.rowCount === 0) {
      throw new Error('Payment Link not found');
    }

    const currencies = await this.loadPaymentLinkCurrencies(this.pool, paymentLinkId);
    return this.mapRowToPaymentLink(result.rows[0], currencies);
  }

  async restorePaymentLink(paymentLinkId: string, organizationId: string): Promise<PaymentLink> {
    const result = await this.pool.query(
      `
        UPDATE paymentlinks
        SET is_archived = false,
            updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING *
      `,
      [paymentLinkId, organizationId]
    );

    if (!result.rowCount || result.rowCount === 0) {
      throw new Error('Payment Link not found');
    }

    const currencies = await this.loadPaymentLinkCurrencies(this.pool, paymentLinkId);
    return this.mapRowToPaymentLink(result.rows[0], currencies);
  }

  async getPaymentLinkById(id: string, organizationId: string): Promise<PaymentLink | null> {
    const result = await this.pool.query(
      `SELECT * FROM paymentlinks WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    const currencies = await this.loadPaymentLinkCurrencies(this.pool, id);
    return this.mapRowToPaymentLink(result.rows[0], currencies);
  }

  async getPaymentLinkBySlug(slug: string): Promise<PaymentLink | null> {
    const result = await this.pool.query(`SELECT * FROM paymentlinks WHERE slug = $1`, [slug]);

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    const currencies = await this.loadPaymentLinkCurrencies(this.pool, result.rows[0].id);
    return this.mapRowToPaymentLink(result.rows[0], currencies);
  }

  /**
   * Get payment link data for checkout (with currency options)
   */
  async getPaymentLinkCheckoutData(slug: string): Promise<PaymentLinkCheckoutResponse> {
    const link = await this.getPaymentLinkBySlug(slug);
    if (!link) {
      throw new Error('Payment Link not found');
    }

    if (link.status !== 'published' || link.is_archived) {
      throw new Error('Payment Link is not available');
    }

    return {
      id: link.id,
      title: link.title,
      description: link.description,
      amount: link.amount,
      currencies: link.currencies.map((c) => ({
        currency: c.currency,
        amount: c.amount ?? link.amount,
        chains: c.chain_options,
        is_primary: c.is_primary,
      })),
      expires_at: link.expires_at,
      amount_type: link.amount_type,
      cta_text: link.cta_text,
      theme: link.theme,
    };
  }

  async listPaymentLinks(filters: PaymentLinkFilters): Promise<PaymentLinkListResult> {
    const { organizationId, status, search, page = 1, limit = 20, includeArchived = false } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    // Handle archived filters
    if (filters.archivedOnly) {
      conditions.push('is_archived = true');
    } else if (!includeArchived) {
      conditions.push('is_archived = false');
    }

    if (status) {
      if (Array.isArray(status)) {
        const placeholders = status.map((_s, idx) => `$${paramIndex + idx}`).join(', ');
        conditions.push(`status IN (${placeholders})`);
        params.push(...status);
        paramIndex += status.length;
      } else {
        conditions.push(`status = $${paramIndex}`);
        params.push(status);
        paramIndex += 1;
      }
    }

    if (search) {
      conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM paymentlinks ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listResult = await this.pool.query(
      `
        SELECT *
        FROM paymentlinks
        ${whereClause}
        ORDER BY updated_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    const links = await Promise.all(
      listResult.rows.map(async (row) => {
        const currencies = await this.loadPaymentLinkCurrencies(this.pool, row.id);
        return this.mapRowToPaymentLink(row, currencies);
      })
    );

    return {
      links,
      total,
      page,
      limit,
    };
  }

  /**
   * Reserve an order by slug (supports multi-currency selection)
   */
  async reserveOrderBySlug(
    slug: string,
    buyerEmail: string,
    selectedCurrency: string,
    selectedChainId: string,
    overrideAmount?: string | number
  ): Promise<CreatePaymentLinkOrderResult> {
    return this.withTransaction(async (client) => {
      const linkResult = await client.query(
        `SELECT * FROM paymentlinks WHERE slug = $1 FOR UPDATE`,
        [slug]
      );

      if (linkResult.rowCount === 0) {
        throw new Error('Payment Link not found');
      }

      const link = linkResult.rows[0];
      const now = new Date();

      if (link.status !== 'published') {
        throw new Error('Payment Link is not available for payment');
      }

      if (link.expires_at && now > new Date(link.expires_at)) {
        throw new Error('Payment Link has expired');
      }

      // Load currencies and validate
      const currenciesResult = await client.query(
        `SELECT * FROM paymentlink_currencies WHERE paymentlink_id = $1 AND currency = $2`,
        [link.id, selectedCurrency]
      );

      if (currenciesResult.rowCount === 0) {
        throw new Error('Selected currency is not available for this Payment Link');
      }

      const currencyConfig = currenciesResult.rows[0];
      if (!Array.isArray(currencyConfig.chain_options) || !currencyConfig.chain_options.includes(selectedChainId)) {
        throw new Error('Selected chain is not available for this currency');
      }

      const totalInventory: number | null = link.inventory_total;
      const reserved: number = link.inventory_reserved;
      const sold: number = link.inventory_sold;

      if (totalInventory !== null) {
        const available = totalInventory - reserved - sold;
        if (available <= 0) {
          throw new Error('Payment Link is sold out');
        }
      }

      const isUserInputAmount = (link.amount_type ?? 'fixed') === 'user_input';

      let amount: string | number = currencyConfig.amount ?? link.amount;
      if (isUserInputAmount) {
        const rawAmount =
          typeof overrideAmount === 'number'
            ? overrideAmount.toString()
            : typeof overrideAmount === 'string'
            ? overrideAmount.trim()
            : '';

        if (rawAmount === '') {
          throw new Error('Custom amount is required for this Payment Link');
        }

        const numericAmount = Number(rawAmount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
          throw new Error('Invalid custom amount. Enter a number greater than 0.');
        }

        amount = rawAmount;
      }

      const orderResult = await client.query(
        `
          INSERT INTO paymentlink_orders (
            paymentlink_id,
            organization_id,
            buyer_email,
            status,
            selected_chain,
            selected_currency,
            amount,
            metadata
          )
          VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
          RETURNING *
        `,
        [
          link.id,
          link.organization_id,
          buyerEmail,
          selectedChainId,
          selectedCurrency,
          amount,
          {
            source: 'paymentlink',
            slug,
            paymentLinkId: link.id,
            title: link.title,
            description: link.description,
            buyerEmail,
            amountType: link.amount_type ?? 'fixed',
            userEnteredAmount: isUserInputAmount,
          },
        ]
      );

      if (totalInventory !== null) {
        const newReserved = reserved + 1;
        const newSold = sold;

        await client.query(
          `
            UPDATE paymentlinks
            SET inventory_reserved = $2,
                updated_at = NOW()
            WHERE id = $1
          `,
          [link.id, newReserved]
        );

        link.inventory_reserved = newReserved;
        link.inventory_sold = newSold;
      } else {
        await client.query(
          `UPDATE paymentlinks SET updated_at = NOW() WHERE id = $1`,
          [link.id]
        );
      }

      const currencies = await this.loadPaymentLinkCurrencies(client, link.id);
      const paymentLinkOrder = this.mapRowToPaymentLinkOrder(orderResult.rows[0]);
      const paymentLink = this.mapRowToPaymentLink(link, currencies);
      if (totalInventory !== null) {
        paymentLink.inventory_reserved = link.inventory_reserved;
        paymentLink.inventory_sold = link.inventory_sold;
        paymentLink.status = link.status;
      }

      return {
        paymentLink,
        paymentLinkOrder,
      };
    });
  }

  async attachOrderId(paymentLinkOrderId: string, orderId: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE paymentlink_orders
        SET order_id = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [paymentLinkOrderId, orderId]
    );
  }

  async releaseReservation(paymentLinkOrderId: string): Promise<void> {
    await this.withTransaction(async (client) => {
      const orderResult = await client.query(
        `SELECT * FROM paymentlink_orders WHERE id = $1 FOR UPDATE`,
        [paymentLinkOrderId]
      );

      if (!orderResult.rowCount || orderResult.rowCount === 0) {
        return;
      }

      const order = orderResult.rows[0];
      const linkResult = await client.query(
        `SELECT * FROM paymentlinks WHERE id = $1 FOR UPDATE`,
        [order.paymentlink_id]
      );

      if (!linkResult.rowCount || linkResult.rowCount === 0) {
        await client.query(`DELETE FROM paymentlink_orders WHERE id = $1`, [paymentLinkOrderId]);
        return;
      }

      const link = linkResult.rows[0];

      let reserved = link.inventory_reserved;
      let sold = link.inventory_sold;
      if (link.inventory_total !== null && order.status === 'pending') {
        reserved = Math.max(0, reserved - 1);
      }

      await client.query(`DELETE FROM paymentlink_orders WHERE id = $1`, [paymentLinkOrderId]);

      if (link.inventory_total !== null) {
        // Keep status as is - don't automatically change to soldout
        const nextStatus = link.status;

        await client.query(
          `
            UPDATE paymentlinks
            SET inventory_reserved = $2,
                inventory_sold = $3,
                status = $4,
                updated_at = NOW()
            WHERE id = $1
          `,
          [link.id, reserved, sold, nextStatus]
        );
      } else {
        await client.query(
          `UPDATE paymentlinks SET updated_at = NOW() WHERE id = $1`,
          [link.id]
        );
      }
    });
  }

  async syncOrderStatus(input: SyncOrderStatusInput): Promise<void> {
    const { orderReference, orderId, newStatus, completedAt = null } = input;

    await this.withTransaction(async (client) => {
      // ✅ Fix: Use order_id (Processor Order UUID) instead of id (PaymentLink Order UUID)
      const orderResult = await client.query(
        `SELECT * FROM paymentlink_orders WHERE order_id = $1 FOR UPDATE`,
        [orderId]  // Use orderId (Processor UUID) instead of orderReference (business ref)
      );

      if (!orderResult.rowCount || orderResult.rowCount === 0) {
        return;
      }

      const order = orderResult.rows[0];

      const linkResult = await client.query(
        `SELECT * FROM paymentlinks WHERE id = $1 FOR UPDATE`,
        [order.paymentlink_id]
      );
      if (!linkResult.rowCount || linkResult.rowCount === 0) {
        return;
      }

      const link = linkResult.rows[0];
      const currentStatus: PaymentLinkOrderStatus = order.status;
      if (currentStatus === newStatus) {
        // Ensure order_id is stored if missing
        if (!order.order_id) {
          await client.query(
            `
              UPDATE paymentlink_orders
              SET order_id = $2,
                  updated_at = NOW()
              WHERE id = $1
            `,
            [orderReference, orderId]
          );
        }
        return;
      }

      let reserved = link.inventory_reserved;
      let sold = link.inventory_sold;

      const decrementReserved = () => {
        if (link.inventory_total !== null) {
          reserved = Math.max(0, reserved - 1);
        }
      };

      const incrementSold = () => {
        if (link.inventory_total !== null) {
          sold += 1;
        }
      };

      if (currentStatus === 'pending') {
        decrementReserved();
      }

      if (newStatus === 'completed') {
        incrementSold();
      }

      // Keep status as is - don't automatically change to soldout
      const nextStatus = link.status;

      await client.query(
        `
          UPDATE paymentlink_orders
          SET status = $2,
              order_id = COALESCE(order_id, $3),
              completed_at = CASE
                WHEN $2 = 'completed' THEN $4
                ELSE completed_at
              END,
              updated_at = NOW()
          WHERE id = $1
        `,
        [orderReference, newStatus, orderId, completedAt]
      );

      if (link.inventory_total !== null) {
        await client.query(
          `
            UPDATE paymentlinks
            SET inventory_reserved = $2,
                inventory_sold = $3,
                status = $4,
                updated_at = NOW()
            WHERE id = $1
          `,
          [link.id, reserved, sold, nextStatus]
        );
      } else {
        await client.query(`UPDATE paymentlinks SET updated_at = NOW() WHERE id = $1`, [link.id]);
      }
    });
  }

  async getPaymentLinkOrder(id: string): Promise<PaymentLinkOrder | null> {
    const result = await this.pool.query(`SELECT * FROM paymentlink_orders WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0 ? this.mapRowToPaymentLinkOrder(result.rows[0]) : null;
  }

  async listPaymentLinkOrders(
    paymentLinkId: string,
    organizationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaymentLinkOrder[]> {
    const result = await this.pool.query(
      `
        SELECT *
        FROM paymentlink_orders
        WHERE paymentlink_id = $1 AND organization_id = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `,
      [paymentLinkId, organizationId, limit, offset]
    );
    return result.rows.map((row) => this.mapRowToPaymentLinkOrder(row));
  }

  private async ensureUniqueSlug(client: PoolClient, slug: string): Promise<string> {
    const result = await client.query(`SELECT slug FROM paymentlinks WHERE slug = $1`, [slug]);
    if ((result.rowCount ?? 0) > 0) {
      // Slug is taken, generate a new one
      return this.ensureUniqueSlug(client, slugGenerator());
    }
    return slug;
  }
}
