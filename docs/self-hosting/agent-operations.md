# Agent Operations Runbook

This runbook defines the PayIn Open command sequence an AI Agent or operator should use to deploy, verify, and operate a self-hosted merchant environment.

PayIn Open is headless by default. It intentionally does not include a bundled admin UI; if a lightweight console is needed later, it should be added as an optional Open-specific surface instead of reusing Cloud's multi-tenant admin dashboard.

The commands below are designed to keep PayIn Open merchant-first: operators should not need to understand Cloud tenants or organizations. Internal compatibility concepts such as the default Open merchant scope are checked automatically.

PayIn also has an external operator CLI (`payin`) maintained at https://github.com/payincom/payin-cli. The CLI is an operations client for already-running PayIn Open or PayIn Cloud runtimes; it is not an installer or infrastructure deployment tool. Use deployment docs/templates for installation, then use the CLI for diagnostics, smoke checks, API keys, address pools, webhooks, and troubleshooting. Until npm publication, run it from GitHub with `npm exec --yes --package github:payincom/payin-cli -- payin ...`.

In Open runtime, hosted multi-tenant administration routes such as `/api/v1/organizations` and `/api/v1/config-management` are intentionally hidden. Use the Open single-merchant API plus the Agent/operator commands below instead.

API keys remain available for merchant integrations in Open runtime, but they are scoped automatically to the Open default merchant. Operators should not pass or choose an organization id.

## Safety Model

| Command | Default behavior | Mutates DB? | Calls live API? | Intended use |
| --- | --- | ---: | ---: | --- |
| `npm run open:doctor` | Local/readiness warnings | No | No, unless `--url` | Fast diagnostic |
| `npm run open:init -- --check` | Preflight + optional read-only DB check | No | No | DB bootstrap readiness |
| `npm run open:init -- --dry-run` | Shows bootstrap plan | No | No | Change preview |
| `npm run open:init` | Initializes schemas and default Open merchant scope | Yes | No | Initial bootstrap |
| `npm run open:smoke` | Dry-run smoke checklist | No | No | CI-safe smoke contract |
| `npm run open:smoke -- --url <api-url>` | Public live health/config checks | No | Yes | Deployed API sanity check |
| `npm run open:smoke -- --require-live ...` | Full live readiness gate | Creates test order | Yes | Sandbox/release gate |

Never print secrets. Use placeholders such as `<redacted>` in chat, logs, and summaries.

## 0. Operator CLI

Use the CLI when a runtime URL exists:

```bash
npm exec --yes --package github:payincom/payin-cli -- payin profile add sandbox <sandbox-api-url>
npm exec --yes --package github:payincom/payin-cli -- payin doctor --profile sandbox --json
npm exec --yes --package github:payincom/payin-cli -- payin smoke --profile sandbox --api-key *** --create-order --webhook-id <sandbox-webhook-id> --require-live --json
npm exec --yes --package github:payincom/payin-cli -- payin api-key create --profile sandbox --name backend-orders-service --json
npm exec --yes --package github:payincom/payin-cli -- payin address-pool status --profile sandbox --json
npm exec --yes --package github:payincom/payin-cli -- payin webhooks test --profile sandbox <webhook-id> --json
```

The CLI stores local profiles under the user config directory and redacts credentials in normal output. It can target Open or Cloud; Cloud operations may require organization context.

## 1. Readiness: `open:doctor`

Use `open:doctor` before initialization or deployment changes.

```bash
# CI/local safe baseline
npm run open:doctor
npm run open:doctor -- --json

# Deployment-grade diagnostic
npm run open:doctor -- --strict --json --url <api-url> --api-key <redacted>
```

Checks include:

- Runtime posture: Open single-tenant self-hosted profile, default local merchant scope, API-key scoping, JWT operator caveat, and production admin posture.
- Open runtime detection.
- Required repository files, self-hosting docs, and PayIn Open skill presence.
- DB connection string presence with password redaction.
- Optional live DB checks when `DB_CONNECTION_STRING` is configured:
  - database reachability;
  - processor schema completeness;
  - PayIn Open default merchant scope presence.
- Optional live API checks when `--url` is provided:
  - `/health`;
  - `/api/chains`;
  - `/api/tokens`;
  - `/api/v1/chains` when `--api-key` or `--token` is provided.

In non-strict mode, missing DB/API settings are warnings. In `--strict`, missing or failed deployment-critical checks block the command.

## 2. Database Bootstrap: `open:init`

Use `open:init` to prepare the database. Prefer check/dry-run modes before any write.

```bash
# Non-mutating preflight
npm run open:init -- --check --json
npm run open:init -- --check --strict --json

# Non-mutating plan preview
npm run open:init -- --dry-run --json

# Actual bootstrap: creates schemas and ensures the default Open merchant scope
npm run open:init

# Development/demo only
npm run open:init -- --demo-data
```

Destructive reset is guarded and should not be used in production without explicit human approval:

```bash
npm run open:init -- --force --confirm-reset
```

`open:init -- --check` performs real read-only DB checks when `DB_CONNECTION_STRING` is configured. If the DB is missing schema tables or the default Open merchant scope, run `npm run open:init` against the confirmed target database.

## 3. Runtime Smoke: `open:smoke`

Use `open:smoke` after the API is running.

```bash
# Safe dry-run checklist
npm run open:smoke
npm run open:smoke -- --json

# Public live checks only
npm run open:smoke -- --url <api-url> --json

# Full sandbox live smoke gate
npm run open:smoke -- \
  --url <api-url> \
  --api-key <redacted> \
  --create-order \
  --order-reference <unique-smoke-id> \
  --webhook-id <sandbox-webhook-id> \
  --require-live \
  --json
```

Full live smoke verifies:

1. `/health`.
2. `/api/chains`.
3. `/api/tokens`.
4. Authenticated `/api/v1/chains` monitor/chain readiness.
5. Test order creation through `/api/v1/orders`.
6. Public payment page rendering through `/pay/order/:orderId`.
7. Public order status through `/api/order-status/:orderId`.
8. Webhook test delivery through `/api/v1/notifications/endpoints/:id/test`.

Use `--require-live` for sandbox/release gates so missing credentials, skipped order creation, or skipped webhook delivery fail the command instead of becoming warnings.

## 4. Recommended Pipelines

### Local or CI-safe repository gate

```bash
npm run open:doctor -- --json
npm run open:init -- --check --json
npm run open:smoke -- --json
npm run open:verify
```

This sequence avoids database mutation and live side effects unless environment variables or URLs are explicitly provided.

### Sandbox deployment gate

```bash
npm run open:doctor -- --strict --json --url <sandbox-api-url> --api-key <redacted>
npm run open:init -- --check --strict --json
npm run open:smoke -- \
  --url <sandbox-api-url> \
  --api-key <redacted> \
  --create-order \
  --order-reference <unique-smoke-id> \
  --webhook-id <sandbox-webhook-id> \
  --require-live \
  --json
```

Only promote to production/mainnet after sandbox order creation, payment page rendering, monitor readiness, and webhook delivery have been verified.

### Production readiness pre-check

Before touching production/mainnet, confirm:

- Separate production database is configured.
- Sandbox flow has passed end to end.
- Secrets are stored in the hosting provider or secret manager, not committed.
- No default production admin promotion is expected; production access starts from the first local operator/bootstrap flow only.
- `open:doctor -- --strict --url <production-api-url> --api-key <redacted>` passes.
- A human explicitly approves production writes or mainnet operations.
