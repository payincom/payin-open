# Open API / Manager Boundary Audit

This note captures the next small, test-driven slice after the `OpenProcessor` facade.

## Remaining Open-surface tenancy leaks

The API server still exposes Cloud-style organization concepts as first-class HTTP behavior:

- `apps/api/src/server.ts` mounts `/api/v1/organizations` and comments on multi-tenancy/config-management support.
- Business routes (`orders`, `deposits`, `address-pool`, `payment-links`, `notifications`) repeatedly read `c.get('organizationId')`, return `ORGANIZATION_CONTEXT_REQUIRED`, and pass explicit organization ids into manager methods.
- `apps/api/src/routes/config-management.ts` accepts/returns `organization_id`, supports `scope=global|organization|all`, and uses Cloud super-admin/org-admin semantics.
- `packages/manager/src/manager.ts` exposes public methods with explicit `organizationId` parameters for payment links, orders, deposits, transfers, and address pools.
- `packages/manager/src/services/payment-link.service.ts` persists and filters by `organization_id`, which should remain an internal compatibility detail for Open.

## Recommended next wrapper slice

Create an `OpenManager` facade in `packages/manager` before changing route behavior broadly. It should compose `ConfigurationManager` and inject the same default internal merchant id used by `OpenProcessor`.

Wrap these first, because they are the public merchant operations already covered by API routes and the new processor facade:

1. Address pool: `getAddressPoolAvailability`, `listAddresses`, `addAddressesToPool`, `archiveAddress`, `unarchiveAddress`.
2. Deposits: `bindDepositAddress`, `unbindDepositAddressByAddress`, `listDepositReferences`, `getUserDepositAddress`, `listDepositAddresses`.
3. Orders: `createOrder`, `getOrder`, `listOrders`, `getOrderStatistics`.
4. Payment links: `createPaymentLink`, `updatePaymentLink`, `publishPaymentLink`, `unpublishPaymentLink`, `archivePaymentLink`, `restorePaymentLink`, `listPaymentLinks`, `getPaymentLink`, `listPaymentLinkOrders`, `updatePaymentLinkCurrencies`.

Leave Cloud-only organization/user membership routes and full config-management semantics untouched until Open has an explicit API mode.

## Test-driven acceptance

Add unit tests for the facade before touching API routes:

- `packages/manager/tests/unit/open-manager-facade.test.ts` should assert Open methods do not accept `organizationId` in their method signatures/payloads and pass `DEFAULT_OPEN_ORGANIZATION_ID` to `ConfigurationManager`.
- Include negative compile/runtime expectations for payloads that try to override `organizationId` where feasible.
- Add route-level tests around a small Open API context shim: business routes should receive an organization context automatically in Open mode and must not require `X-Organization-Id` or expose `ORGANIZATION_CONTEXT_REQUIRED` to self-hosted Open operators.

## API shim direction

An Open API context shim is the right next step, but it should be narrow: inject the default internal organization id and hide organization wording for business routes only. Do not rewrite auth, organization membership, or config-management in the same slice.
