# Agent handoff — PayIn Open overlay-readiness

Date: 2026-05-19  
Repository: `payincom/payin-open`  
Working tree at handoff: `main`, to be pushed after final checks

## Mission context

JQ's non-negotiable target is to split the old production Cloud codebase into:

- **PayIn Open**: complete, free, self-hostable, single-tenant merchant payment product.
- **PayIn Cloud overlay**: future private overlay that composes/extends Open through ports, app composition, route factories, and providers.

Cloud must not become the primary code path, a fork, or a duplicate implementation of Open core. If Cloud needs behavior and Open lacks a seam, improve Open first.

Repository roles:

- `payin-open`: current implementation mainline and base core.
- old `payin`: read-only production Cloud reference/copy source unless JQ explicitly authorizes changes.
- `payin-cloud-layer`: spike/archive/manual-test reference only.
- future `payin-cloud-overlay`: create only after Open exposes stable composition seams.

## What is implemented in this handoff batch

### 1. RuntimeContext / PaymentScope route seam migration

Business API routes now resolve a neutral runtime context at the route boundary and call manager/auth/notification seams that accept runtime scope rather than passing Cloud-shaped organization ids directly from route handlers.

Converted route groups:

- `apps/api/src/routes/orders.ts`
- `apps/api/src/routes/payment-links.ts`
- `apps/api/src/routes/deposits.ts`
- `apps/api/src/routes/address-pool.ts`
- `apps/api/src/routes/transfers.ts`
- `apps/api/src/routes/api-keys.ts`
- `apps/api/src/routes/notifications.ts`

Key context files:

- `packages/processor/src/context/payment-scope.ts`
- `packages/processor/src/context/runtime-context.ts`
- `apps/api/src/open-runtime.ts`

Important detail: existing database columns and lower storage layers still use `organization_id` for compatibility. The new rule is that conversion to legacy organization id should live inside compatibility seams/services/repositories, not in business route code.

### 2. Manager/auth/notification runtime-scope seams

Added or expanded `*ForRuntimeScope` seams so business routes can pass `RuntimeContext`/`PaymentScope` down without embedding tenant conversion logic in route handlers.

Notable changed areas:

- `packages/manager/src/manager.ts`
- `packages/manager/src/open/open-manager.ts`
- `packages/auth/src/auth-manager.ts`
- `packages/notification/src/notification-service.ts`
- `packages/notification/src/repository/notification.repository.ts`
- `packages/processor/src/open/open-processor.ts`

### 3. App composition first slice

`apps/api/src/server.ts` now exposes `CreateAppOptions` / `createApp(options)` so a future overlay can customize infrastructure and extend routes without copying the default Open app.

Current composition hooks:

- override `getManager`
- override `cloudOnlyRouteGuard`
- `extendPublicRoutes(app)`
- `extendApiRoutes(api)`

### 4. Route-factory first slice

`apps/api/src/routes/api-keys.ts` is the first converted route factory.

It now exports:

- `ApiKeysRouteDependencies`
- `createApiKeysRoutes(deps)`
- a default route export preserving current Open behavior

The factory accepts injected auth manager access, middleware factories, runtime-context resolution, and org-context error messaging. This proves the intended pattern for converting the rest of the route groups.

### 5. Documentation updated

Updated architecture/status docs:

- `docs/open-cloud-coupling-audit.md`
- `docs/open-cloud-execution-plan.md`
- `docs/open-overlay-seams-plan.md`

This handoff file is the operational entry point for the next agent.

## Test and quality evidence

Final checks run before commit/push:

- `npx prettier --write docs/agent-handoff-2026-05-19.md`: passed.
- `npm run type-check`: passed.
- `npm run boundary:check`: passed (`PayIn Open boundary check passed.`).
- `git diff --check`: passed.
- Runtime-context targeted route/service suite: 11 files / 114 tests passed:

