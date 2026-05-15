/**
 * Transfer Query Tools
 */

import type { PayInApiClient } from '../lib/api-client.js';

/**
 * Tool: list_transfers
 * List blockchain transfers
 */
export const listTransfersTool = {
  name: 'list_transfers',
  description: 'List blockchain transfer records with optional filtering by chain, token, address, status',
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'Filter by chain ID (e.g., "ethereum-sepolia")'
      },
      token: {
        type: 'string',
        description: 'Filter by token symbol (e.g., "USDT")'
      },
      address: {
        type: 'string',
        description: 'Filter by receiving address'
      },
      status: {
        type: 'string',
        description: 'Filter by status: "pending", "confirmed", "completed"'
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)'
      },
      limit: {
        type: 'number',
        description: 'Items per page (default: 20)'
      }
    }
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const result = await apiClient.listTransfers(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
};

/**
 * Export all transfer tools
 */
export const transferTools = [
  listTransfersTool
];
