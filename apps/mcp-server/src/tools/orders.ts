/**
 * Order Management Tools
 */

import { z } from 'zod';
import type { PayInApiClient } from '../lib/api-client.js';

/**
 * Tool: create_order
 * Create a new payment order
 */
export const createOrderTool = {
  name: 'create_order',
  description: '🔧 OPERATION: Create a new payment order in PayIn system. This will ACTUALLY allocate a payment address and create an order record. Use this when you want to create a real order for testing or management operations. IMPORTANT: If user asks "how to create order", they probably want documentation instead.',
  inputSchema: {
    type: 'object',
    properties: {
      orderReference: {
        type: 'string',
        description: 'Unique order reference ID from your system (e.g., "order_2025_001")'
      },
      amount: {
        type: 'string',
        description: 'Payment amount (e.g., "10.50")'
      },
      currency: {
        type: 'string',
        description: 'Token symbol (e.g., "USDT", "USDC")'
      },
      chainId: {
        type: 'string',
        description: 'Blockchain network ID (e.g., "ethereum-sepolia", "polygon-amoy")'
      },
      successUrl: {
        type: 'string',
        description: 'Optional URL to redirect user after successful payment'
      },
      cancelUrl: {
        type: 'string',
        description: 'Optional URL to redirect user after payment expiration or cancellation'
      },
      metadata: {
        type: 'object',
        description: 'Optional metadata for the order'
      }
    },
    required: ['orderReference', 'amount', 'currency', 'chainId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const order = await apiClient.createOrder(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(order, null, 2)
      }]
    };
  }
};

/**
 * Tool: get_order
 * Get order by ID
 */
export const getOrderTool = {
  name: 'get_order',
  description: '🔍 QUERY: Get detailed information about a specific order by its ID. This will fetch real order data from PayIn system. Use this when you want to check order status or details.',
  inputSchema: {
    type: 'object',
    properties: {
      orderId: {
        type: 'string',
        description: 'Order ID (UUID format)'
      }
    },
    required: ['orderId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const order = await apiClient.getOrder(args.orderId);
    if (!order) {
      return {
        content: [{
          type: 'text',
          text: `Order not found: ${args.orderId}`
        }],
        isError: true
      };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(order, null, 2)
      }]
    };
  }
};

/**
 * Tool: list_orders
 * List orders with filtering and pagination
 */
export const listOrdersTool = {
  name: 'list_orders',
  description: '🔍 QUERY: List orders with filtering and pagination. This will fetch real order data from PayIn system. Use this when you want to view multiple orders, filter by status/chain, or generate reports.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status: "pending", "completed", "expired", or comma-separated list'
      },
      chain: {
        type: 'string',
        description: 'Filter by chain ID (e.g., "ethereum-sepolia")'
      },
      token: {
        type: 'string',
        description: 'Filter by token symbol (e.g., "USDT")'
      },
      orderReference: {
        type: 'string',
        description: 'Filter by order reference'
      },
      createdAfter: {
        type: 'string',
        description: 'Filter orders created after this date (ISO 8601 format)'
      },
      createdBefore: {
        type: 'string',
        description: 'Filter orders created before this date (ISO 8601 format)'
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)'
      },
      limit: {
        type: 'number',
        description: 'Items per page (default: 20)'
      },
      sortBy: {
        type: 'string',
        description: 'Sort field: "createdAt", "amount", etc.'
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order: "asc" or "desc"'
      }
    }
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const params: any = { ...args };

    // Convert date strings to Date objects
    if (args.createdAfter) {
      params.createdAfter = new Date(args.createdAfter);
    }
    if (args.createdBefore) {
      params.createdBefore = new Date(args.createdBefore);
    }

    const result = await apiClient.listOrders(params);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
};

/**
 * Tool: get_order_stats
 * Get order statistics
 */
export const getOrderStatsTool = {
  name: 'get_order_stats',
  description: '📊 ANALYTICS: Get order statistics including total count, completion rate, and total amount. This will calculate real statistics from PayIn system. Use this when you want to generate reports or analyze order performance.',
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'Filter by chain ID'
      },
      token: {
        type: 'string',
        description: 'Filter by token symbol'
      },
      createdAfter: {
        type: 'string',
        description: 'Filter orders created after this date (ISO 8601 format)'
      },
      createdBefore: {
        type: 'string',
        description: 'Filter orders created before this date (ISO 8601 format)'
      }
    }
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const params: any = {};

    if (args.chain) params.chain = args.chain;
    if (args.token) params.token = args.token;
    if (args.createdAfter) params.createdAfter = new Date(args.createdAfter);
    if (args.createdBefore) params.createdBefore = new Date(args.createdBefore);

    const stats = await apiClient.getOrderStatistics(params);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(stats, null, 2)
      }]
    };
  }
};

/**
 * Export all order tools
 */
export const orderTools = [
  createOrderTool,
  getOrderTool,
  listOrdersTool,
  getOrderStatsTool
];
