/**
 * Business Context Resolver
 * Resolves business context (order or deposit) for a given address and chain
 */

import type { DatabaseInterface } from '../database/interface.js';
import type { OrderDbObject } from '../repositories/order.repository.js';
import { ChainStateRepository } from '../repositories/chain-state.repository.js';
import { OrderRepository } from '../repositories/order.repository.js';
import { AddressPoolRepository } from '../repositories/address-pool.repository.js';
import type { PostgreSQLDatabase } from '../database/database.js';
import type { ConfigProvider } from '@payin/shared';

/**
 * Business context types
 */
export type BusinessContextType = 'order' | 'deposit';

/**
 * Order context entity
 */
export interface OrderContext {
  orderId: string;
  merchantId: string;
  status: string;
  requiredAmount: string;
  receivedAmount: string;
  currency: string;
  chainId: string;
  address: string;
  createdAt: Date;
  expiresAt: Date;
  paymentWindowEndsAt: Date;
  gracePeriodEndsAt: Date;
  metadata: any;
}

/**
 * Deposit context entity
 */
export interface DepositContext {
  userId: string;
  address: string;
  protocol: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Business context result
 */
export interface BusinessContext {
  type: BusinessContextType;
  id: string;
  entity: OrderContext | DepositContext;
}

/**
 * Business Context Resolver
 * Resolves which business context (order or deposit) an address/chain combination belongs to
 */
export class BusinessContextResolver {
  private logger = console;
  private chainStateRepository: ChainStateRepository;
  private orderRepository: OrderRepository;
  private addressPoolRepository: AddressPoolRepository;

  constructor(
    private database: DatabaseInterface,
    cooldownMinutes: number = 30,
    configProvider?: ConfigProvider
  ) {
    this.chainStateRepository = new ChainStateRepository(database as any);
    this.orderRepository = new OrderRepository(database as PostgreSQLDatabase);
    this.addressPoolRepository = new AddressPoolRepository(database as PostgreSQLDatabase, cooldownMinutes, configProvider);
  }

  /**
   * Wait for database to be ready
   */
  private async waitForDatabase(): Promise<void> {
    const maxRetries = 20;
    const retryDelay = 100; // 100ms

    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.database.query('SELECT 1');
        return; // Database is ready
      } catch (error: any) {
        if (error.message === 'Database not initialized' || error.message?.includes('database not ready')) {
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
        throw error;
      }
    }

    throw new Error('Database not ready after maximum retries');
  }

  /**
   * Resolve business context for an address on a specific chain
   * Priority: active orders > paid orders with insufficient amount > deposit bindings
   */
  async resolveBusinessContext(address: string, chainId: string): Promise<BusinessContext | null> {
    // Validate input parameters
    if (!address || typeof address !== 'string') {
      this.logger.warn(`❌ RESOLVER: Invalid address parameter: ${address}`);
      return null;
    }

    if (!chainId || typeof chainId !== 'string') {
      this.logger.warn(`❌ RESOLVER: Invalid chainId parameter: ${chainId}`);
      return null;
    }

    // Normalize address to lowercase for comparison
    const normalizedAddress = address.toLowerCase();

    // First, try to find active orders (pending, processing, etc.)
    const activeOrder = await this.chainStateRepository.findActiveOrder(normalizedAddress, chainId);
    if (activeOrder) {
      return {
        type: 'order',
        id: activeOrder.id,
        entity: this.transformOrderToContext(activeOrder)
      };
    }

    // Then, try to find paid orders with insufficient amounts
    const insufficientPaidOrder = await this.chainStateRepository.findInsufficientPaidOrder(normalizedAddress, chainId);
    if (insufficientPaidOrder) {
      return {
        type: 'order',
        id: insufficientPaidOrder.id,
        entity: this.transformOrderToContext(insufficientPaidOrder)
      };
    }

    // Finally, try to find deposit bindings
    const depositBinding = await this.chainStateRepository.findDepositBinding(normalizedAddress, chainId);
    if (depositBinding) {
      return {
        type: 'deposit',
        id: depositBinding.deposit_reference,
        entity: this.transformDepositToContext(depositBinding)
      };
    }

    return null;
  }

