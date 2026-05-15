/**
 * Configuration Query Tools
 */

import type { PayInApiClient } from '../lib/api-client.js';

/**
 * Tool: list_chains
 * List supported blockchain networks
 */
export const listChainsTool = {
  name: 'list_chains',
  description: 'List all supported blockchain networks and their configuration',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const chains = await apiClient.listChains();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(chains, null, 2)
      }]
    };
  }
};

/**
 * Tool: list_tokens
 * List supported tokens
 */
export const listTokensTool = {
  name: 'list_tokens',
  description: 'List all supported tokens and their contract addresses on different chains',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const tokens = await apiClient.listTokens();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(tokens, null, 2)
      }]
    };
  }
};

/**
 * Export all config tools
 */
export const configTools = [
  listChainsTool,
  listTokensTool
];
