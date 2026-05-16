import type { CommandResult } from './types.js';

export function printResult(result: CommandResult, json = false): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(result.ok ? '✅ OK' : '❌ FAILED');
  if (result.error) console.log(result.error);
  for (const check of result.checks || []) console.log(`${check.ok ? '✅' : '❌'} ${check.id}: ${check.message}`);
  if (result.data !== undefined) console.log(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
  if (result.suggestions?.length) {
    console.log('\nSuggestions:');
    for (const suggestion of result.suggestions) console.log(`- ${suggestion}`);
  }
}
