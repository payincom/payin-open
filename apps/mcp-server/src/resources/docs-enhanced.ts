/**
 * Enhanced Documentation Resources
 * Provides access to PayIn documentation using generated docs content
 */

import { getDoc, listDocs, getDocsByCategory, docsMeta } from '../generated/docs-content.js';

/**
 * Create documentation resources from generated content
 */
function createDocResources() {
  const resources = [];

  // Create resources for all available documents
  const allDocs = listDocs();

  for (const docKey of allDocs) {
    const meta = docsMeta[docKey];
    const uri = `docs://payin/${docKey}`;

    resources.push({
      uri,
      name: meta.title,
      description: `📚 DOCUMENTATION: ${meta.title} (Category: ${meta.category}). Read this to learn about this topic. Use this when user asks "what is", "how to", or needs to understand ${docKey.split('/').pop()}.`,
      mimeType: 'text/markdown',
      handler: async () => {
        const content = getDoc(docKey);
        return {
          contents: [{
            uri,
            mimeType: 'text/markdown',
            text: content
          }]
        };
      }
    });
  }

  return resources;
}

/**
 * Summary resource for quick overview
 */
const summaryResource = {
  uri: 'docs://payin/index',
  name: 'PayIn Documentation Index',
  description: '📚 DOCUMENTATION: Complete index of all PayIn documentation. Use this to see what documentation is available.',
  mimeType: 'text/markdown',
  handler: async () => {
    const categories = ['architecture', 'monitor', 'processor', 'examples'];
    let content = `# PayIn Documentation Index

Welcome to PayIn documentation! Here's what's available:

`;

    for (const category of categories) {
      const docs = getDocsByCategory(category);
      if (docs.length > 0) {
        content += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
        for (const docKey of docs) {
          const meta = docsMeta[docKey];
          const sizeKB = (meta.size / 1024).toFixed(1);
          content += `- **${meta.title}** (\`${docKey}\`) - ${sizeKB} KB\n`;
        }
        content += '\n';
      }
    }

    content += `
## How to Use

- **Browse by category**: Each section above contains related documents
- **Search**: Use the \`search_payin_docs\` tool to find specific information
- **Read directly**: Ask to read any document by name (e.g., "show me the monitor configuration documentation")

## Quick Links

- **Integration**: Search for "order" or "deposit" to learn about payment integration
- **Configuration**: Check processor and monitor configuration docs
- **Architecture**: Learn about system design and multi-chain support
- **Examples**: See real-world use cases and code examples

`;

    return {
      contents: [{
        uri: 'docs://payin/index',
        mimeType: 'text/markdown',
        text: content
      }]
    };
  }
};

/**
 * Export all documentation resources
 */
export const docsResources = [
  summaryResource,
  ...createDocResources()
];
