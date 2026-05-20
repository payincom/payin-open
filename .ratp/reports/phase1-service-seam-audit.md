# phase1-service-seam-audit

## Goal

Audit manager/auth/notification/processor service seams for `*ForRuntimeScope` coverage and justified remaining legacy `organization_id` storage boundaries, supporting the parent Phase 1 RuntimeContext / PaymentScope hardening goal for PayIn Open.

## Result

Phase 1 is mostly in good shape: PayIn Open-facing business routes generally use neutral `RuntimeContext`/`PaymentScope` seams, while repositories and DB schemas continue to use `organization_id` as an explicitly documented compatibility/storage boundary.

Smallest recommended hardening patch: close the API-key read/update/revoke gap. `POST /api-keys` and `GET /api-keys` already use `createApiKeyForRuntimeScope` and `listApiKeysForRuntimeScope`, but `GET/PATCH/DELETE /api-keys/:id` still call unscoped `getApiKeyById`, `updateApiKey`, and `revokeApiKey`; this can leak across business scopes for the same user in multi-org/Cloud mode and does not preserve the Open route convention of resolving runtime context at the boundary.

Recommended minimal patch:

1. Add scoped AuthManager APIs:
   - `getApiKeyByIdForRuntimeScope(keyId, scope)` returning null unless `organizationId` matches `apiKeyRuntimeScopeToOrganizationId(scope)`.
   - `updateApiKeyForRuntimeScope(keyId, scope, input)` with `WHERE id = $id AND organization_id = $scopeOrgId` or precheck via the scoped getter.
   - `revokeApiKeyForRuntimeScope(keyId, scope)` with `DELETE ... WHERE id = $id AND organization_id = $scopeOrgId`.
2. Update `apps/api/src/routes/api-keys.ts` `GET/PATCH/DELETE /:id` to resolve and require `runtimeContext`, then use those scoped APIs.
3. Add/extend tests in `apps/api/tests/api-keys-runtime-context.test.ts` and `packages/auth/tests/unit/api-key-runtime-scope.test.ts` for scoped get/update/revoke.

No DB column rename, repository redesign, or Cloud overlay port is needed.

## Evidence

### Existing neutral runtime/payment-scope APIs

#### processor

- `packages/processor/src/context/payment-scope.ts:9` defines `PaymentScope { id, kind, label? }`; lines 17-33 define the default single-merchant scope and `tenantPaymentScope`.
- `packages/processor/src/context/payment-scope.ts:33` has the explicit storage bridge `paymentScopeToOrganizationId(scope): string { return scope.id; }`.
- `packages/processor/src/context/runtime-context.ts:22` defines neutral `RuntimeContext` containing `paymentScope`; lines 36-38 define `RuntimeContextProvider`; lines 55-84 define `SingleTenantContextProvider` and `createSingleTenantRuntimeContextProvider`.
- `packages/processor/src/open/open-processor.ts:31` accepts `contextProvider?: RuntimeContextProvider`; lines 49-66 store `paymentScope` and derive the internal `organizationId` from `paymentScopeToOrganizationId`; lines 140-277 wrap lower-level `Processor` calls while omitting `organizationId` from Open caller-facing request types (`OpenCreateOrderRequest`, `OpenBindAddressRequest`, `OpenUnbindAddressRequest` at lines 37-39).
- No `*ForRuntimeScope` methods exist directly in `packages/processor/src/processor.ts`; the Phase 1 seam there is the `PaymentScope`/`RuntimeContext` primitives plus `OpenProcessor` facade.

#### manager

