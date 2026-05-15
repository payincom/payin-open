/**
 * Monitoring and System Tools
 */

import type { PayInApiClient } from '../lib/api-client.js';

/**
 * Tool: get_system_health
 * Get system health status
 */
export const getSystemHealthTool = {
  name: 'get_system_health',
  description: 'Get PayIn system health status including API, processor, monitor, and database',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const health = await apiClient.getSystemHealth();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(health, null, 2)
      }]
    };
  }
};

/**
 * Tool: generate_analytics_report
 * Generate analytics report for a time period
 */
export const generateAnalyticsReportTool = {
  name: 'generate_analytics_report',
  description: 'Generate analytics report including order statistics, deposit statistics, and transfer data',
  inputSchema: {
    type: 'object',
    properties: {
      startDate: {
        type: 'string',
        description: 'Report start date (ISO 8601 format)'
      },
      endDate: {
        type: 'string',
        description: 'Report end date (ISO 8601 format)'
      },
      chain: {
        type: 'string',
        description: 'Optional: filter by specific chain'
      }
    },
    required: ['startDate', 'endDate']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const startDate = new Date(args.startDate);
    const endDate = new Date(args.endDate);

    // Fetch order statistics
    const orderStats = await apiClient.getOrderStatistics({
      createdAfter: startDate,
      createdBefore: endDate,
      chain: args.chain
    });

    // Fetch recent orders
    const ordersResult = await apiClient.listOrders({
      createdAfter: startDate,
      createdBefore: endDate,
      chain: args.chain,
      limit: 100
    });

    // Fetch recent transfers
    const transfersResult = await apiClient.listTransfers({
      chain: args.chain,
      limit: 100
    });

    const report = {
      period: {
        start: args.startDate,
        end: args.endDate
      },
      orderStatistics: orderStats,
      recentOrders: {
        count: ordersResult.orders.length,
        total: ordersResult.pagination.total,
        orders: ordersResult.orders.slice(0, 10) // Top 10
      },
      recentTransfers: {
        count: transfersResult.transfers.length,
        total: transfersResult.pagination.total,
        transfers: transfersResult.transfers.slice(0, 10) // Top 10
      },
      generatedAt: new Date().toISOString()
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(report, null, 2)
      }]
    };
  }
};

/**
 * Export all monitoring tools
 */
export const monitoringTools = [
  getSystemHealthTool,
  generateAnalyticsReportTool
];
