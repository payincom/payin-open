# PayIn Open / Cloud Overlay Execution Plan

Status: approved by JQ on 2026-05-17.

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
7. If Cloud needs a behavior and Open lacks the seam, improve Open first; do not duplicate Open core in Cloud.

## Target architecture

`payin-open` should expose an Open runtime and composable app surface:

- `RuntimeContext` / `PaymentScope`: neutral request/payment ownership scope.
- `SingleTenantContextProvider`: Open implementation that injects the default local workspace/tenant.
- `AuthProvider` / `AuthPort`: Open local auth now, Cloud SaaS auth later.
- `ConfigProvider`: Open local config now, Cloud global + organization override later.
- `NotificationPort`: Open local webhook/notification now, Cloud org-scoped notification later.
- `EntitlementPort`: Open allow-all/free default now, Cloud billing/subscription/usage implementation later.
- `RouteModule` / app composition: Open core routes can be mounted by `createOpenApp(deps)`; Cloud can add routes later without forking core routes.

## Phased execution

### Phase 0 — lock target and safety baseline

Deliverables:

- Target architecture and seam plan docs.
- Existing behavior inventory for order, deposit, transfer, payment link, checkout, config, notification, API auth.
- Baseline checks recorded: boundary check, typecheck/build/test where available.

Exit criteria:

- Docs clearly state Open/Cloud ownership and anti-patterns.
- Current test/build/boundary baseline known.

### Phase 1 — RuntimeContext / PaymentScope

Deliverables:

- Add typed `RuntimeContext` / `PaymentScope` concepts in Open core/shared layer.
- Add Open `SingleTenantContextProvider` with stable default local tenant/workspace id.
- Replace ad hoc bare `organizationId` flow at route/service seams where practical with context/scope objects.
- Preserve DB/storage compatibility where existing tables use `organization_id`.

Exit criteria:

- Core payment APIs can accept a scope/context instead of requiring Cloud-style tenant plumbing.
- Open routes do not need `X-Organization-ID` for single-tenant use.

Status update:

- Business API route groups now resolve `RuntimeContext` and call `*ForRuntimeScope` seams for orders, payment links, deposits, address pool, transfers, API keys, and notifications.
- Route-level `runtimeContextToLegacyOrganizationId` usage has been removed from `apps/api/src/routes/*`; legacy `organization_id` mapping is contained in compatibility seams and storage/repository layers.
- Phase 1 route seam acceptance is covered by runtime-context tests plus typecheck/boundary checks.

### Phase 2 — app and route composition

Deliverables:

- Refactor API app startup toward `createOpenApp(deps)`.
- Convert core route groups into route modules/factories with injected dependencies.
- Keep Cloud-only route concepts out of Open route registry.

Exit criteria:

- Future Cloud overlay can compose Open core routes and add Cloud routes without copying Open route files.

Status update:

- First app-composition slice is in place: `createApp(options)` accepts infrastructure/guard overrides and route extension hooks.
- First route-factory slice is in place: `createApiKeysRoutes(deps)` accepts injected auth, middleware, and runtime-context dependencies while preserving the default Open export.
- Remaining Phase 2 work: convert the rest of the built-in route groups into factories with injected manager/auth/notification/runtime/policy/event dependencies.

### Phase 3 — Open self-hosted runtime profile

Deliverables:

- Default local tenant/workspace seeding.
- Explicit local admin/setup flow; no unsafe default production admin.
- Local API-key/auth semantics suitable for self-hosting.
- Open admin/UI/profile hides org/member/role/billing/superadmin SaaS concepts.
- Local config profile is clear and self-hostable.

Exit criteria:

- `payin-open` can run as a complete single-tenant merchant product.
- Boundary check prevents Cloud dependencies from entering Open core.

### Phase 4 — overlay readiness hardening

Deliverables:

- Replace remaining Cloud-shaped seams with ports/providers.
- Add tests for default tenant behavior and no Cloud dependency leakage.
- Document exact overlay extension points.

Exit criteria:

- Checklist passes: RuntimeContext, app composition, auth/config/notification/entitlement ports, boundary checks, self-host docs.

### Phase 5 — create private Cloud overlay repo

Only after Phases 1–4 exit criteria pass.

Deliverables:

- New private `payin-cloud-overlay` repo.
- Cloud implementations: organization context, SaaS auth/API keys, member/role, billing/subscription/entitlements, usage metering, audit, hosted config, hosted ops/admin UI.
- Extract/adapt Cloud-only code from old `payin` into overlay, composing `payin-open` rather than copying Open core.

## Immediate implementation queue

1. Validate current `payin-open` baseline checks.
2. Add/adjust architecture docs for target seams and overlay readiness.
3. Locate current `organizationId` / scope flow in `payin-open`.
4. Introduce `RuntimeContext` / `PaymentScope` types and `SingleTenantContextProvider` in the least disruptive shared/core package.
5. Refactor one vertical slice first, preferably order creation or payment-link management, to use scope/context.
6. Run checks, review diffs, iterate.

## Quality control checklist

For every implementation step:

- No modifications to old `payin` unless explicitly authorized.
- No Cloud-only concepts added to Open public model.
- No fork/copy of core payment behavior.
- Existing self-host docs and boundary checks remain valid or are updated intentionally.
- Tests/build/lint/boundary checks are run and results recorded.
