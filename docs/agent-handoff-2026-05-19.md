# Agent handoff — PayIn Open overlay-readiness

Date: 2026-05-19; refreshed after Phase 2 PR #7 and order-create seam PR #8 on 2026-05-20
Repository: `payincom/payin-open`
Current merged baseline: `aaeb765 Add order create policy and event seam (#8)` on `main`

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

## Current merged status

### Phase 1 — RuntimeContext / PaymentScope

Merged and substantially complete at route seams.

- Business API route groups resolve neutral `RuntimeContext` / `PaymentScope` at the route boundary.
- Converted groups: `orders`, `payment-links`, `deposits`, `address-pool`, `transfers`, `api-keys`, and `notifications`.
- Route handlers no longer own legacy `organization_id` conversion for business operations.
- Existing database columns and lower storage layers may still use `organization_id` as compatibility storage scope.

Key files:

- `packages/processor/src/context/payment-scope.ts`
- `packages/processor/src/context/runtime-context.ts`
- `apps/api/src/open-runtime.ts`

### Phase 2 — app and route composition

Merged in PR #7: `78af1a1 Add Phase 2 route composition seams (#7)`.

- `apps/api/src/server.ts` exposes `CreateAppOptions` and `createApp(options)`.
- `createApp(options)` supports `routeFactories`, `routeDependencies`, infrastructure/guard overrides, and `extendPublicRoutes` / `extendApiRoutes` hooks.
- Built-in business route factories are in place with default Open exports:
  - `createOrdersRoutes(deps)`
  - `createPaymentLinksRoutes(deps)`
  - `createDepositsRoutes(deps)`
  - `createAddressPoolRoutes(deps)`
  - `createTransfersRoutes(deps)`
  - `createNotificationsRoutes(deps)`
  - existing `createApiKeysRoutes(deps)` remains part of app composition.
- Default `createApp()` behavior remains the Open app; overlays can inject dependencies or replace factories without copying route files.

Phase 2 did **not** implement Cloud overlay runtime, billing, subscriptions, plans, admin UI, migrations, or repository extraction.

### PR #8 — order-create policy/event seam

Merged in PR #8: `aaeb765 Add order create policy and event seam (#8)`.

- `apps/api/src/order-create-seam.ts` defines a neutral `POST /api/v1/orders` policy and event seam.
- `OrdersRouteDependencies` accepts `orderCreatePolicy` and `orderCreateEventSink`.
- Current Open defaults are:
  - `allowAllOrderCreatePolicy`: allows all order-create requests.
  - `noOpOrderCreateEventSink`: records nothing by default.
- On successful order creation, the route emits a neutral best-effort `order.created` envelope with payment scope, actor/request/source metadata where available, and order id/reference.
- Injected event sink failures are caught and logged so they do not turn an already-created order into a failed client response.

PR #8 intentionally affects only `POST /api/v1/orders`; it does not add SaaS billing, plan limits, entitlement enforcement, usage metering implementation, migrations, admin UI, or Cloud overlay code.

## Evidence already recorded

Phase 2 evidence:

- `.ratp/reports/phase2-root-upward-report.md`
- `.ratp/reports/phase2-parent-evaluation.md`
- `.ratp/reports/phase2-merge-readiness-review.md`

Order seam evidence:

- `.ratp/reports/order-policy-event-seam-upward-report.md`
- `.ratp/reports/order-policy-event-seam-parent-evaluation.md`
- `.ratp/reports/order-policy-event-seam-merge-readiness-review.md`
- `.ratp/reports/order-policy-event-seam-supervisor-final-evaluation.md`

Recorded validation includes focused route/app tests, `npm run type-check`, `npm run boundary:check`, `git diff --check`, and anti-drift grep for Cloud/SaaS terms in touched runtime code.

## Next implementation candidates

Use small vertical slices. Do not start broad Cloud/SaaS work.

1. **Payment-link policy/event seam**: add allow-all/no-op defaults and best-effort events for create/update/publish operations only if the route needs overlay policy/audit hooks.
2. **Notification/webhook policy/event seam**: add bounded allow-all/no-op hooks for webhook create/retry or delivery audit without hosted SLA/billing behavior.
3. **Open self-hosted runtime profile**: clarify local operator/bootstrap/admin semantics and ensure hosted org/member/billing/superadmin surfaces remain hidden from Open product UX.
4. **Targeted service/facade scope hardening**: promote `RuntimeContext` / `PaymentScope` deeper where route seams still pass compatibility ids, while leaving repository storage unchanged.
5. **Repository/provider extraction discovery**: audit exact repository seams needed before implementing extraction; do not extract storage broadly without a specific overlay need.

## Non-goals for the next agents

- Do not create or implement the private Cloud overlay repository yet.
- Do not add SaaS billing, subscriptions, plans, plan limits, pricing, admin UI, support/risk/admin controls, or hosted ops features to Open.
- Do not add database migrations unless a separately approved Open feature requires them.
- Do not extract repositories/storage providers broadly as a speculative Cloud-prep task.
- Do not duplicate Open core behavior in a Cloud layer.

## RATP workflow expectations

Future RATP nodes that mention agent workflow should keep context budgets explicit:

- `contextWindowTokens`
- `usableContextTokens`
- `estimatedRequiredTokens`
- `contextBudgetSource`
- direct/delegate rationale
- compact/no-compact outcome

For implementation runs, use criterion-level evidence headings like E1–E7, keep the scope bounded, and stop at merge-ready evidence unless the human explicitly requests PR/merge actions.

## Quick orientation commands

```bash
cd /data/openclaw/workspace/payincom/payin-open
git status --short --branch
git log --oneline -5
npm run boundary:check
npm run type-check
```
