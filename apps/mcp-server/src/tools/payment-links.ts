/**
 * Payment Link Management Tools
 */

import type { PayInApiClient } from '../lib/api-client.js';

/**
 * Tool: create_payment_link
 * Create a new payment link
 */
export const createPaymentLinkTool = {
  name: 'create_payment_link',
  description: '🔧 OPERATION: Create a new payment link in PayIn system. This will ACTUALLY create a payment link that can be shared with customers. Use this when you want to create a real payment link for collecting payments. Payment links support multiple currencies and chains.',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Payment link title (e.g., "Premium Subscription")'
      },
      description: {
        type: 'string',
        description: 'Optional description of the payment link'
      },
      amount: {
        type: ['string', 'number'],
        description: 'Payment amount (e.g., "29.99" or 29.99)'
      },
      currencies: {
        type: 'array',
        description: 'Array of currency configurations',
        items: {
          type: 'object',
          properties: {
            currency: {
              type: 'string',
              description: 'Token symbol (e.g., "USDT", "USDC")'
            },
            chainOptions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of chain IDs (e.g., ["ethereum-sepolia", "polygon-amoy"])'
            },
            amount: {
              type: ['string', 'number'],
              description: 'Optional currency-specific amount override'
            },
            is_primary: {
              type: 'boolean',
              description: 'Whether this is the primary currency option'
            },
            metadata: {
              type: 'object',
              description: 'Optional currency-specific metadata'
            }
          },
          required: ['currency', 'chainOptions']
        }
      },
      inventoryTotal: {
        type: 'number',
        description: 'Optional inventory limit (null for unlimited)'
      },
      expiresAt: {
        type: 'string',
        description: 'Optional expiration date (ISO 8601 format)'
      },
      metadata: {
        type: 'object',
        description: 'Optional metadata for the payment link'
      }
    },
    required: ['title', 'amount', 'currencies']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const link = await apiClient.createPaymentLink(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(link, null, 2)
      }]
    };
  }
};

/**
 * Tool: get_payment_link
 * Get payment link by ID
 */
export const getPaymentLinkTool = {
  name: 'get_payment_link',
  description: '🔍 QUERY: Get detailed information about a specific payment link by its ID. This will fetch real payment link data from PayIn system. Use this when you want to check payment link configuration or status.',
  inputSchema: {
    type: 'object',
    properties: {
      linkId: {
        type: 'string',
        description: 'Payment link ID (UUID format)'
      }
    },
    required: ['linkId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const link = await apiClient.getPaymentLink(args.linkId);
    if (!link) {
      return {
        content: [{
          type: 'text',
          text: `Payment link not found: ${args.linkId}`
        }],
        isError: true
      };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(link, null, 2)
      }]
    };
  }
};

/**
 * Tool: update_payment_link
 * Update payment link details
 */
export const updatePaymentLinkTool = {
  name: 'update_payment_link',
  description: '🔧 OPERATION: Update payment link details (title, description, amount, inventory, expiration). This will ACTUALLY modify the payment link configuration. Use this when you want to update payment link properties. Note: To update currencies, use update_payment_link_currencies instead.',
  inputSchema: {
    type: 'object',
    properties: {
      linkId: {
        type: 'string',
        description: 'Payment link ID (UUID format)'
      },
      title: {
        type: 'string',
        description: 'New title for the payment link'
      },
      description: {
        type: 'string',
        description: 'New description (use null to clear)'
      },
      amount: {
        type: ['string', 'number'],
        description: 'New payment amount'
      },
      inventoryTotal: {
        type: 'number',
        description: 'New inventory limit (use null for unlimited)'
      },
      expiresAt: {
        type: 'string',
        description: 'New expiration date (ISO 8601 format, use null to clear)'
      },
      metadata: {
        type: 'object',
        description: 'New metadata object'
      }
    },
    required: ['linkId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const { linkId, ...params } = args;
    const link = await apiClient.updatePaymentLink(linkId, params);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(link, null, 2)
      }]
    };
  }
};

