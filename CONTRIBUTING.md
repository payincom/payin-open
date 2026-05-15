# Contributing to PayIn Open

PayIn Open is the public upstream for PayIn's open-source stablecoin payment gateway.

## Where to make changes

- General core features, documentation, and bug fixes should be proposed here.
- Commercial cloud operations, enterprise-only modules, customer-specific integrations, and private production configuration belong in the private PayIn repository.

When in doubt, split the work:

1. Put reusable open-core changes in PayIn Open.
2. Put private extensions in the downstream private repository.

See [`docs/open-source-maintenance.md`](docs/open-source-maintenance.md) for the full maintenance model.

## Development checks

Install dependencies:

```bash
npm install
```

Build all packages and apps:

```bash
npm run build
```

Run focused unit tests that do not require a live database or local API server:

```bash
npx vitest run packages/notification/tests packages/email/tests packages/monitor/tests/rpc-config.test.ts apps/api/tests/url-generation.test.ts apps/api/tests/api-url-fields.test.ts
```

The full `npm run test` suite includes integration/e2e tests that require a configured PostgreSQL database and, for some suites, a running API server.

## Commit style

Use focused commits with Conventional Commit-style subjects when possible, for example:

```text
fix(monitor): handle public RPC fallback
feat(api): add webhook retry status endpoint
docs: clarify sandbox deployment
```
