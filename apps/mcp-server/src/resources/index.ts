/**
 * Export all MCP resources
 */

import { docsResources } from './docs-enhanced.js';
import { createStatusResources } from './status.js';
import type { PayInApiClient } from '../lib/api-client.js';

export function createAllResources(apiClient: PayInApiClient) {
  return [
    ...docsResources,
    ...createStatusResources(apiClient)
  ];
}

export { docsResources, createStatusResources };
