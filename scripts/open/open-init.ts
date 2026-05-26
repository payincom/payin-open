#!/usr/bin/env tsx
import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';
import { collectOpenDatabaseChecks, collectOpenDoctorChecks, formatChecks } from './ops-lib.js';
import { buildOpenInitInvocation } from './init-plan.js';

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
  console.log(`PayIn Open initialization\n\nUsage:\n  npm run open:init -- --check\n  npm run open:init -- --dry-run\n  npm run open:init\n  npm run open:init -- --demo-data\n  npm run open:init -- --force\n  NODE_ENV=production npm run open:init -- --force --confirm-reset\n\n--check       Validate repository/env readiness without mutating the database.\n--dry-run     Print the initialization plan without mutating the database.\n--strict      Make missing DB_CONNECTION_STRING fail preflight.\n--json        Emit machine-readable summary for Agent workflows.\n--demo-data   Seed demo data after schema initialization.\n--force       Reset database schema through the Open-safe path; requires --confirm-reset in production.`);
  process.exit(0);
}

const mode = values['dry-run'] ? 'dry-run' : values.check ? 'check' : 'init';
const summary = collectOpenDoctorChecks({ fileExists: existsSync, strict: Boolean(values.strict), mode });

if (values.check || values['dry-run']) {
  const db = await collectOpenDatabaseChecks({
    connectionString: process.env.DB_CONNECTION_STRING,
    merchantOrganizationId:
      process.env.PAYIN_OPEN_ORGANIZATION_ID ||
      DEFAULT_OPEN_ORGANIZATION_ID,
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
    const resetText = values.force ? 'reset schemas/data without creating default users' : 'initialize schemas without dropping data or creating default users';
    console.log(`Dry-run plan: ${resetText}, ensure PayIn Open merchant organization, optionally seed demo data.`);
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

const invocation = buildOpenInitInvocation({
  demoData: Boolean(values['demo-data']),
  force: Boolean(values.force),
});

const result = spawnSync(invocation.command, invocation.args, { stdio: 'inherit', env: invocation.env });
process.exit(result.status ?? 1);