```bash
npm test -- \
  apps/api/tests/open-runtime.test.ts \
  apps/api/tests/orders-runtime-context.test.ts \
  apps/api/tests/payment-links-runtime-context.test.ts \
  apps/api/tests/deposits-runtime-context.test.ts \
  apps/api/tests/address-pool-runtime-context.test.ts \
  apps/api/tests/transfers-runtime-context.test.ts \
  apps/api/tests/api-keys-runtime-context.test.ts \
  apps/api/tests/notifications-runtime-context.test.ts \
  packages/processor/tests/unit/runtime-context.test.ts \
  packages/manager/tests/unit/order-runtime-scope.test.ts \
  packages/notification/tests/runtime-scope.test.ts
```

- Auth API-key runtime-scope unit test: 1 file / 4 tests passed:

```bash
npm test -- packages/auth/tests/unit/api-key-runtime-scope.test.ts
```

## Current status by phase

### Phase 1 — RuntimeContext / PaymentScope

Status: route-seam slice substantially complete.

- Business routes no longer own legacy org-id conversion.
- Compatibility id conversion remains allowed in lower seams/storage adapters.
- Open public model remains single-tenant/self-hosted.

Remaining Phase 1 hardening:

- Promote RuntimeContext/PaymentScope deeper into manager and processor service/facade methods where practical.
- Keep repository `organization_id` persistence unchanged until repository ports exist.
- Add/keep tests that prove Open callers do not need `X-Organization-ID` for single-tenant business operations.

### Phase 2 — app and route composition

Status: started.

- `createApp(options)` exists.
- `api-keys` route factory exists as the first proof-of-pattern.

Remaining Phase 2 work:

1. Convert remaining built-in business route modules into route factories with injected dependencies:
   - `orders`
   - `payment-links`
   - `deposits`
   - `address-pool`
   - `transfers`
   - `notifications`
2. Avoid copying route logic into Cloud. Cloud should be able to compose these factories later.
3. Introduce policy/entitlement and event/usage sink ports only as Open-owned ports with allow-all/no-op defaults.

### Phase 3 — Open self-hosted runtime profile

Status: not complete.

Needed:

- Explicit local setup/admin/operator semantics.
- Local config profile review.
- Ensure Open UI/API/docs hide hosted organization/member/billing/superadmin concepts as product features.
- Ensure no unsafe default production admin behavior.

### Phase 4 — overlay readiness hardening

Status: not complete.

Needed:

- Auth/config/notification/repository/storage interfaces where Cloud truly needs replacement.
- Event envelope with payment scope, actor, request id, source, idempotency key.
- Boundary tests that prevent Cloud dependencies or Cloud-only concerns from entering Open core.

### Phase 5 — Cloud overlay repo

Status: do not start yet.

Create `payin-cloud-overlay` only after Phases 1–4 exit criteria pass.

## Next recommended task for the receiving agent

Start with a narrow Phase 2 route-factory slice.

Recommended next slice: convert `apps/api/src/routes/notifications.ts` into `createNotificationsRoutes(deps)` because it already has runtime-scope service seams and is a Cloud-relevant extension point for audit/metering/SLA behavior.

Acceptance criteria:

- Preserve existing default route export and Open behavior.
- Inject manager/notification/auth/audit/runtime dependencies through a typed dependency object.
- Add or update a composition test proving injected dependencies are used without copying route logic.
- Run targeted route test, typecheck, boundary check, and `git diff --check`.

Alternative next slice: `orders.ts`, if the next agent wants to tackle the highest-value core path first. Keep the slice small; do not combine with policy/event ports in the same change unless necessary.

## Guardrails for the next agent

- Do not modify old `/data/openclaw/workspace/payin` unless JQ explicitly authorizes it.
- Do not treat `payin-cloud-layer` as production base.
- Do not add billing/plan/SaaS checks directly into Open business logic.
- Do not duplicate Open core behavior in a Cloud layer.
- Do not expose organizations/members/billing/superadmin as Open product features.
- Preserve Open as complete/free/self-hostable.
- Prefer small vertical slices with tests and documentation updates.

## Quick orientation commands

```bash
cd /data/openclaw/workspace/payin-open
git status --short --branch
git diff --stat
npm run boundary:check
npm run type-check
```
