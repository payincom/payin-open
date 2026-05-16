# PayIn Open / PayIn Cloud Boundary Plan

This document defines the target boundary for the current PayIn development phase: split PayIn Open and PayIn Cloud into clearly bounded projects with lower coupling and a maintainable path for future development.

## Product Targets

### PayIn Open

PayIn Open is the self-hosted stablecoin payment gateway for a merchant's own ecommerce, SaaS, marketplace, or internal platform.

Target properties:

- independently deployable by a merchant or their AI agent;
- single-merchant / single-operator by default;
- non-custodial: funds settle to merchant-controlled destinations;
- API-first and Skill-operated;
- simple UI is optional, not a core dependency;
- no PayIn Cloud hosted-service operations or production credentials;
- reusable payment core that PayIn Cloud can consume downstream.

### PayIn Cloud

PayIn Cloud is PayIn's hosted stablecoin payment service.

Target properties:

- PayIn-operated hosted infrastructure;
- multi-tenant SaaS model;
- merchant accounts, organizations, roles, API keys, and hosted onboarding;
- sandbox and production environments operated by PayIn;
- production monitoring, incident response, customer support, and commercial controls;
- downstream consumer of reusable PayIn Open core improvements.

## Boundary Rules

| Area | PayIn Open | PayIn Cloud |
| --- | --- | --- |
| Deployment model | Merchant self-hosted | PayIn hosted |
| Tenancy model | Single merchant by default | Multi-tenant organizations |
| Operations | Merchant / AI Agent operated | PayIn operated |
| UI | Optional lightweight console | Full merchant/admin dashboard |
| Configuration | Local env/file/db config with placeholders | PayIn sandbox/production config |
| Domains | `your-payin.example.com` placeholders | `payin.com` hosted domains |
| Secrets | Never committed; merchant-owned | Never committed; stored in hosted envs |
| Docs | Self-hosting, architecture, agent ops | Cloud ops, runbooks, customer operations |
| Agent skill | `skills/payin-open` | `skills/payin-cloud` |

## Confirmed Code Facts

### Monitor is a good shared core module

`packages/monitor` is relatively independent. It mainly depends on shared utilities and blockchain SDKs. Its job is to detect chain activity and emit transfer events.

It should not know about:

- organizations;
- tenants;
- merchant accounts;
- API keys;
- payment links;
- webhooks;
- billing;
- hosted environments.

Target role:

```text
@payin/monitor = chain event detector / transfer scanner
```

### Processor is currently tenant-coupled

`packages/processor` currently knows about many business and multi-tenant concepts:

- `organizationId` / `organization_id`;
- `address_pool`;
- orders and deposits database tables;
- payment links;
- manager/config integration;
- recovery across organizations;
- organization-scoped address and deposit APIs.

This is acceptable for the current working system, but it is not the desired long-term Open boundary. PayIn Open should hide or remove multi-tenant complexity; PayIn Cloud should keep it.

## UI Strategy

PayIn Open should be headless-first:

1. API endpoints for application integration.
2. `skills/payin-open` for AI-agent setup, operation, diagnosis, and maintenance.
3. CLI/scripts for local administration.
4. Optional lightweight Open Console only if it remains single-merchant and does not reuse Cloud-only SaaS concepts.

The Open Console, if retained, should focus on:

- health and status;
- chain/RPC status;
- recent orders and deposits;
- webhook delivery logs;
- address pool status;
- local configuration visibility.

It should not include:

- organization switching;
- team management;
- Cloud billing;
- PayIn-hosted onboarding;
- Cloud incident/runbook workflows;
- multi-tenant merchant administration.

## Target Architecture

### Shared Open Core

Reusable by both Open and Cloud:

```text
packages/shared
packages/monitor
packages/processor-core      # target extraction
packages/payment-domain      # target extraction
packages/webhook-core        # target extraction
```

### PayIn Open Runtime

Self-hosted runtime:

```text
apps/api-open                # target or compatibility wrapper
skills/payin-open
docs/self-hosting
docker-compose.yml
deploy/templates/*
```

Open may temporarily use current `apps/api`, `packages/processor`, `packages/manager`, and `packages/auth`, but the public surface should be single-merchant and self-host oriented.

### PayIn Cloud Runtime

Private hosted runtime:

```text
apps/api-cloud               # target or compatibility wrapper
apps/admin-cloud
packages/cloud-auth
packages/cloud-manager
docs/cloud-ops
skills/payin-cloud
```

Cloud may keep multi-tenant organization, role, API key, sandbox, production, onboarding, and hosted ops logic.

## Test-Driven Development Goals

Development in this phase should be guided by explicit boundary tests.

### Open independence tests

PayIn Open must pass:

```bash
npm run boundary:check
npm run type-check
npm run build
npm run test:unit
npm run build -w apps/docs
```

### Boundary checks

`npm run boundary:check` should prevent accidental re-coupling by failing when Open source/config files contain:

- PayIn Cloud production domains in runtime templates;
- private Railway project IDs;
- PayIn Cloud-only operation wording in self-hosting docs;
- PayIn Go internal material;
- `payin-cloud` repository references outside allowed explanatory docs.

### Future Processor decoupling tests

Before deeper Processor refactoring, add tests that describe the desired behavior:

1. Processor can run in single-merchant mode with a default merchant/organization context.
2. Open API operations do not require callers to understand `organizationId`.
3. Cloud adapter can still pass explicit organization context.
4. Monitor events are mapped to payment context by an adapter, not by Monitor itself.
5. Address pool and deposit APIs can operate through a single-merchant facade.

## Phase Plan

### Phase 1 — Boundary hardening without major refactor

- Add this architecture document.
- Add automated Open boundary checks.
- Remove PayIn Cloud hosted domains from PayIn Open runtime templates.
- Make Railway deployment templates generic self-hosting templates.
- Clarify README: Open is headless-first and Skill-operated; UI is optional.
- Add CI proving Open builds/tests independently.

### Phase 2 — Open single-merchant facade

- Add an Open runtime facade that hides organization/multi-tenant concepts.
- Create default merchant/organization during setup.
- Ensure API/Skill flows use self-hosting language and do not require tenant management.
- Add smoke tests for the self-hosted lifecycle.

### Phase 3 — Processor tenancy decoupling

- Separate processor domain logic from tenant persistence/adapters.
- Introduce single-merchant and multi-tenant adapters.
- Keep PayIn Cloud multi-tenant behavior intact.
- Use tests to prove Open and Cloud both pass their respective flows.

### Phase 4 — Optional Open Console decision

- Audit `apps/admin` coupling.
- Either create a lightweight Open Console or keep Open headless-first.
- Do not let Cloud Admin become required for Open operation.

## Stop Condition for This Development Phase

This phase is complete when:

- PayIn Open can be cloned, configured, built, tested, and operated without PayIn Cloud hosted assumptions;
- PayIn Cloud remains the private multi-tenant hosted downstream service;
- reusable improvements have a clear Open-first path;
- Cloud-only operations no longer leak into Open;
- boundary checks and CI protect the split going forward;
- Processor tenancy coupling is either removed or wrapped behind a documented single-merchant facade with tests.
