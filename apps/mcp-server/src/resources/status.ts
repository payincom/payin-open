/**
 * Status Resources
 * Provides real-time system status information
 */

import type { PayInApiClient } from '../lib/api-client.js';

/**
 * Status resources
 */
export const createStatusResources = (apiClient: PayInApiClient) => [
  {
    uri: 'status://payin/health',
    name: 'System Health',
    description: 'PayIn system health status',
    mimeType: 'application/json',
    handler: async () => {
      const health = await apiClient.getSystemHealth();
      return {
        contents: [{
          uri: 'status://payin/health',
          mimeType: 'application/json',
          text: JSON.stringify(health, null, 2)
        }]
      };
    }
  },
  {
    uri: 'status://payin/orders/recent',
    name: 'Recent Orders',
    description: 'Recent payment orders',
    mimeType: 'application/json',
    handler: async () => {
      const result = await apiClient.listOrders({ limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
      return {
        contents: [{
          uri: 'status://payin/orders/recent',
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  },
  {
    uri: 'status://payin/deposits/recent',
    name: 'Recent Deposits',
    description: 'Recent user deposits',
    mimeType: 'application/json',
    handler: async () => {
      const result = await apiClient.listDepositAddresses({ limit: 10 });
      return {
        contents: [{
          uri: 'status://payin/deposits/recent',
          mimeType: 'application/json',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  },
  {
    uri: 'status://payin/address-pool',
    name: 'Address Pool Status',
    description: 'Address pool availability status',
    mimeType: 'application/json',
    handler: async () => {
      const evmPool = await apiClient.getAddressPoolAvailability('evm');
      const tronPool = await apiClient.getAddressPoolAvailability('tron');

      const status = {
        evm: evmPool,
        tron: tronPool,
        timestamp: new Date().toISOString()
      };

      return {
        contents: [{
          uri: 'status://payin/address-pool',
          mimeType: 'application/json',
          text: JSON.stringify(status, null, 2)
        }]
      };
    }
  }
];
