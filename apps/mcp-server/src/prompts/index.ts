/**
 * Export all MCP prompts
 */

import { integrationWizardPrompt } from './integration-wizard.js';
import { troubleshootingPrompt } from './troubleshooting.js';

export const allPrompts = [
  integrationWizardPrompt,
  troubleshootingPrompt
];

export {
  integrationWizardPrompt,
  troubleshootingPrompt
};
