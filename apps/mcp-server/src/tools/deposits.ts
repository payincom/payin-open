/**
 * Deposit Management Tools
 */

import type { PayInApiClient } from '../lib/api-client.js';

/**
 * Tool: bind_deposit_address
 * Bind deposit address for a user
 */
export const bindDepositAddressTool = {
  name: 'bind_deposit_address',
  description: '🔧 OPERATION: Bind a permanent deposit address for a user. This will ACTUALLY allocate an address from the pool and start monitoring all chains in the protocol family (e.g., EVM family includes Ethereum, Polygon, etc.). Use this when you want to perform actual deposit address binding for a user. IMPORTANT: If user asks "how to bind address", they probably want documentation instead.',
  inputSchema: {
    type: 'object',
    properties: {
      depositReference: {
        type: 'string',
        description: 'Unique user reference ID from your system (e.g., "user_12345")'
      },
      protocol: {
        type: 'string',
        enum: ['evm', 'tron'],
        description: 'Blockchain protocol family: "evm" (Ethereum, Polygon, etc.) or "tron"'
      },
      metadata: {
        type: 'object',
        description: 'Optional metadata for the deposit address binding'
      }
    },
    required: ['depositReference', 'protocol']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const result = await apiClient.bindDepositAddress(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
};

/**
 * Tool: unbind_deposit_address
 * Unbind deposit address
 */
export const unbindDepositAddressTool = {
  name: 'unbind_deposit_address',
  description: '🔧 OPERATION: Unbind deposit address for a user. This will ACTUALLY release the address back to the pool and stop monitoring. Use this when you want to perform actual deposit address unbinding.',
  inputSchema: {
    type: 'object',
    properties: {
      depositReference: {
        type: 'string',
        description: 'User reference ID (will unbind all addresses for this user)'
      },
      address: {
        type: 'string',
        description: 'Specific address to unbind (requires protocol)'
      },
      protocol: {
        type: 'string',
        enum: ['evm', 'tron'],
        description: 'Protocol family (required when unbinding by address)'
      }
    }
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    await apiClient.unbindDepositAddress(args);
    return {
      content: [{
        type: 'text',
        text: 'Deposit address unbound successfully'
      }]
    };
  }
};

/**
 * Tool: get_user_deposit_address
 * Get user's deposit address
 */
export const getUserDepositAddressTool = {
  name: 'get_user_deposit_address',
  description: '🔍 QUERY: Get deposit address information for a specific user. This will fetch real address data from PayIn system. Use this when you want to check what deposit address is assigned to a user.',
  inputSchema: {
    type: 'object',
    properties: {
      depositReference: {
        type: 'string',
        description: 'User reference ID'
      },
      protocol: {
        type: 'string',
        enum: ['evm', 'tron'],
        description: 'Protocol family (default: "evm")'
      }
    },
    required: ['depositReference']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const protocol = args.protocol || 'evm';
    const address = await apiClient.getUserDepositAddress(args.depositReference, protocol);

    if (!address) {
      return {
        content: [{
          type: 'text',
          text: `No deposit address found for "${args.depositReference}" with protocol "${protocol}"`
        }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(address, null, 2)
      }]
    };
  }
};

/**
 * Tool: list_deposit_references
 * List deposit references with statistics
 */
export const listDepositReferencesTool = {
  name: 'list_deposit_references',
  description: '🔍 QUERY: List all users with deposit addresses and their statistics. This will fetch real data from PayIn system. Use this when you want to view all users or search for specific users.',
  inputSchema: {
    type: 'object',
    properties: {
      search: {
        type: 'string',
        description: 'Search by deposit reference'
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
    const result = await apiClient.listDepositReferences(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
};

/**
 * Tool: list_deposit_addresses
 * List deposit addresses
 */
export const listDepositAddressesTool = {
  name: 'list_deposit_addresses',
  description: '🔍 QUERY: List all deposit addresses with filtering options. This will fetch real address data from PayIn system. Use this when you want to view bound addresses or check address pool usage.',
  inputSchema: {
    type: 'object',
    properties: {
      protocol: {
        type: 'string',
        enum: ['evm', 'tron'],
        description: 'Filter by protocol family'
      },
      depositReference: {
        type: 'string',
        description: 'Filter by user reference ID'
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
    const result = await apiClient.listDepositAddresses(args);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
};

/**
 * Export all deposit tools
 */
export const depositTools = [
  bindDepositAddressTool,
  unbindDepositAddressTool,
  getUserDepositAddressTool,
  listDepositReferencesTool,
  listDepositAddressesTool
];
