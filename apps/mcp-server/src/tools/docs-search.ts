/**
 * Documentation Search Tool
 * Allows searching PayIn documentation for detailed information
 */

import { searchDocs, getDocsByCategory, docsStats } from '../generated/docs-content.js';
import type { PayInApiClient } from '../lib/api-client.js';

/**
 * Tool: search_payin_docs
 * Search PayIn documentation
 */
export const searchPayinDocsTool = {
  name: 'search_payin_docs',
  description: '📖 DOCUMENTATION: Search PayIn documentation for detailed technical information, integration guides, and troubleshooting help. Use this when user asks "how to", "what is", or needs to learn about PayIn features. This searches embedded documentation and returns relevant excerpts.',
  inputSchema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: 'Search keyword or phrase (e.g., "order payment", "address pool", "webhook")'
      },
      category: {
        type: 'string',
        enum: ['architecture', 'guide', 'api', 'monitor', 'processor', 'examples'],
        description: 'Optional: filter by documentation category'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
        default: 5
      }
    },
    required: ['keyword']
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    const { keyword, category, maxResults = 5 } = args;

    try {
      const results = searchDocs(keyword, {
        category,
        maxResults,
        contextLength: 300
      });

      if (results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No documentation found for "${keyword}".

Try searching for:
- "order" or "payment" - for order payment integration
- "deposit" or "address" - for user deposit management
- "webhook" or "notification" - for callback configuration
- "chain" or "blockchain" - for supported chains
- "error" or "troubleshooting" - for problem solving

Available categories: ${docsStats.categories.join(', ')}`
          }]
        };
      }

      // Format results
      const formattedResults = results.map((result, index) => {
        return `## ${index + 1}. ${result.title}
**Category**: ${result.category}
**Relevance**: ${result.relevance}%

${result.excerpt}

---`;
      }).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `Found ${results.length} documentation match${results.length > 1 ? 'es' : ''} for "${keyword}":

${formattedResults}

**Tip**: For complete documentation, you can ask to read specific sections or use the web documentation.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching documentation: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
};

/**
 * Tool: list_doc_categories
 * List available documentation categories
 */
export const listDocCategoriesTool = {
  name: 'list_doc_categories',
  description: '📚 DOCUMENTATION: List all available documentation categories and statistics. Use this to help users navigate the documentation.',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  handler: async (args: any, apiClient: PayInApiClient) => {
    try {
      const categoryStats: Record<string, number> = {};

      for (const category of docsStats.categories) {
        const docs = getDocsByCategory(category);
        categoryStats[category] = docs.length;
      }

      const categoryList = Object.entries(categoryStats)
        .map(([cat, count]) => `- **${cat}**: ${count} document${count > 1 ? 's' : ''}`)
        .join('\n');

      return {
        content: [{
          type: 'text',
          text: `📚 PayIn Documentation Overview

**Total Documents**: ${docsStats.totalDocs}
**Total Size**: ${(docsStats.totalSize / 1024).toFixed(2)} KB
**Last Updated**: ${new Date(docsStats.generatedAt).toLocaleDateString()}

**Categories**:
${categoryList}

**Available Categories**:
- **architecture**: System design and architecture documents
- **guide**: User guides and integration tutorials
- **api**: API reference and specifications
- **monitor**: Blockchain monitoring system documentation
- **processor**: Payment processor documentation
- **examples**: Code examples and use cases

Use \`search_payin_docs\` to search within specific categories.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error listing categories: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
};

/**
 * Export all documentation tools
 */
export const docsTools = [
  searchPayinDocsTool,
  listDocCategoriesTool
];
