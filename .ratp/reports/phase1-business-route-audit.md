# phase1-business-route-audit

## Goal
Audit PayIn Open business API routes and tests for RuntimeContext use, route-level organization-id leakage, and Open callers not requiring `X-Organization-ID`.

## Result
Phase 1 is **mostly in place**, but I found **one Phase 1 code patch needed** in `apps/api/src/routes/deposits.ts` / manager seams:

- `orders`, `payment-links`, `address-pool`, `transfers`, `notifications`, and the create/list parts of `api-keys` use neutral `resolveRuntimeContext(c)` plus `*ForRuntimeScope(...)` service/manager seams at the route boundary.
- Targeted grep found **no direct route-level** `runtimeContextToLegacyOrganizationId`, `paymentScopeToLegacyOrganizationId`, `organization_id`, `X-Organization-ID`, or `x-organization-id` in the audited business routes.
- Targeted grep found exactly **one route-level `organizationId` token** in audited routes: `apps/api/src/routes/payment-links.ts:644`, where the route creates an internal preview JWT payload with `organizationId: manager.getPaymentLinkOrganizationIdForRuntimeScope(runtimeContext)`. This is not a direct `runtimeContextToLegacyOrganizationId` import/use in the route, but it is still a Cloud-shaped payload name exposed at route level and should be watched/renamed behind a compatibility seam when preview token claims are hardened.
- **Patch-needed finding:** `POST /deposits/unbind` still has a `depositReference` branch that calls the legacy/scopeless `manager.unbindDepositAddress({ depositReference })` instead of a runtime-scope seam. This branch has no route-level `organizationId` text because it passes no scope at all; functionally that is worse for Phase 1 because Open/Cloud tenant scope is not carried through.
- Targeted runtime-context tests prove many Open calls work without an authenticated organization id, but coverage is uneven: each route group has at least one Open-without-org test, while `deposits` lacks coverage for the `depositReference` unbind branch and `api-keys` lacks runtime-scope coverage for get/update/delete by id.
- I attempted the targeted Vitest suite, but dependencies are not installed in this checkout: `sh: 1: vitest: not found`.

## Evidence

### Route group classification

| Route group | Route files | Classification | Phase 1 status |
|---|---|---|---|
| `orders` | `apps/api/src/routes/orders.ts` | Authenticated business route group. Resolves `RuntimeContext` per operation and calls manager `*ForRuntimeScope` seams. | Looks Phase-1 compliant at route level. |
| `payment-links` | `apps/api/src/routes/payment-links.ts`; public checkout API in `api-payment-links.ts` | Authenticated CRUD/admin routes use `RuntimeContext` and manager runtime-scope seams. Public `/api/payment-links/:slug` and `/:slug/orders` are public checkout by slug and do not use route auth/org headers. | Mostly compliant; one preview-token `organizationId` claim at route line 644 is a naming/compatibility smell, not direct route legacy conversion. |
| `deposits` | `apps/api/src/routes/deposits.ts`; public address API in `api-deposits.ts` | Authenticated business route group mostly uses `RuntimeContext` and manager runtime-scope seams. Public `/api/deposits/:address` is public address lookup. | **Needs patch:** `depositReference` unbind branch is legacy/scopeless. |
| `address-pool` | `apps/api/src/routes/address-pool.ts` | Authenticated business route group. Uses `RuntimeContext` and manager runtime-scope seams for availability, summary, list, add, archive, unarchive. | Looks Phase-1 compliant at route level. |
| `transfers` | `apps/api/src/routes/transfers.ts` | Authenticated business route group. Uses `RuntimeContext` and manager runtime-scope seams for list and by-reference lookup. | Looks Phase-1 compliant at route level. |
| `api-keys` | `apps/api/src/routes/api-keys.ts` | Authenticated key-management route factory. Create/list use `RuntimeContext` seams; get/update/delete by key id use user ownership only and do not use RuntimeContext. | Create/list covered; get/update/delete are a test/design gap for Phase 1 boundary consistency. |
| `notifications` | `apps/api/src/routes/notifications.ts` | Authenticated notification route factory. Uses injected/default `resolveRuntimeContext` and notification `*ForRuntimeScope` methods for endpoint/log/stat operations; direct `retryNotification(id)` follows a scoped log lookup. | Looks Phase-1 compliant at route level; tests are broad. |

### Exact grep evidence: audited routes

Command:

```sh
grep -RInE "runtimeContextToLegacyOrganizationId|paymentScopeToLegacyOrganizationId|resolveBusinessOrganizationId|organization_id|X-Organization-ID|x-organization-id" \
  apps/api/src/routes/orders.ts apps/api/src/routes/payment-links.ts apps/api/src/routes/deposits.ts \
  apps/api/src/routes/address-pool.ts apps/api/src/routes/transfers.ts apps/api/src/routes/api-keys.ts \
  apps/api/src/routes/notifications.ts apps/api/src/routes/api-payment-links.ts apps/api/src/routes/api-deposits.ts
```

