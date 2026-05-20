# Open overlay seams implementation plan

Date: 2026-05-17; refreshed after Phase 2 PR #7 and order-create seam PR #8 on 2026-05-20
Status: Open route/app composition merged; first order-create policy/event seam merged.

## Current structure and flow inventory

- `apps/api`: Hono API runtime. `src/server.ts` exposes `createApp(options)` with route factory/dependency composition, infrastructure/guard overrides, and public/API extension hooks.
- `packages/processor`: payment core for orders, deposits, transfers, monitor integration, PostgreSQL repositories, `RuntimeContext` / `PaymentScope`, and the Open facade.
- `packages/manager`: configuration/payment-link/processor orchestration and Open manager facade.
- `packages/auth`: local users/API keys and inherited organization/member/role storage.
- `packages/notification`: webhook delivery and notification persistence.
- `packages/shared`: logger, config provider interface, checkout rendering helpers.

## Current tenant/scope/auth path

- Open API route helpers live in `apps/api/src/open-runtime.ts`.
- `PaymentScope`, `RuntimeContext`, and `SingleTenantContextProvider` live in `packages/processor/src/context/*`.
- Business route groups resolve `RuntimeContext` at the route boundary and pass it to `*ForRuntimeScope` seams.
- Lower service/repository signatures may still accept raw `organizationId`; this is compatibility storage detail, not the Open public model.
- Hosted organization management remains Cloud-only: `apps/api/src/server.ts` guards `/organizations` and `/config-management` in Open.

## Merged checkpoints

### Phase 1 — route scope seams

Completed API business route RuntimeContext seams:

- `apps/api/src/routes/orders.ts`
- `apps/api/src/routes/payment-links.ts`
- `apps/api/src/routes/deposits.ts`
- `apps/api/src/routes/address-pool.ts`
- `apps/api/src/routes/transfers.ts`
- `apps/api/src/routes/api-keys.ts`
- `apps/api/src/routes/notifications.ts`

Remaining direct `c.get('organizationId')` route references are intentionally outside business payment operations, such as authenticated user context in `auth.ts` or guarded hosted organization-management routes.

### Phase 2 — app and route composition

Merged in PR #7.

- `apps/api/src/server.ts` exports `CreateAppOptions` and `createApp(options)`.
- `createApp(options)` supports `routeFactories?: BuiltInRouteFactories` and `routeDependencies?: BuiltInRouteDependencies`.
- Built-in business route factories now exist for `api-keys`, `orders`, `payment-links`, `deposits`, `address-pool`, `transfers`, and `notifications`.
- Each route preserves default Open behavior with `export default createXRoutes()`.
- Future overlays can inject route dependencies or replace factories without remounting paths or copying Open route files.

Phase 2 intentionally did not extract lower manager/service/repository providers, add Cloud runtime, or implement billing/subscription/entitlement/metering behavior.

### PR #8 — order-create policy/event seam

Merged in PR #8.

- `apps/api/src/order-create-seam.ts` defines neutral order-create policy and event contracts.
- `apps/api/src/routes/orders.ts` wires `orderCreatePolicy` and `orderCreateEventSink` only for `POST /api/v1/orders`.
- Open defaults are allow-all policy and no-op event sink.
- Successful order creation records a neutral `order.created` envelope on a best-effort/no-throw basis.
- The seam is not a Cloud billing, plan-limit, entitlement, or usage-metering implementation.

## Ordered next implementation candidates

1. **Payment-link policy/event seam**
   - Add a narrow seam only around create/update/publish operations if an overlay needs policy/audit hooks.
   - Defaults must be allow-all/no-op and preserve Open behavior.

2. **Notification/webhook policy/event seam**
   - Add bounded hooks for webhook create/retry or delivery audit.
   - Keep Open notification behavior local/self-hosted; no hosted SLA, billing, or metering logic.

3. **Open self-hosted runtime profile**
   - Clarify local operator bootstrap/admin semantics.
   - Ensure org/member/billing/superadmin SaaS concepts stay hidden from Open product UX.

4. **Targeted service/facade scope hardening**
   - Promote `RuntimeContext` / `PaymentScope` where it removes route/service coupling.
   - Keep repository `organization_id` persistence unchanged until a concrete extraction need exists.

5. **Repository/provider extraction discovery**
   - Audit exact repository seams needed for future overlay composition.
   - Do not implement broad storage extraction or migrations as speculative Cloud prep.

## Non-goals and guardrails

- Do not create the final private Cloud overlay repo yet.
- Do not add SaaS billing, subscriptions, plans, pricing, plan limits, Cloud admin UI, support/risk/admin controls, or hosted ops features to Open.
- Do not add database migrations or repository extraction unless separately scoped and approved.
- Do not expose organization/member/billing/admin Cloud concepts as Open product features.
- Existing DB `organization_id` columns remain compatibility storage, not the Open public model.
- New overlay-facing behavior belongs behind neutral Open-owned ports/providers and must default to allow-all/no-op in Open.

## RATP expectations

Future agent/RATP workflow notes should include explicit context-budget fields:

- `contextWindowTokens`
- `usableContextTokens`
- `estimatedRequiredTokens`
- `contextBudgetSource`
- direct/delegate rationale and compact/no-compact outcome

Use evidence IDs for bounded implementation reports, and stop at merge-ready evidence unless PR/merge lifecycle work is explicitly requested.
