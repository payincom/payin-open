/**
 * Address Pool Query Tools (Read-only)
 */

import type { PayInApiClient } from '../lib/api-client.js';

/**
 * Tool: check_address_pool_availability
 * Check address pool availability status
 */
export const checkAddressPoolAvailabilityTool = {
  name: 'check_address_pool_availability',
  description: 'Check address pool availability and usage statistics for a protocol family',
  inputSchema: {
    type: 'object',
    properties: {
      protocol: {
        type: 'string',
        enum: ['evm', 'tron'],
        description: 'Protocol family: "evm" or "tron"'
      }
    },
    required: ['protocol']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const availability = await apiClient.getAddressPoolAvailability(args.protocol);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(availability, null, 2)
      }]
    };
  }
};

/**
 * Tool: list_pool_addresses
 * List addresses from the address pool (for monitoring purposes)
 */
export const listPoolAddressesTool = {
  name: 'list_pool_addresses',
  description: 'List addresses from the address pool with their current status (for monitoring only)',
  inputSchema: {
    type: 'object',
    properties: {
      protocol: {
        type: 'string',
        enum: ['evm', 'tron'],
        description: 'Filter by protocol family'
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)'
      },
      pageSize: {
        type: 'number',
        description: 'Items per page (default: 20)'
      }
    }
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const result = await apiClient.listAddresses(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
};

/**
 * Export all address pool tools
 */
export const addressPoolTools = [
  checkAddressPoolAvailabilityTool,
  listPoolAddressesTool
];
