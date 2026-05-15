#!/usr/bin/env node
/**
 * Extract all Tailwind classes from payment-link-checkout-template.ts
 * and update tailwind.config.ts safelist automatically
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read template file
const templatePath = path.join(__dirname, '../../packages/shared/src/payment-link-checkout-template.ts');
const templateContent = fs.readFileSync(templatePath, 'utf-8');

// Extract all class names using regex
const classRegex = /class="([^"]*)"/g;
const allClasses = new Set();

let match;
while ((match = classRegex.exec(templateContent)) !== null) {
  const classes = match[1].split(/\s+/);
  classes.forEach(cls => {
    if (cls && !cls.includes('${')) { // Exclude template variables
      allClasses.add(cls);
    }
  });
}

// Sort and format
const sortedClasses = Array.from(allClasses).sort();

console.log('// Auto-generated safelist from payment-link-checkout-template.ts');
console.log('// Run: node extract-template-classes.js');
console.log('safelist: [');
sortedClasses.forEach(cls => {
  console.log(`  '${cls}',`);
});
console.log('],');

console.error(`\n✅ Found ${sortedClasses.length} unique classes`);
