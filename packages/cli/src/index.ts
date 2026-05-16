#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { loadConfig, redactProfile, removeProfile, saveConfig, upsertProfile, useProfile } from './config.js';
import { resolveTarget } from './client.js';
import { addressPoolImport, apiKeyCreate, apiKeyList, apiKeyRevoke, createClient, doctor, login, simpleGet, smoke, webhookTest, whoami } from './operations.js';
import { printResult } from './output.js';
import type { GlobalOptions } from './types.js';

const program = new Command();
program
  .name('payin')
  .description('PayIn operator CLI for Open and Cloud runtime operations')
  .version('0.1.0-local')
  .option('--profile <name>', 'profile name')
  .option('--url <url>', 'PayIn API URL')
  .option('--token <token>', 'JWT bearer token')
  .option('--api-key <key>', 'PayIn API key')
  .option('--organization-id <id>', 'Cloud organization id or Open operator organization id for JWT calls')
  .option('--timeout <ms>', 'request timeout in milliseconds', '15000')
  .option('--json', 'print JSON output');

function globalOptions(): GlobalOptions {
  return program.opts<GlobalOptions>();
}


function output(result: any, json = globalOptions().json): void {
  printResult(result, json);
  if (result && result.ok === false) process.exitCode = 1;
}

async function run(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    output({ ok: false, error: error instanceof Error ? error.message : String(error) }, globalOptions().json);
  }
}

function client() {
  return createClient(resolveTarget(globalOptions()));
}

const profile = program.command('profile').description('Manage local PayIn CLI profiles');
profile.command('add <name> <url>').option('--token <token>', 'JWT token').option('--api-key <key>', 'API key').option('--organization-id <id>', 'organization id').description('Add or update a profile').action((name, url, opts) => run(async () => {
  const config = upsertProfile({ name, url, token: opts.token, apiKey: opts.apiKey, organizationId: opts.organizationId });
  const savedProfile = config.profiles[name];
  if (!savedProfile) throw new Error(`Failed to save profile: ${name}`);
  output({ ok: true, data: { currentProfile: config.currentProfile, profile: redactProfile(savedProfile) } }, globalOptions().json);
}));
profile.command('list').description('List profiles').action(() => run(async () => {
  const config = loadConfig();
  output({ ok: true, data: { ...config, profiles: Object.fromEntries(Object.entries(config.profiles).map(([k, v]) => [k, redactProfile(v)])) } }, globalOptions().json);
}));
profile.command('use <name>').description('Set current profile').action((name) => run(async () => output({ ok: true, data: { currentProfile: useProfile(name).currentProfile } }, globalOptions().json)));
profile.command('remove <name>').description('Remove a profile').action((name) => run(async () => output({ ok: true, data: { currentProfile: removeProfile(name).currentProfile } }, globalOptions().json)));

program.command('login').requiredOption('--username <username>', 'operator username').requiredOption('--password <password>', 'operator password').option('--save', 'save returned token to the active profile').description('Login to the selected PayIn runtime').action((opts) => run(async () => {
  const result = await login(client(), opts.username, opts.password);
  if (opts.save && result.ok && result.data && typeof result.data === 'object' && 'token' in result.data) {
    const config = loadConfig();
    const current = globalOptions().profile || config.currentProfile;
    if (!current || !config.profiles[current]) throw new Error('No active profile to save token into. Create one with `payin profile add`.');
    config.profiles[current].token = String((result.data as any).token);
    saveConfig(config);
  }
  output(result, globalOptions().json);
}));
program.command('whoami').description('Show authenticated operator identity').action(() => run(async () => output(await whoami(client()), globalOptions().json)));
program.command('doctor').description('Run PayIn runtime diagnostics').action(() => run(async () => output(await doctor(client()), globalOptions().json)));
program.command('smoke').option('--create-order', 'create a smoke test order').option('--amount <amount>', 'smoke order amount').option('--currency <currency>', 'smoke order currency').option('--chain-id <chainId>', 'smoke order chain id').option('--order-reference <reference>', 'smoke order reference').option('--webhook-id <id>', 'webhook endpoint id to test').option('--require-live', 'fail if live order/webhook checks are skipped').description('Run PayIn smoke/readiness checks').action((opts) => run(async () => output(await smoke(client(), opts), globalOptions().json)));

const apiKey = program.command('api-key').description('Manage API keys');
apiKey.command('list').action(() => run(async () => output(await apiKeyList(client()), globalOptions().json)));
apiKey.command('create').requiredOption('--name <name>', 'API key name').option('--expires-at <iso>', 'expiration timestamp').action((opts) => run(async () => output(await apiKeyCreate(client(), opts.name, opts.expiresAt), globalOptions().json)));
apiKey.command('revoke <id>').action((id) => run(async () => output(await apiKeyRevoke(client(), id), globalOptions().json)));

program.command('chains').description('List supported chains').action(() => run(async () => output(await simpleGet(client(), '/api/chains'), globalOptions().json)));
program.command('tokens').description('List supported tokens').action(() => run(async () => output(await simpleGet(client(), '/api/tokens'), globalOptions().json)));

const addressPool = program.command('address-pool').description('Operate merchant address pool');
addressPool.command('status').option('--protocol <protocol>', 'protocol filter').action((opts) => run(async () => {
  const query = opts.protocol ? `?protocol=${encodeURIComponent(opts.protocol)}` : '';
  output(await simpleGet(client(), `/api/v1/address-pool/availability${query}`), globalOptions().json);
}));
addressPool.command('import <file>').requiredOption('--protocol <protocol>', 'address protocol, e.g. evm').description('Import newline or comma separated addresses').action((file, opts) => run(async () => {
  const addresses = readFileSync(file, 'utf8').split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
  output(await addressPoolImport(client(), opts.protocol, addresses), globalOptions().json);
}));

const webhooks = program.command('webhooks').description('Operate webhook endpoints');
webhooks.command('list').action(() => run(async () => output(await simpleGet(client(), '/api/v1/notifications/endpoints'), globalOptions().json)));
webhooks.command('test <id>').action((id) => run(async () => output(await webhookTest(client(), id), globalOptions().json)));

program.parse();
