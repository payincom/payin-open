#!/usr/bin/env tsx
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { DEFAULT_OPEN_ORGANIZATION_ID } from '@payin/processor';
import {
  buildAuthHeaders,
  checkHttpEndpoint,
  collectOpenDatabaseChecks,
  collectOpenDoctorChecks,
  formatChecks,
} from './ops-lib.js';

const { values } = parseArgs({
  options: {
    json: { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
    url: { type: 'string' },
    timeout: { type: 'string', default: '5000' },
    'api-key': { type: 'string' },
    token: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  console.log(`PayIn Open doctor\n\nUsage:\n  npm run open:doctor\n  npm run open:doctor -- --json\n  npm run open:doctor -- --strict\n  npm run open:doctor -- --strict --url http://localhost:3000\n  npm run open:doctor -- --strict --url http://localhost:3000 --api-key <redacted>\n\n--strict fails when deployment-critical env like DB_CONNECTION_STRING is missing or live checks fail.\n--url enables live API health/config checks.\n--api-key/--token enables authenticated monitor/config readiness checks.`);
  process.exit(0);
}

const timeoutMs = Number.parseInt(values.timeout || '5000', 10);
const summary = collectOpenDoctorChecks({ fileExists: existsSync, strict: values.strict, mode: 'doctor' });

const db = await collectOpenDatabaseChecks({
  connectionString: process.env.DB_CONNECTION_STRING,
  merchantOrganizationId:
    process.env.PAYIN_OPEN_ORGANIZATION_ID ||
    DEFAULT_OPEN_ORGANIZATION_ID,
  strict: Boolean(values.strict),
});
summary.database = db.summary;
summary.checks.push(...db.checks);

const baseUrl = values.url?.replace(/\/$/, '');
if (baseUrl) {
  summary.checks.push(await checkHttpEndpoint(`${baseUrl}/health`, timeoutMs));
  summary.checks.push(await checkHttpEndpoint(`${baseUrl}/api/chains`, timeoutMs));
  summary.checks.push(await checkHttpEndpoint(`${baseUrl}/api/tokens`, timeoutMs));

  const authHeaders = buildAuthHeaders({ apiKey: values['api-key'], bearerToken: values.token });
  if (Object.keys(authHeaders).length > 0) {
    summary.checks.push(await checkHttpEndpoint(`${baseUrl}/api/v1/chains`, timeoutMs, { headers: authHeaders }));
  } else {
    summary.checks.push({
      id: 'api.authenticated-readiness',
      status: values.strict ? 'fail' : 'warn',
      message: 'Authenticated API readiness checks were skipped because no --api-key or --token was provided.',
      suggestion: 'Pass --api-key or --token to verify monitor/chain status through /api/v1/chains.',
    });
  }
} else {
  summary.checks.push({
    id: 'api.live-check',
    status: values.strict ? 'fail' : 'warn',
    message: 'No --url provided; live API checks were skipped.',
    suggestion: 'Start PayIn Open API and rerun: npm run open:doctor -- --url http://localhost:3000',
  });
}

summary.ok = summary.checks.every((check) => check.status !== 'fail');
console.log(values.json ? JSON.stringify(summary, null, 2) : formatChecks('PayIn Open Doctor', summary));
process.exit(summary.ok ? 0 : 1);
