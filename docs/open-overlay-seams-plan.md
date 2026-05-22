# Open overlay seams implementation plan

Date: 2026-05-17; refreshed after Phase 4 completion through PR #18 on 2026-05-22
Status: Phase 4 overlay readiness hardening is complete; Open route/app composition, order-create, payment-link, self-hosted runtime profile, notification policy/event, and notification delivery factory seams are merged.

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

### PR #10 — payment-link policy/event seam

Merged in PR #10.

- `apps/api/src/payment-link-seam.ts` defines neutral payment-link policy and event contracts.
- `apps/api/src/routes/payment-links.ts` wires `paymentLinkPolicy` and `paymentLinkEventSink` for create/update/publish operations.
- Open defaults are allow-all policy and no-op event sink.
- Successful covered operations record neutral `payment_link.created`, `payment_link.updated`, or `payment_link.published` envelopes on a best-effort/no-throw basis.
- The seam is not a Cloud billing, plan-limit, entitlement, or usage-metering implementation.

### Phase 3 — Open self-hosted runtime profile

Completed in PR #15 (`d1fe87f`).

- Open local setup, operator/admin posture, API-key/auth guidance, hosted admin hiding, and local configuration profile are documented.
- Phase 3 exit verification passed in `.apcp/reports/p3f-phase3-exit-verification.md`.

### PR #16 / P4.A — notification policy/event seam

Merged in PR #16 (`8bb3c10`).

- `apps/api/src/notification-seam.ts` defines neutral notification policy and event contracts.
- `apps/api/src/routes/notifications.ts` wires `notificationPolicy` and `notificationEventSink` for endpoint create, endpoint test, and notification retry operations.
- Open defaults are allow-all policy and no-op event sink.
- Successful covered operations record neutral `notification.endpoint.created`, `notification.endpoint.tested`, or `notification.retry.requested` envelopes on a best-effort/no-throw basis.
- The seam is not hosted webhook SLA, billing, plan-limit, entitlement, usage-metering, member/role, admin, or Cloud overlay implementation.

### PR #18 / P4.D — notification delivery factory seam

Merged in PR #18 (`1d0d432`).

- `packages/notification/src/queue/notification-queue.ts` defines `NotificationNotifierFactory = (endpoint: Endpoint) => BaseNotifier`.
- `NotificationQueue` and `NotificationService` can accept an injected notifier factory.
- Open default remains webhook-only and constructs `WebhookNotifier` with the existing endpoint config mapping.
- Unsupported non-webhook endpoints still throw `Unsupported endpoint type: ${endpoint.endpoint_type}` by default.
- Focused tests cover default webhook delivery, injected factory use, service-level config threading, and unchanged unsupported endpoint behavior.
- The seam is not an email/telegram provider implementation, hosted notification SLA, broad provider extraction, storage abstraction, DB migration, or Cloud overlay implementation.

## Ordered next implementation candidates

Phase 4 is complete. Do not continue adding Open seams speculatively.

1. **Phase 5 Cloud overlay repo creation** — start only after explicit human approval.
2. **Future missing Open seam** — if Phase 5 discovers an Open gap, improve Open first through a separately scoped bounded PR.
3. **Targeted service/facade scope hardening** — only when it removes a concrete composition blocker; keep repository `organization_id` persistence unchanged until separately approved.

Do not implement broad storage extraction or migrations as speculative Cloud prep.

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