Output: no matches.

Command:

```sh
grep -RIn "organizationId" \
  apps/api/src/routes/orders.ts apps/api/src/routes/payment-links.ts apps/api/src/routes/deposits.ts \
  apps/api/src/routes/address-pool.ts apps/api/src/routes/transfers.ts apps/api/src/routes/api-keys.ts \
  apps/api/src/routes/notifications.ts apps/api/src/routes/api-payment-links.ts apps/api/src/routes/api-deposits.ts
```

Output:

```text
apps/api/src/routes/payment-links.ts:644:          organizationId: manager.getPaymentLinkOrganizationIdForRuntimeScope(runtimeContext),
```

Relevant manager seam documents that this is a compatibility seam, not route-imported legacy conversion:

```text
packages/manager/src/manager.ts:1942-1947
Compatibility seam for auth/preview token payloads while tokens still
carry organizationId. Routes should not import legacy RuntimeContext
conversion helpers directly.
getPaymentLinkOrganizationIdForRuntimeScope(scope: OrderRuntimeScope): string {
  return orderRuntimeScopeToOrganizationId(scope) as string;
}
```

Runtime-scope call-count grep:

```text
apps/api/src/routes/orders.ts                 9
apps/api/src/routes/payment-links.ts          27
apps/api/src/routes/deposits.ts               13
apps/api/src/routes/address-pool.ts           13
apps/api/src/routes/transfers.ts              5
apps/api/src/routes/api-keys.ts               7
apps/api/src/routes/notifications.ts          41
apps/api/src/routes/api-payment-links.ts      0
apps/api/src/routes/api-deposits.ts           0
```

The public `api-payment-links.ts` and `api-deposits.ts` have `0` because they are unauthenticated public lookup/checkout surfaces, not authenticated business-tenant surfaces.

### Exact patch-needed evidence: deposits unbind gap

`apps/api/src/routes/deposits.ts:160-173`:

```ts
const runtimeContext = resolveRuntimeContext(c);

if (!runtimeContext) {
  return organizationContextRequiredResponse(c);
}

if (body.depositReference) {
  // Method 1: Unbind by depositReference
  await manager.unbindDepositAddress({
    depositReference: body.depositReference,
  });
```

This resolves `runtimeContext` but does not use it for the `depositReference` branch. The manager method is still legacy/scopeless at the type level:

```text
packages/manager/src/manager.ts:2251-2255
/** Unbind deposit address (proxy to Processor) */
async unbindDepositAddress(request: { depositReference: string }): Promise<void> {
  return await this.getProcessor().unbindDepositAddress(request);
}
```

Underlying processor/service still expects storage-compatible organization scope:

```text
packages/processor/src/services/deposit-service.ts:311-324
async unbindDepositAddress(request: UnbindAddressRequest): Promise<void> {
  const boundAddress = await this.addressPoolRepository.getUserDepositAddress(request.organizationId, request.depositReference, request.protocol);
  ...
  await this.addressPoolRepository.unbindAddress(request.organizationId, request.depositReference, request.protocol);
}
```

### Tests proving Open callers need not send organization id

Runtime-context route tests exist for all seven requested groups:

```text
apps/api/tests/orders-runtime-context.test.ts
apps/api/tests/payment-links-runtime-context.test.ts
apps/api/tests/deposits-runtime-context.test.ts
apps/api/tests/address-pool-runtime-context.test.ts
apps/api/tests/transfers-runtime-context.test.ts
apps/api/tests/api-keys-runtime-context.test.ts
apps/api/tests/notifications-runtime-context.test.ts
apps/api/tests/open-runtime.test.ts
```

Representative Open-without-org cases found by grep:

```text
apps/api/tests/orders-runtime-context.test.ts:97: uses the default single-merchant scope in Open runtime when no organization id is authenticated
apps/api/tests/payment-links-runtime-context.test.ts:128: uses the default single-merchant scope for payment-link creation in Open runtime without an authenticated organization id
apps/api/tests/payment-links-runtime-context.test.ts:147: uses the default single-merchant scope for listing payment links in Open runtime without an authenticated organization id
apps/api/tests/deposits-runtime-context.test.ts:136: uses the default single-merchant scope for deposit binding in Open runtime without an authenticated organization id
apps/api/tests/address-pool-runtime-context.test.ts:115: uses the default single-merchant scope for availability in Open runtime without an authenticated organization id
apps/api/tests/transfers-runtime-context.test.ts:70: uses the default single-merchant scope for transfer listing in Open runtime without an authenticated organization id
apps/api/tests/api-keys-runtime-context.test.ts:72: uses the default single-merchant scope for API key listing in Open runtime without an authenticated organization id
apps/api/tests/api-keys-runtime-context.test.ts:135: creates API keys with the default single-merchant scope in Open runtime without an authenticated organization id
apps/api/tests/notifications-runtime-context.test.ts:189: uses the default single-merchant scope for endpoint listing in Open runtime without an authenticated organization id
apps/api/tests/notifications-runtime-context.test.ts:240: uses the default single-merchant scope when creating an endpoint in Open runtime without an authenticated organization id
```