  /**
   * Find active orders (not paid or completed)
   */
  private async findActiveOrder(address: string, chainId: string): Promise<OrderDbObject | null> {
    try {
      // Wait for database to be ready
      await this.waitForDatabase();

      console.log(`🔍 [BusinessContextResolver] findActiveOrder query:`, {
        address: address.toLowerCase(),
        chainId,
        query: 'Looking for pending orders'
      });

      // Use repository to find pending orders
      const pendingOrders = await this.orderRepository.findByStatus('pending');
      const matchingOrder = pendingOrders.find(order =>
        order.address.toLowerCase() === address.toLowerCase() &&
        order.chain === chainId
      );

      console.log(`🔍 [BusinessContextResolver] findActiveOrder result:`, {
        resultCount: matchingOrder ? 1 : 0,
        results: matchingOrder || 'No results'
      });

      return matchingOrder || null;
    } catch (error: any) {
      if (error.message === 'Database not initialized' || error.message?.includes('database not ready')) {
        console.warn(`⚠️  Database not ready, skipping order lookup for ${address}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Find paid orders with insufficient received amount
   */
  private async findInsufficientPaidOrder(address: string, chainId: string): Promise<OrderDbObject | null> {
    try {
      // Wait for database to be ready
      await this.waitForDatabase();

      // Use repository to find pending orders
      const pendingOrders = await this.orderRepository.findByStatus('pending');
      const matchingOrder = pendingOrders.find(order =>
        order.address.toLowerCase() === address.toLowerCase() &&
        order.chain === chainId &&
        parseFloat(order.confirmed_received) < parseFloat(order.amount)
      );

      return matchingOrder || null;
    } catch (error: any) {
      if (error.message === 'Database not initialized' || error.message?.includes('database not ready')) {
        console.warn(`⚠️  Database not ready, skipping insufficient paid order lookup for ${address}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Find active deposit binding for the address
   */
  private async findDepositBinding(address: string, chainId: string): Promise<any | null> {
    try {
      // Wait for database to be ready
      await this.waitForDatabase();

      // Get protocol family from chainId with improved mapping
      const protocol = this.getProtocol(chainId);

      console.log(`🔍 [BusinessContextResolver] Finding deposit binding:`, {
        address: address.toLowerCase(),
        chainId,
        protocol,
        originalAddress: address
      });

      // Use direct database query to find deposit binding by address
      // This is a reverse lookup (address -> deposit_reference), so we can't use the repository method
      // which requires deposit_reference as input
      const result = await this.database.query(`
        SELECT deposit_reference, address, protocol, state
        FROM address_pool
        WHERE LOWER(address) = $1
        AND protocol = $2
        AND deposit_reference IS NOT NULL
        LIMIT 1
      `, [address.toLowerCase(), protocol]);

      console.log(`🔍 [BusinessContextResolver] Deposit binding query result:`, {
        resultCount: result.length,
        query: {
          address: address.toLowerCase(),
          protocol
        },
        result: result
      });

      // Debug: Let's also check what addresses are actually in the pool
      const debugResult = await this.database.query(`
        SELECT address, deposit_reference, protocol, state
        FROM address_pool
        WHERE protocol = $1
        LIMIT 10
      `, [protocol]);

      console.log(`🔍 [BusinessContextResolver] Debug - All addresses in pool for ${protocol}:`, debugResult);

      if (result.length > 0) {
        console.log(`✅ [BusinessContextResolver] Found deposit binding:`, result[0]);
        return result[0];
      }

      return null;
    } catch (error: any) {
      if (error.message === 'Database not initialized' || error.message?.includes('database not ready')) {
        console.warn(`⚠️  Database not ready, skipping deposit binding lookup for ${address}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Transform Order to OrderContext
   */
  private transformOrderToContext(order: OrderDbObject): OrderContext {
    return {
      orderId: order.id,
      merchantId: 'system', // OrderDbObject doesn't have merchant_id, use default
      status: order.status,
      requiredAmount: order.amount,
      receivedAmount: order.confirmed_received || '0.000000',
      currency: order.token,
      chainId: order.chain,
      address: order.address,
      createdAt: new Date(order.created_at),
      expiresAt: new Date(order.grace_period_ends_at), // Use grace_period_ends_at as expires
      paymentWindowEndsAt: new Date(order.payment_window_ends_at),
      gracePeriodEndsAt: new Date(order.grace_period_ends_at),
      metadata: order.metadata ?
        (typeof order.metadata === 'string' ? JSON.parse(order.metadata) : order.metadata)
        : {}
    };
  }


  /**
   * Transform deposit binding to DepositContext
   */
  private transformDepositToContext(binding: any): DepositContext {
    return {
      userId: binding.deposit_reference,
      address: binding.address,
      protocol: binding.protocol,
      isActive: Boolean(binding.is_active),
      createdAt: new Date(binding.created_at),
      updatedAt: new Date(binding.updated_at)
    };
  }

  /**
   * Get protocol family from chain ID
   */
  private getProtocol(chainId: string): 'evm' | 'tron' {
    if (chainId.includes('tron') || chainId.includes('nile') || chainId.includes('shasta')) {
      return 'tron';
    }
    return 'evm';
  }
}