/**
 * Tool: update_payment_link_currencies
 * Update payment link currencies configuration
 */
export const updatePaymentLinkCurrenciesTool = {
  name: 'update_payment_link_currencies',
  description: '🔧 OPERATION: Update payment link currencies and chain options. This will ACTUALLY replace the entire currencies configuration. Use this when you want to change accepted currencies or chains.',
  inputSchema: {
    type: 'object',
    properties: {
      linkId: {
        type: 'string',
        description: 'Payment link ID (UUID format)'
      },
      currencies: {
        type: 'array',
        description: 'New array of currency configurations (will replace existing)',
        items: {
          type: 'object',
          properties: {
            currency: {
              type: 'string',
              description: 'Token symbol (e.g., "USDT", "USDC")'
            },
            chainOptions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of chain IDs (e.g., ["ethereum-sepolia"])'
            },
            amount: {
              type: ['string', 'number'],
              description: 'Optional currency-specific amount override'
            },
            is_primary: {
              type: 'boolean',
              description: 'Whether this is the primary currency option'
            },
            metadata: {
              type: 'object',
              description: 'Optional currency-specific metadata'
            }
          },
          required: ['currency', 'chainOptions']
        }
      }
    },
    required: ['linkId', 'currencies']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const { linkId, ...params } = args;
    const link = await apiClient.updatePaymentLinkCurrencies(linkId, params);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(link, null, 2)
      }]
    };
  }
};

/**
 * Tool: publish_payment_link
 * Publish a payment link
 */
export const publishPaymentLinkTool = {
  name: 'publish_payment_link',
  description: '🔧 OPERATION: Publish a payment link to make it publicly accessible. This will ACTUALLY make the payment link available for customers. Optionally provide a custom slug. Use this when you want to activate a payment link.',
  inputSchema: {
    type: 'object',
    properties: {
      linkId: {
        type: 'string',
        description: 'Payment link ID (UUID format)'
      },
      slug: {
        type: 'string',
        description: 'Optional custom slug for the public URL (e.g., "premium-plan")'
      }
    },
    required: ['linkId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const link = await apiClient.publishPaymentLink(args.linkId, args.slug);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(link, null, 2)
      }]
    };
  }
};

/**
 * Tool: unpublish_payment_link
 * Unpublish a payment link
 */
export const unpublishPaymentLinkTool = {
  name: 'unpublish_payment_link',
  description: '🔧 OPERATION: Unpublish a payment link to make it temporarily unavailable. This will ACTUALLY disable the public URL. Use this when you want to temporarily deactivate a payment link without deleting it.',
  inputSchema: {
    type: 'object',
    properties: {
      linkId: {
        type: 'string',
        description: 'Payment link ID (UUID format)'
      }
    },
    required: ['linkId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const link = await apiClient.unpublishPaymentLink(args.linkId);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(link, null, 2)
      }]
    };
  }
};

/**
 * Tool: archive_payment_link
 * Archive a payment link
 */
export const archivePaymentLinkTool = {
  name: 'archive_payment_link',
  description: '🔧 OPERATION: Archive a payment link to move it to archived status. This will ACTUALLY mark the payment link as archived. Use this when you want to hide a payment link from active lists without deleting it.',
  inputSchema: {
    type: 'object',
    properties: {
      linkId: {
        type: 'string',
        description: 'Payment link ID (UUID format)'
      }
    },
    required: ['linkId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const link = await apiClient.archivePaymentLink(args.linkId);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(link, null, 2)
      }]
    };
  }
};

/**
 * Tool: restore_payment_link
 * Restore a payment link from archive
 */
export const restorePaymentLinkTool = {
  name: 'restore_payment_link',
  description: '🔧 OPERATION: Restore a payment link from archived status. This will ACTUALLY unarchive the payment link. Use this when you want to restore a previously archived payment link.',
  inputSchema: {
    type: 'object',
    properties: {
      linkId: {
        type: 'string',
        description: 'Payment link ID (UUID format)'
      }
    },
    required: ['linkId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const link = await apiClient.restorePaymentLink(args.linkId);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(link, null, 2)
      }]
    };
  }
};