Negative evidence for real `X-Organization-ID` coupling in these tests/routes:

```sh
grep -RInE "X-Organization-ID|x-organization-id" apps/api/tests/*runtime-context.test.ts apps/api/src/routes/*.ts
```

Output: no matches. The tests use a private test-only `x-test-organization-id` injection header to simulate authenticated middleware context; they do not require `X-Organization-ID` for Open default-scope cases.

Notable route-test assertions also prevent route-level filter leakage in key places:

```text
apps/api/tests/orders-runtime-context.test.ts:179-180: list filters should not have property organizationId
apps/api/tests/orders-runtime-context.test.ts:261-262: stats filters should not have property organizationId
apps/api/tests/payment-links-runtime-context.test.ts:140: create request is expect.not.objectContaining({ organizationId: ... })
apps/api/tests/payment-links-runtime-context.test.ts:155: list filters are expect.not.objectContaining({ organizationId: ... })
apps/api/tests/payment-links-runtime-context.test.ts:195: authenticated list also avoids route-level organizationId filters
```

### Test execution attempt

Command:

```sh
npm test -- apps/api/tests/orders-runtime-context.test.ts apps/api/tests/payment-links-runtime-context.test.ts apps/api/tests/deposits-runtime-context.test.ts apps/api/tests/address-pool-runtime-context.test.ts apps/api/tests/transfers-runtime-context.test.ts apps/api/tests/api-keys-runtime-context.test.ts apps/api/tests/notifications-runtime-context.test.ts apps/api/tests/open-runtime.test.ts
```

Output:

```text
> payin-open@0.1.0-local test
> vitest run ...

sh: 1: vitest: not found
Command not found
```

## Fit Check
- Classified each requested business route group: **yes** (`orders`, `payment-links`, `deposits`, `address-pool`, `transfers`, `api-keys`, `notifications`).
- Found direct route-level `runtimeContextToLegacyOrganizationId` / `organization_id` / `X-Organization-ID` issues: **no direct matches** in audited route files.
- Found route-level `organizationId` leakage: **one compatibility-smell match** in payment-link preview-token payload (`payment-links.ts:644`).
- Found Phase 1 route/service boundary violation: **yes**, deposits unbind-by-`depositReference` resolves `RuntimeContext` but calls a legacy/scopeless manager method.
- Assessed tests proving no `X-Organization-ID` requirement: **yes**, tests exist across all groups and no real `X-Organization-ID` string appears in runtime-context tests/routes.
- Identified gaps: **yes**, deposits unbind-by-reference coverage; api-keys get/update/delete runtime-scope coverage; payment-link preview-token claim naming/seam hardening.

## Risks / Gaps
1. **Deposits unbind-by-reference may be broken and/or unscoped.** The route passes only `depositReference`, while lower service code expects `organizationId` and `protocol`. Even if TypeScript currently misses this through interface drift, runtime behavior is suspicious.
2. **Tests do not cover the risky deposits branch.** Existing deposits tests cover bind, list references, get address, list addresses, unbind by address, and stats, but not `body.depositReference` unbind.
3. **API-key get/update/delete are not runtime-scope-first.** They use user ownership checks rather than payment-scope checks. That may be acceptable for key resources, but Phase 1 tests currently prove only list/create runtime-scope behavior.
4. **Payment-link preview tokens still carry `organizationId`.** The conversion is behind a manager seam, but the route constructs a Cloud-shaped claim. This is probably acceptable for Phase 1 compatibility, but it is a visible naming debt.
5. **Cannot verify by running tests in this checkout** because `vitest` is missing (`node_modules` not installed).

## Recommended Next Step
Patch the deposits unbind-by-reference path first:

1. Add a manager runtime-scope seam, e.g. `unbindDepositAddressForRuntimeScope(scope, requestWithoutOrganizationId)` that injects `organizationId: orderRuntimeScopeToOrganizationId(scope)`.
2. Decide/validate the required `protocol` for `depositReference` unbind. The route docs currently say body `{ depositReference }`, but service code needs `protocol`; either require `protocol` in this branch or implement a manager/service operation that unbinds all protocols/addresses for the scoped deposit reference.
3. Change `apps/api/src/routes/deposits.ts` to call the new seam with `runtimeContext`.
4. Add tests in `apps/api/tests/deposits-runtime-context.test.ts` proving Open runtime can unbind by `depositReference` without any org header and that the route passes no route-level `organizationId` filter/request object.
5. Optionally follow with a small cleanup to hide/rename payment-link preview token `organizationId` construction behind a more neutral route helper, and add api-key get/update/delete boundary tests if Phase 1 wants every api-key operation to be payment-scope-aware.
