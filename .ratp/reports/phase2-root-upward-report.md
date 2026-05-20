# Phase 2 Root Upward Report — App and Route Composition

## Goal lineage

`rootGoal → Fully implement Payin Open Phase 2 app and route composition`  
`localGoal → Establish Phase 2 checklist, evaluate/integrate partial artifacts, decompose route-factory/composition work, implement/validate, observe RATP behavior`

## Phase 2 exit checklist

Derived from `docs/open-cloud-execution-plan.md`, `docs/agent-handoff-2026-05-19.md`, `docs/open-overlay-seams-plan.md`, and current code:

- [x] Preserve Phase 1 RuntimeContext behavior: business routes resolve neutral runtime context and call `*ForRuntimeScope` seams; route handlers do not call `runtimeContextToLegacyOrganizationId`.
- [x] Preserve `createApp(options)` Open default wiring and existing extension seams.
- [x] Convert remaining built-in business routes into dependency-aware route factories with default Open exports:
  - [x] `orders` → `OrdersRouteDependencies`, `createOrdersRoutes(deps)`, `export default createOrdersRoutes()`
  - [x] `payment-links` → `PaymentLinksRouteDependencies`, `createPaymentLinksRoutes(deps)`, `export default createPaymentLinksRoutes()`
  - [x] `deposits` → `DepositsRouteDependencies`, `createDepositsRoutes(deps)`, `export default createDepositsRoutes()`
  - [x] `address-pool` → `AddressPoolRouteDependencies`, `createAddressPoolRoutes(deps)`, `export default createAddressPoolRoutes()`
  - [x] `transfers` → `TransfersRouteDependencies`, `createTransfersRoutes(deps)`, `export default createTransfersRoutes()`
  - [x] `notifications` → `NotificationsRouteDependencies`, `createNotificationsRoutes(deps)`, `export default createNotificationsRoutes()`
- [x] Keep `api-keys` first-slice factory behavior intact and include it in app composition wiring.
- [x] Update `createApp(options)` so built-in business route factories can receive injected dependencies and/or be overridden without remounting paths.
- [x] Keep Cloud-only route concepts out of the Open route registry; preserve existing Cloud-only guards for `/organizations` and `/config-management` and do not add Cloud billing/subscription/entitlement/metering checks.
- [x] Add/extend focused tests proving injected route dependencies work and default route exports remain usable.
- [x] Run focused validation and type-check.
- [x] Record risks/gaps and recommended next step.

## Implementation/decomposition performed

Because the working tree already contained uncommitted Phase 2 draft artifacts and a matching stash of earlier route-factory edits, I treated them as untrusted candidate work rather than blindly reapplying the stash. The current draft route/test changes were inspected, validated, and kept where correct. The stash was inspected (`git stash show --stat/name-only`) and not applied because its touched route files overlapped with the already-present converted route factories.

Work was decomposed into bounded leaves:

1. **Inventory/checklist leaf** — compared docs and current code to identify required route groups, default export constraints, and app composition gaps.
2. **Route-factory conversion leaf** — accepted/fixed existing draft conversions for `orders`, `payment-links`, `deposits`, `address-pool`, `transfers`, `notifications`.
3. **App composition leaf** — Codex updated `apps/api/src/server.ts` so `createApp(options)` supports typed `routeFactories` and `routeDependencies` for `apiKeys`, `orders`, `paymentLinks`, `deposits`, `addressPool`, `transfers`, and `notifications`.
4. **Test leaf** — focused tests verify route factories use injected dependencies and defaults remain usable; app composition tests verify injected dependencies flow through `/api/v1/orders` and route factory overrides keep mount paths intact.
5. **Validation/review leaf** — ran focused Vitest route/app tests, `npm run type-check`, `git diff --check`, and targeted grep checks for disallowed route-level legacy/org-cloud concepts.

## Changed files

- `apps/api/src/routes/orders.ts`
- `apps/api/src/routes/payment-links.ts`
- `apps/api/src/routes/deposits.ts`
- `apps/api/src/routes/address-pool.ts`
- `apps/api/src/routes/transfers.ts`
- `apps/api/src/routes/notifications.ts`
- `apps/api/src/server.ts`
- `apps/api/tests/orders-runtime-context.test.ts`
- `apps/api/tests/payment-links-runtime-context.test.ts`
- `apps/api/tests/deposits-runtime-context.test.ts`
- `apps/api/tests/address-pool-runtime-context.test.ts`
- `apps/api/tests/transfers-runtime-context.test.ts`
- `apps/api/tests/open-runtime.test.ts`

