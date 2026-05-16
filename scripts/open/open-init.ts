#!/usr/bin/env tsx
import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';
import { collectOpenDatabaseChecks, collectOpenDoctorChecks, formatChecks } from './ops-lib.js';

const { values } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'demo-data': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    'confirm-reset': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  console.log(`PayIn Open initialization\n\nUsage:\n  npm run open:init -- --check\n  npm run open:init -- --dry-run\n  npm run open:init\n  npm run open:init -- --demo-data\n\n--check       Validate repository/env readiness without mutating the database.\n--dry-run     Print the initialization plan without mutating the database.\n--strict      Make missing DB_CONNECTION_STRING fail preflight.\n--json        Emit machine-readable summary for Agent workflows.\n--demo-data   Seed demo data after schema initialization.\n--force       Reset database schema; requires --confirm-reset in production.`);
  process.exit(0);
}

const mode = values['dry-run'] ? 'dry-run' : values.check ? 'check' : 'init';
const summary = collectOpenDoctorChecks({ fileExists: existsSync, strict: Boolean(values.strict), mode });

if (values.check || values['dry-run']) {
  const db = await collectOpenDatabaseChecks({
    connectionString: process.env.DB_CONNECTION_STRING,
    defaultMerchantId: process.env.PAYIN_OPEN_ORGANIZATION_ID || DEFAULT_OPEN_ORGANIZATION_ID,
    strict: Boolean(values.strict),
  });
  summary.database = db.summary;
  summary.checks.push(...db.checks);
  summary.ok = summary.checks.every((check) => check.status !== 'fail');
}

if (values.json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(formatChecks('PayIn Open Init Preflight', summary));
}

if (!summary.ok) process.exit(1);
if (values.check || values['dry-run']) {
  if (values['dry-run'] && !values.json) {
    console.log('Dry-run plan: initialize Auth schema, Manager schema, Processor schema, ensure PayIn Open default merchant scope, optionally seed demo data.');
  }
  process.exit(0);
}

if (values.force && process.env.NODE_ENV === 'production' && !values['confirm-reset']) {
  console.error('Refusing production --force without --confirm-reset.');
  process.exit(1);
}

if (!process.env.DB_CONNECTION_STRING) {
  console.error('open:init requires DB_CONNECTION_STRING unless --check is used.');
  process.exit(1);
}

const args = ['tsx', 'scripts/init-database.ts'];
if (values['demo-data']) args.push('--demo-data');
if (values.force) args.push('--force');

const result = spawnSync('npx', args, { stdio: 'inherit', env: { ...process.env, PAYIN_RUNTIME: process.env.PAYIN_RUNTIME || 'open' } });
process.exit(result.status ?? 1);