- `packages/manager/src/manager.ts:37-49` imports `PaymentScope`/`RuntimeContext`, defines `OrderRuntimeScope`, and defines `orderRuntimeScopeToOrganizationId`.
- Existing `ConfigurationManager` `*ForRuntimeScope` methods found:
  - Payment links: `createPaymentLinkForRuntimeScope` (`manager.ts:1776`), `updatePaymentLinkForRuntimeScope` (`1800`), `publishPaymentLinkForRuntimeScope` (`1825`), `unpublishPaymentLinkForRuntimeScope` (`1841`), `archivePaymentLinkForRuntimeScope` (`1855`), `restorePaymentLinkForRuntimeScope` (`1869`), `listPaymentLinksForRuntimeScope` (`1889`), `getPaymentLinkForRuntimeScope` (`1909`), `listPaymentLinkOrdersForRuntimeScope` (`1930`), `getPaymentLinkOrganizationIdForRuntimeScope` (`1947`), `updatePaymentLinkCurrenciesForRuntimeScope` (`1966`).
  - Orders: `createOrderForRuntimeScope` (`2104`), `getOrderForRuntimeScope` (`2129`), `listOrdersForRuntimeScope` (`2160`), `getOrderStatisticsForRuntimeScope` (`2202`).
  - Deposits/transfers/address pool: `bindDepositAddressForRuntimeScope` (`2241`), `unbindDepositAddressByAddressForRuntimeScope` (`2275`), `listDepositReferencesForRuntimeScope` (`2320`), `getUserDepositAddressForRuntimeScope` (`2357`), `listDepositAddressesForRuntimeScope` (`2399`), `listTransfersForRuntimeScope` (`2442`), `getTransfersForRuntimeScope` (`2468`), `getAddressPoolAvailabilityForRuntimeScope` (`2505`), `getAddressPoolSummaryForRuntimeScope` (`2521`), `listAddressesForRuntimeScope` (`2625`), `addAddressesToPoolForRuntimeScope` (`2656`), `archiveAddressForRuntimeScope` (`2686`), `unarchiveAddressForRuntimeScope` (`2703`).
- `packages/manager/src/open/open-manager.ts:6-13` imports `PaymentScope` and `RuntimeContextProvider`; lines 42-56 derive the internal `organizationId` from `paymentScopeToOrganizationId`; lines 66-227 wrap `ConfigurationManager` with Open-facing methods that do not require callers to pass org ids.

#### auth

- `packages/auth/src/auth-manager.ts:35-45` imports `PaymentScope`/`RuntimeContext`, defines `ApiKeyRuntimeScope`, and defines `apiKeyRuntimeScopeToOrganizationId`.
- Existing scoped APIs: `createApiKeyForRuntimeScope` at `auth-manager.ts:789` delegates to `createApiKey(userId, convertedScope, input)`; `listApiKeysForRuntimeScope` at `auth-manager.ts:906` delegates to `listApiKeys(convertedScope, userId)`.
- `apps/api/src/routes/api-keys.ts:75-127` resolves runtime context for API-key creation and calls `createApiKeyForRuntimeScope`; lines 172-191 do the same for listing via `listApiKeysForRuntimeScope`.

#### notification

- `packages/notification/src/notification-service.ts:19-36` defines `NotificationPaymentScope`, `NotificationRuntimeScope`, and `notificationRuntimeScopeToOrganizationId`.
- Existing scoped APIs: `createEndpointForRuntimeScope` (`notification-service.ts:170`), `getEndpointForRuntimeScope` (`187`), `listEndpointsForRuntimeScope` (`212`), `updateEndpointForRuntimeScope` (`236`), `deleteEndpointForRuntimeScope` (`251`), `testEndpointForRuntimeScope` (`289`), `getNotificationLogsForRuntimeScope` (`311`), `getNotificationLogForRuntimeScope` (`328`), `retryFailedNotificationsForRuntimeScope` (`349`), `getStatisticsForRuntimeScope` (`399`).
- `apps/api/src/routes/notifications.ts` consistently calls notification scoped APIs: examples include create/list/get/update/delete endpoint at lines 105, 147, 182, 233, 280; logs and retry/statistics at lines 375, 406, 508, 570; later compatibility endpoints also use scoped calls at 645, 670, 699, 733, 763.

### Acceptable raw `organizationId` / `organization_id` boundaries

- DB schema and repository compatibility is acceptable and expected for Phase 1:
  - Manager schema uses `organization_id` for config and business tables: `packages/manager/src/database/schema.ts:194`, `226`, `292`, with indexes at 206, 259, 306.
  - Auth schema uses org membership/API-key columns: `packages/auth/src/database/schema.ts:115`, `151`, `171` and migration/index files such as `packages/auth/src/database/migrations/002_multi_tenancy_indexes.sql:13-22`.
  - Notification schema/repository uses persisted `organization_id`: `packages/notification/src/database/schema.ts:19`, `68`; repository filters at `notification.repository.ts:63-67`, `95-105`, `197-199`, `221-225`, `372-396`, `451-462`.
  - Processor repositories accept org ids for SQL filtering: `order.repository.ts:61-66`, `transfer.repository.ts:53-80`, `address-pool.repository.ts:97-108`, `267-313`, `364-389`, `509-571`.
