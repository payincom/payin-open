/**
 * Export all MCP tools
 */

import { orderTools } from './orders.js';
import { depositTools } from './deposits.js';
import { transferTools } from './transfers.js';
import { addressPoolTools } from './address-pool.js';
import { configTools } from './config.js';
import { monitoringTools } from './monitoring.js';
import { docsTools } from './docs-search.js';
import { paymentLinkTools } from './payment-links.js';

export const allTools = [
  ...orderTools,
  ...depositTools,
  ...transferTools,
  ...addressPoolTools,
  ...configTools,
  ...monitoringTools,
  ...docsTools,
  ...paymentLinkTools
];

export {
  orderTools,
  depositTools,
  transferTools,
  addressPoolTools,
  configTools,
  monitoringTools,
  docsTools,
  paymentLinkTools
};