Note: `apps/api/tests/notifications-runtime-context.test.ts` already had factory injection coverage and did not need additional edits in the final diff.

## Key implementation details

- Each converted route module keeps default Open behavior by constructing the default route at module export time (`export default createXRoutes();`).
- Route dependencies are injectable at factory construction time, including manager/auth accessors, auth/audit/permission middleware factories where used, runtime context resolver, organization-context error message helper, notification service accessors where used, and route-specific URL helpers where needed.
- `createApp(options)` now exposes:
  - `routeFactories?: BuiltInRouteFactories`
  - `routeDependencies?: BuiltInRouteDependencies`
- Default `createApp()` still mounts Open built-in routes under the same paths.
- Existing Cloud-only route guards are unchanged; no production Cloud overlay, SaaS billing/admin, subscription, entitlement, or usage metering implementation was added.

## Validation evidence

Commands run from `/data/openclaw/workspace/payincom/payin-open`:

```bash
git diff --check
```

Passed with no output.

```bash
npx vitest run \
  apps/api/tests/open-runtime.test.ts \
  apps/api/tests/api-keys-runtime-context.test.ts \
  apps/api/tests/orders-runtime-context.test.ts \
  apps/api/tests/payment-links-runtime-context.test.ts \
  apps/api/tests/deposits-runtime-context.test.ts \
  apps/api/tests/address-pool-runtime-context.test.ts \
  apps/api/tests/transfers-runtime-context.test.ts \
  apps/api/tests/notifications-runtime-context.test.ts
```

Passed: **8 test files, 97 tests**.

```bash
npm run type-check
```

Passed: `tsc --build --pretty false packages/shared packages/monitor packages/processor packages/notification packages/email packages/manager packages/auth packages/test-utils apps/api`.

Additional targeted checks:

```bash
grep -n "runtimeContextToLegacyOrganizationId" apps/api/src/routes/{orders,payment-links,deposits,address-pool,transfers,notifications}.ts apps/api/src/server.ts
```

No matches.

```bash
grep -n "plan_type\|monthly_order_limit\|billing\|subscription\|entitlement\|metering\|usage" apps/api/src/routes/{orders,payment-links,deposits,address-pool,transfers,notifications}.ts apps/api/src/server.ts
```

No matches.

Expected benign validation noise observed: Node `[DEP0040] punycode` deprecation warnings and `bigint-buffer` pure JS fallback warnings during Vitest.

## Fit check

- **Parent goal matched:** Phase 2 route/app composition is implemented for the listed business route groups plus existing `api-keys`, with app-level factory/dependency composition.
- **Scope respected:** No full Cloud overlay, no tenant SaaS billing/admin, no storage/repository provider extraction, no schema migration, no UI work.
- **Default Open behavior preserved:** Default exports remain and targeted default route tests pass.
- **Future Cloud overlay enabled:** A future overlay can now call `createApp({ routeDependencies, routeFactories, extendApiRoutes })` to compose Open routes without copying route logic.
- **Drift risk:** Low. The main residual risk is that deeper service/repository layers still use legacy `organization_id` compatibility storage, which docs classify as later work and not Phase 2 route/app composition.

## Risks/gaps

- The route factory conversion is intentionally narrow: it injects route-level dependencies but does not extract lower manager/service/repository providers.
- Public checkout route/template customization remains concrete and is outside this Phase 2 task.
- No policy/entitlement/event/usage sink ports were introduced because route composition did not require them yet; adding them prematurely would risk SaaS scope creep.
- The earlier stash remains present and un-applied; it appears superseded by the working tree route-factory implementation.

## Recommended next step

Have the supervisor review the diff, then either commit Phase 2 as the Open seam implementation or run any repository-standard broader checks desired before PR. The next implementation phase should be a separate scoped task: define explicit policy/event/usage ports only where a real overlay integration needs them, without scattering Cloud checks into Open route handlers.