/**
 * Tool: list_payment_links
 * List payment links with filtering and pagination
 */
export const listPaymentLinksTool = {
  name: 'list_payment_links',
  description: '🔍 QUERY: List payment links with filtering and pagination. This will fetch real payment link data from PayIn system. Use this when you want to view multiple payment links, filter by status, or search by title.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status: "draft", "published", or comma-separated list (e.g., "draft,published")'
      },
      search: {
        type: 'string',
        description: 'Search by title or slug'
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)'
      },
      limit: {
        type: 'number',
        description: 'Items per page (default: 20)'
      },
      includeArchived: {
        type: 'boolean',
        description: 'Include archived payment links in results (default: false)'
      },
      archivedOnly: {
        type: 'boolean',
        description: 'Show only archived payment links (default: false)'
      }
    }
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const result = await apiClient.listPaymentLinks(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
};

/**
 * Tool: get_payment_link_stats
 * Get payment link statistics
 */
export const getPaymentLinkStatsTool = {
  name: 'get_payment_link_stats',
  description: '📊 ANALYTICS: Get payment link statistics including total links, orders, revenue, and conversion rate. This will calculate real statistics from PayIn system. Use this when you want to generate reports or analyze payment link performance.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status: "draft", "published", or comma-separated list'
      },
      createdAfter: {
        type: 'string',
        description: 'Filter links created after this date (ISO 8601 format)'
      },
      createdBefore: {
        type: 'string',
        description: 'Filter links created before this date (ISO 8601 format)'
      }
    }
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const params: any = {};

    if (args.status) params.status = args.status;
    if (args.createdAfter) params.createdAfter = new Date(args.createdAfter);
    if (args.createdBefore) params.createdBefore = new Date(args.createdBefore);

    const stats = await apiClient.getPaymentLinkStatistics(params);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(stats, null, 2)
      }]
    };
  }
};

/**
 * Tool: get_payment_link_preview_url
 * Get payment link preview URL
 */
export const getPaymentLinkPreviewUrlTool = {
  name: 'get_payment_link_preview_url',
  description: '🔧 OPERATION: Generate a temporary preview URL for a payment link. This will ACTUALLY create a time-limited preview link that can be used to test the checkout experience. The preview URL expires in 10 minutes. Use this when you want to preview a payment link before publishing.',
  inputSchema: {
    type: 'object',
    properties: {
      linkId: {
        type: 'string',
        description: 'Payment link ID (UUID format)'
      }
    },
    required: ['linkId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const result = await apiClient.getPaymentLinkPreviewUrl(args.linkId);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
};

/**
 * Tool: list_payment_link_orders
 * List orders for a payment link
 */
export const listPaymentLinkOrdersTool = {
  name: 'list_payment_link_orders',
  description: '🔍 QUERY: List all orders created from a specific payment link. This will fetch real order data from PayIn system. Use this when you want to see what orders have been generated by a payment link.',
  inputSchema: {
    type: 'object',
    properties: {
      linkId: {
        type: 'string',
        description: 'Payment link ID (UUID format)'
      }
    },
    required: ['linkId']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const orders = await apiClient.listPaymentLinkOrders(args.linkId);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(orders, null, 2)
      }]
    };
  }
};

/**
 * Export all payment link tools
 */
export const paymentLinkTools = [
  createPaymentLinkTool,
  getPaymentLinkTool,
  updatePaymentLinkTool,
  updatePaymentLinkCurrenciesTool,
  publishPaymentLinkTool,
  unpublishPaymentLinkTool,
  archivePaymentLinkTool,
  restorePaymentLinkTool,
  listPaymentLinksTool,
  getPaymentLinkStatsTool,
  getPaymentLinkPreviewUrlTool,
  listPaymentLinkOrdersTool
];
