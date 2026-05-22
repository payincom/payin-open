# Phase 3 Safe Open Init Upward Report

## Lineage

- Branch/context: `phase3-safe-open-init` from `main`.
- Slice: PayIn Open Phase 3 Slice B safe Open bootstrap/init semantics.
- Scope held to self-hosted PayIn Open bootstrap/init and operator flow; no Cloud/SaaS, broad auth/RBAC/OAuth, or UI scope added.

## Revision Summary

- Open `--force` is now destructive but still Open-safe.
  - `scripts/open/init-plan.ts` always includes `--open-safe`, including when `--force` is explicit.
  - `INIT_DB` is stripped from the child environment for normal and force Open init.
  - Auth force reset uses schema reset without `createDefaultAdmin()`, so it does not create `admin` / `admin123`.
  - First operator bootstrap remains `/auth/register` after normal init and after Open force reset.
- Generic non-force `scripts/init-database.ts` safety hardening is intentionally retained.
  - Non-force `npm run db:init` / `tsx scripts/init-database.ts` is schema-only, non-dropping, and creates no default admin.
  - Generic force remains the legacy destructive branch outside the Open-safe path and may create the historical default admin.
- Added `scripts/init-database-plan.ts` as a pure branch-selection seam.
  - Tests now assert planner behavior for generic non-force, Open force, and generic force instead of relying on source-string checks.
- Resource cleanup was hardened.
  - Auth schema-only initialization now closes `AuthManager` in `finally`, including schema-only error cases.
  - Manager schema-only remains closed in `finally`.

## Changed Files

- `scripts/open/init-plan.ts` — Open invocation always uses `--open-safe`; force remains explicit via `--force`.
- `scripts/open/open-init.ts` — help/dry-run copy describes safe destructive reset semantics.
- `scripts/init-database-plan.ts` — pure init mode planner for Auth/Manager/Processor branch selection.
- `scripts/init-database.ts` — consumes the planner and routes Open-safe force to schema reset without default admin.
- `packages/auth/src/auth-manager.ts` — `initializeSchemaOnly({ dropExisting })` can reset Auth schema without creating users.
- `packages/manager/src/manager.ts` — `initializeSchemaOnly({ dropExisting })` centralizes safe Manager schema/config init.
- `tests/open-ops.test.ts` — behavioral planner/invocation tests replace brittle source-string assertions.
- `docs/self-hosting/*` — docs state no default login, first `/auth/register` operator bootstrap, Open-safe force reset, and generic non-force `db:init` schema-only semantics.

## Fit Check

- Normal `npm run open:init` initializes schemas/default Open merchant scope without dropping data or creating default login.
- `npm run open:init -- --force` remains explicit/destructive but does not create `admin` / `admin123`.
- Production Open force remains blocked unless `--confirm-reset` is supplied.
- Normal and force Open init preserve first-operator bootstrap through `/auth/register`.
- Generic non-force `db:init` is explicitly schema-only/non-dropping/no-default-admin in docs and tests.
- Generic force legacy behavior is isolated outside the Open-safe wrapper.

## Validation

- `npm test -- tests/open-ops.test.ts` — pass, 17 tests.
- `npm run type-check` — pass.
- `npm run boundary:check` — pass.
- `git diff --check` — pass.
- `npx tsx scripts/open/open-init.ts --help` and `npx tsx scripts/open/open-init.ts --dry-run --force` — pass; emitted existing optional `bigint` pure-JS warning.
- No live PostgreSQL target was provided, so destructive/non-destructive DB behavior is covered by pure planner tests and code review rather than disposable-DB integration.

## Residual Risks

- Generic `npm run db:init:force` / `tsx scripts/init-database.ts --force` still uses the legacy Auth aggressive branch and can create `admin` / `admin123`; docs now identify this as outside the Open-safe path.
- Runtime scripts still import workspace packages through package exports, so environments should continue following build-before-production-init guidance.
