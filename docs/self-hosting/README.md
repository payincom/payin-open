# Self-hosting PayIn Open

This directory contains public self-hosting notes for PayIn Open operators.

PayIn Open is intended for merchants and teams who want to deploy and operate their own stablecoin payment gateway. These docs should stay provider-neutral where possible and should avoid private PayIn Cloud operational details.

PayIn Open is headless and Agent-operated by default. It does not ship a bundled admin UI; operate it through the Open Agent commands, Skills, APIs, configuration files, and deployment automation documented here.

## Start Here

1. [Getting started](./getting-started.md)
2. [Agent operations runbook](./agent-operations.md)
3. [Configuration](./configuration.md)
4. [Database initialization](./database-initialization.md)
5. [Environment separation](./environments.md)
6. [Chain configuration](./chains.md)
7. [Troubleshooting](./troubleshooting.md)

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

`open:init -- --check` and `open:smoke` without `--url` are safe in CI and local repository audits: they do not mutate a database or call external payment networks. `open:smoke -- --url` checks public API health/config. Add `--api-key` or `--token`, `--create-order`, and `--webhook-id` in sandbox/testnet to verify monitor-backed chain status, order creation, payment page rendering, public order status, and webhook delivery before production/mainnet.

## Documentation Rules

- Use placeholders for domains, secrets, database URLs, and RPC keys.
- Prefer general Docker/Node/PostgreSQL guidance over provider-specific production runbooks.
- If a provider example is useful, mark it clearly as an example, not as the only supported path.
- Do not include PayIn Cloud production procedures, Railway project IDs, or customer-specific steps.