- Lower-level service APIs that still accept `organizationId` are acceptable as compatibility / Cloud-capable internals when Open routes/facades call the scoped wrappers:
  - Processor business methods require/filter by `organizationId` in `packages/processor/src/processor.ts:132-141`, `197-219`, `252-290`, `302-317`, `369-484`, `556-646`.
  - Processor services persist organization ids from requests or rows: `packages/processor/src/services/order-service.ts:10`, `185`, `247-251`, `512-522`, `589-613`; `deposit-service.ts:13`, `93-115`, `178-203`, `274-324`.
  - Manager lower-level methods keep `organizationId` signatures but have adjacent `ForRuntimeScope` wrappers, e.g. `createOrder` at `manager.ts:2077-2111`, `listOrders` at `2138-2169`, `bindDepositAddress` at `2217-2251`, and address-pool methods at `2598-2704`.
- Explicit conversion helpers are acceptable as seam-local compatibility bridges: `paymentScopeToOrganizationId` (`processor/context/payment-scope.ts:33`), `orderRuntimeScopeToOrganizationId` (`manager.ts:51`), `apiKeyRuntimeScopeToOrganizationId` (`auth-manager.ts:45`), `notificationRuntimeScopeToOrganizationId` (`notification-service.ts:29`).
- Payment-link preview token route is acceptable because it handles a token payload that currently carries `organizationId`; the conversion is centralized behind `manager.getPaymentLinkOrganizationIdForRuntimeScope` at `packages/manager/src/manager.ts:1947`, used by `apps/api/src/routes/payment-links.ts:644`.

### Questionable service-boundary leaks / hardening gap

- API key item routes skip the runtime-scope seam after creation/listing:
  - `apps/api/src/routes/api-keys.ts:232` calls `authManager.getApiKeyById(keyId)` without resolving/checking `runtimeContext`.
  - `apps/api/src/routes/api-keys.ts:304` and `389` use `getApiKeyById` as the only precheck before update/revoke.
  - `apps/api/src/routes/api-keys.ts:348` calls unscoped `authManager.updateApiKey(keyId, ...)`.
  - `apps/api/src/routes/api-keys.ts:413` calls unscoped `authManager.revokeApiKey(keyId)`.
- The AuthManager currently lacks item-level scoped equivalents:
  - `packages/auth/src/auth-manager.ts:916` `getApiKeyById(keyId)` selects only by `id`.
  - `packages/auth/src/auth-manager.ts:932-964` `updateApiKey(keyId, input)` updates only by `id`.
  - `packages/auth/src/auth-manager.ts:971-973` `revokeApiKey(keyId)` deletes only by `id`.
- This is not an `organization_id` storage problem; it is a route/service boundary gap. A user who belongs to multiple organizations can pass ownership checks by `userId` while accessing a key outside the resolved business scope. Open single-merchant deployments may not observe the issue, but Phase 1 aims for route boundaries to use neutral runtime/payment scope consistently.

## Fit Check

- Parent goal match: The audit directly checks whether business routes/services use neutral `RuntimeContext`/`PaymentScope` instead of requiring Open callers to provide Cloud-shaped organization ids.
- Acceptance criteria:
  - Listed existing `*ForRuntimeScope` and `PaymentScope` APIs across manager/auth/notification/processor.
  - Classified raw `organizationId`/`organization_id` uses as acceptable storage/repository/lower-level compatibility versus the API-key item-route/service gap.
  - Recommended the smallest Phase 1 hardening patch only; no DB column rename, repository redesign, or Cloud overlay port.
  - Included file/line evidence.

## Risks / Gaps

- This was a read-only source audit plus report creation; no tests were run and no patch was applied.
- Line numbers may shift after other agents change the tree; evidence is based on the current checkout during this audit.
- Processor still has many lower-level `organizationId` service signatures by design. If the project later wants pure neutral internals, that is beyond Phase 1 and would be a larger refactor.
- Auth route hardening should be careful not to break `apps/api/src/routes/organizations.ts`, which intentionally uses organization context for Cloud organization-management routes and already checks `apiKey.organizationId !== orgId` at line 378 before revoke.

## Recommended Next Step

Implement the minimal API-key scoped item-operation patch:

1. Add `getApiKeyByIdForRuntimeScope`, `updateApiKeyForRuntimeScope`, and `revokeApiKeyForRuntimeScope` to `packages/auth/src/auth-manager.ts`.
2. Update `apps/api/src/routes/api-keys.ts` item routes to require `runtimeContext` and call those scoped methods.
3. Add focused tests proving same-user/different-scope API keys are not get/update/revoked through `/api-keys/:id`.
