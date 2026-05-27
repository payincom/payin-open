# Self-hosting PayIn Open

This directory contains public self-hosting notes for PayIn Open operators.

PayIn Open is intended for merchants and teams who want to deploy and operate their own stablecoin payment gateway. These docs are Docker-first and provider-neutral where possible, with provider pages only as examples. They should avoid private PayIn Cloud operational details.

PayIn Open is headless and Agent-operated by default. It does not ship a bundled admin UI; operate it through the Open Agent commands, Skills, APIs, configuration files, and deployment automation documented here.

## Start Here

1. [Getting started](./getting-started.md)
2. [Agent operations runbook](./agent-operations.md)
3. [Configuration](./configuration.md)
4. [Database initialization](./database-initialization.md)
5. [Environment separation](./environments.md)
6. [Railway sandbox example](./railway.md)
7. [Chain configuration](./chains.md)
8. [Troubleshooting](./troubleshooting.md)

## Universal Container Deployment Phases

Use this model on any Docker/container-capable provider:

1. Provision PostgreSQL with a connection string reachable from containers on the provider's private network.
2. Build/deploy the repository `Dockerfile` as the API image and set `PAYIN_RUNTIME=open`, `NODE_ENV`, `DB_CONNECTION_STRING`, `JWT_SECRET`, `WEBHOOK_SECRET`, and optional sandbox/testnet RPC keys.
3. Run diagnostics and database init as an explicit one-off job/task using the same API image, env, and private network: `npm run open:doctor`, `npm run open:init -- --check`, `npm run open:init`, then `npm run open:init -- --check --strict`.
4. Start or restart the long-running API container with the default command, `node apps/api/dist/index.js`.
5. Expose HTTPS, set `BASE_URL`, then verify process health and readiness.

Do not run init from a laptop if the database hostname is provider-private. Do not use legacy `INIT_DB` or `DEMO_DATA` startup hooks; initialization should be an intentional operator step.

## Readiness Checks

- `/health` checks only that the API process responds; it can pass before schema/config initialization is complete.
- `/api/chains`, `/api/tokens`, and `open:smoke -- --url` are the readiness/config checks to run after `open:init` succeeds.
- Live order/deposit smoke tests require the first operator, an API key, and address-pool capacity; keep API keys redacted in logs.

## Agent-operated Open checklist

For the full command matrix, strict/live behavior, and recommended CI/sandbox/production gates, see [Agent operations runbook](./agent-operations.md).

PayIn Open includes repository-local commands that an AI Agent or operator can run without understanding Cloud tenant concepts:

```bash
# Non-mutating readiness check: runtime, required files, DB/env warnings
npm run open:doctor

# Non-mutating initialization preflight
npm run open:init -- --check

# Initialize the Open database when DB_CONNECTION_STRING is configured
npm run open:init

# Dry-run smoke checklist; pass --url for live public checks
npm run open:smoke
npm run open:smoke -- --url http://localhost:3000

# Full live sandbox smoke: public health/config, monitor status, test order,
# payment page render, public order status, and webhook test delivery
npm run open:smoke -- --url http://localhost:3000 --api-key <redacted> --create-order --webhook-id <sandbox-webhook-id>

# Full Open verification gate
npm run open:verify
```

`open:init -- --check` and `open:smoke` without `--url` are safe in CI and local repository audits: they do not mutate a database or call external payment networks. For container providers, run `open:doctor` and `open:init` in a one-off job/task using the deployed API image and private network. If a provider cannot run a one-off task, use the provider's shell/SSH into the service as a fallback. `open:smoke -- --url` checks public API health/config. Add `--api-key` or `--token`, `--create-order`, and `--webhook-id` in sandbox/testnet to verify monitor-backed chain status, order creation, payment page rendering, public order status, and webhook delivery before production/mainnet.

## Documentation Rules

- Use placeholders for domains, secrets, database URLs, and RPC keys.
- Prefer Docker/Node/PostgreSQL guidance over provider-specific production runbooks.
- If a provider example is useful, mark it clearly as an example, not as the only supported path.
- Document one-off job/task initialization before provider shell/SSH fallbacks.
- Do not include PayIn Cloud production procedures, Railway project IDs, or customer-specific steps.
