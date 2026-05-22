# PayIn Open / Cloud Overlay Execution Plan

Status: approved by JQ on 2026-05-17; refreshed after Phase 4 completion through PR #18 on 2026-05-22.

## Strategic decision

Use the current `payin-open` repository as the Open/base-core mainline. Do not create a new Open repository and do not create the final private Cloud overlay repository yet.

Repository roles:

- `payin-open`: main implementation target. It must become a complete, free, self-hostable single-tenant Open product and an overlay-ready base core.
- old `payin`: read-only production Cloud reference and copy source unless JQ explicitly authorizes changes.
- `payin-cloud-layer`: spike/archive/manual-test reference only, not a production base.
- future `payin-cloud-overlay`: create only after `payin-open` exposes stable seams and can be composed without fork/copy.

## Non-negotiable architecture principles

1. Open is the base product/core, not a crippled Cloud edition.
2. Cloud is an overlay/extension that composes Open through ports and route/runtime composition.
3. Cloud must not fork, patch, copy, or reimplement Open payment core.
4. Open must remain complete, free, self-hostable, and usable by merchants/AI agents without Cloud.
5. Open public model is single-tenant. Internally it may use a hidden/default tenant/workspace for compatibility.
6. Cloud-only concerns must stay out of Open core: multi-tenancy, organization/member/role SaaS management, Cloud auth/API-key policy, billing/subscription/entitlements, usage metering, audit trail, hosted runtime config, hosted ops/SLA/monitoring, support/risk/admin controls, and Cloud Admin UI.
7. If Cloud needs behavior and Open lacks the seam, improve Open first; do not duplicate Open core in Cloud.

## Current target architecture

`payin-open` now exposes these Open-owned seams:

- `RuntimeContext` / `PaymentScope`: neutral request/payment ownership scope.
- `SingleTenantContextProvider`: Open implementation that injects the default local workspace/tenant.
- `createApp(options)`: Open app composition with route factories/dependencies, infrastructure/guard overrides, and extension hooks.
- Business route factories: `api-keys`, `orders`, `payment-links`, `deposits`, `address-pool`, `transfers`, and `notifications`.
- Order-create policy/event seam: allow-all Open policy and no-op/best-effort event sink for `POST /api/v1/orders`.
- Payment-link policy/event seam: allow-all Open policy and no-op/best-effort event sink for create/update/publish operations.
- Notification policy/event seam: allow-all Open policy and no-op/best-effort event sink for endpoint create/test and notification retry operations.
- Notification delivery factory seam: webhook-only Open default plus injectable `NotificationNotifierFactory` for delivery construction.

Still future and only if concretely needed:

- Additional neutral policy/event seams for specific route operations, only if concretely needed.
- Auth/config/storage provider interfaces beyond current route-level injection; notification delivery construction already has a bounded factory seam.
- Repository extraction, migrations, or private Cloud overlay code.

## Phased execution

### Phase 0 — lock target and safety baseline

Status: complete.

- Target architecture and seam plan docs exist.
- Boundary/type/test baselines have been recorded in RATP reports.
- Docs state Open/Cloud ownership and anti-patterns.

### Phase 1 — RuntimeContext / PaymentScope

Status: merged and substantially complete at route seams.

- Business API route groups resolve `RuntimeContext` and call `*ForRuntimeScope` seams for orders, payment links, deposits, address pool, transfers, API keys, and notifications.
- Route-level legacy org-id conversion was removed from business routes; compatibility mapping remains in lower seams/storage layers.
- Open routes do not require merchant-facing `X-Organization-ID` for single-tenant business use.

Remaining hardening should be targeted service/facade cleanup only, not broad storage redesign.

### Phase 2 — app and route composition

Status: merged in PR #7.

- `createApp(options)` supports route factory overrides and typed route dependency injection.
- Built-in business route modules are dependency-aware factories with default Open exports.
- Future overlays can compose Open routes with `createApp({ routeDependencies, routeFactories, extendApiRoutes })` without copying route logic.

Phase 2 exit criteria are met for route/app composition. Lower service/repository extraction remains outside Phase 2.

### Phase 2.5 — first policy/event seam

Status: merged in PR #8.

- `POST /api/v1/orders` has an Open-owned order-create policy/event seam.
- Default Open policy allows all requests.
- Default Open event sink is no-op; injected sinks are best-effort after successful order creation.
- Deny policy, event emission, throwing-sink best-effort behavior, type-check, boundary check, and diff hygiene were validated in RATP reports.

This is a seam only. It is not a Cloud entitlement, billing, plan, subscription, usage-metering, admin, migration, or overlay implementation.

### Phase 3 — Open self-hosted runtime profile

Status: complete in PR #15 (`d1fe87f`).

Deliverables:

- Explicit local setup/admin/operator semantics are documented.
- Local API-key/auth semantics are suitable for self-hosting.
- Open admin/UI/profile hides org/member/role/billing/superadmin SaaS concepts.
- Local config profile is clear and self-hostable.
- No unsafe default production admin behavior.

### Phase 4 — overlay readiness hardening

Status: complete through PR #18 (`1d0d432`).

Completed bounded deliverables:

- Neutral policy/event ports exist for the concrete operations identified so far: order create, payment-link create/update/publish, and notification endpoint create/test/retry.
- Notification delivery construction has a bounded `NotificationNotifierFactory` seam while Open defaults remain webhook-only.
- Tests cover default Open behavior, injected seams, best-effort/no-op behavior, and no Cloud dependency leakage.
- Architecture/status docs identify exact overlay extension points and guardrails.

Do not treat Phase 4 completion as permission for broad Cloud/SaaS implementation.

### Phase 5 — create private Cloud overlay repo

Status: do not start yet.

Only after Phases 1–4 exit criteria pass and the human explicitly approves:

- Create private `payin-cloud-overlay` repo.
- Implement Cloud-specific organization context, SaaS auth/API keys, member/role, billing/subscription/entitlements, usage metering, audit, hosted config, hosted ops/admin UI.
- Compose `payin-open`; do not copy or fork Open core.

## Immediate implementation queue

Phase 4 is complete. The next implementation queue is Phase 5 only after explicit human approval.

1. Do not create the private Cloud overlay repo until explicitly approved.
2. If a future overlay need exposes a missing Open seam, improve Open first through a separately scoped bounded PR.
3. Keep Open defaults allow-all/no-op for future bounded seams and preserve existing behavior.
4. Do not start Cloud billing/subscription/plan/entitlement/member/role/admin implementation in Open without moving to the approved Phase 5 overlay scope.

## Quality control checklist

For every implementation step:

- No modifications to old `payin` unless explicitly authorized.
- No Cloud-only concepts added to Open public model.
- No billing/subscription/plan/admin/migration/repository-extraction scope creep.
- No fork/copy of core payment behavior.
- Existing self-host docs and boundary checks remain valid or are updated intentionally.
- Tests/build/lint/boundary checks are run only at the scoped level needed for the change and results are recorded.
