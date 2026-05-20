# Phase 1 Completion Upward Report

## Root Goal

Complete Payin Open Phase 1 RuntimeContext / PaymentScope hardening so Open runtime business operations do not require `X-Organization-ID`, Cloud behavior remains scoped, and Phase 1 docs/code/tests are coherent enough for review/merge.

## Local Goal

Inspect the current uncommitted Phase 1 implementation and audit reports, identify remaining Phase 1 exit blockers, implement the smallest necessary fixes/docs/tests if any, validate, and report upward.

## Mode Decision / Context Budget

- Mode: `direct`.
- Context budget: one root-node context window was sufficient because the prior audits narrowed Phase 1 to two concrete code gaps plus final checklist validation.
- Delegation/Codex decision: no additional code edits were needed during this pass, so Codex CLI was not invoked. If code edits had been required, Codex CLI would have been used per workspace rule.
- Branch-only lineage used: root Phase 1 hardening goal → local final audit/completion goal. Sibling/later Payin features were excluded except for accepted audit evidence already present in `.ratp/reports/`.

## Phase 1 Exit Checklist

Derived from `.ratp/reports/phase1-docs-model-audit.md`, `.ratp/reports/phase1-business-route-audit.md`, `.ratp/reports/phase1-service-seam-audit.md`, and the existing hardening upward report:

1. Open-facing business route handlers resolve a neutral `RuntimeContext` / `PaymentScope` at the route boundary rather than requiring caller-provided `X-Organization-ID`.
2. Converted business routes pass `RuntimeContext` / `PaymentScope` into `*ForRuntimeScope` seams or Open facades; they do not import/use legacy conversion helpers directly at route level.
3. Open runtime business operations use the default single-merchant payment scope when no authenticated organization id exists.
4. Cloud/hosted runtime still rejects scoped business operations when required organization context is missing.
5. Direct `organizationId` in audited business routes is absent except for the documented payment-link preview-token compatibility seam.
6. Legacy `organization_id` storage and lower-level raw-id APIs remain inside compatibility/service/repository seams; no Phase 1 repository migration or column rename is required.
7. The two concrete audit blockers are closed:
   - API key item routes `GET/PATCH/DELETE /api-keys/:id` use runtime-scope AuthManager methods.
   - Deposit unbind-by-reference uses a runtime-scope Manager seam.
8. Focused tests cover Open default-scope behavior and Cloud missing-context behavior for the changed route groups, plus service/manager seam unit behavior.
9. TypeScript validation passes for the Phase 1 surface.
10. Documentation/reporting captures the Phase 1 status, accepted compatibility seams, risks, and next step for review/merge.

## Result

Phase 1 exit checklist is satisfied by the current uncommitted implementation and reports. I found no remaining Phase 1 exit blocker requiring another code patch.

Key completion findings:

- API key create/list/item routes now use runtime-context seams consistently for the audited operations. Item `GET`, `PATCH`, and `DELETE` resolve `runtimeContext`, reject Cloud/no-context, and call `getApiKeyByIdForRuntimeScope`, `updateApiKeyForRuntimeScope`, and `revokeApiKeyForRuntimeScope`.
- AuthManager now constrains API-key item get/update/revoke by the resolved payment scope while preserving legacy `api_keys.organization_id` storage internally.
- Deposit unbind-by-reference now calls `unbindDepositAddressForRuntimeScope(runtimeContext, ...)`; omitted protocol is handled by the manager seam across the currently supported `evm` and `tron` protocols.
- Focused tests cover the previously missing API-key item and deposit-reference unbind paths in both Open and Cloud/no-context modes, plus AuthManager/ConfigurationManager compatibility seams.
- Audited business routes still have no direct route-level legacy conversion-helper or `X-Organization-ID` usage. The only audited route-level `organizationId` token remains the previously documented payment-link preview JWT compatibility seam.

## Evidence

### Files inspected / relevant changed files

- Existing audit and status reports:
  - `.ratp/reports/phase1-docs-model-audit.md`
  - `.ratp/reports/phase1-business-route-audit.md`
  - `.ratp/reports/phase1-service-seam-audit.md`
  - `.ratp/reports/phase1-runtime-scope-hardening-upward-report.md`
  - `.ratp/reports/phase1-ratp-parent-observation.md`
- Code/test files in current uncommitted diff:
  - `apps/api/src/routes/api-keys.ts`
  - `apps/api/src/routes/deposits.ts`
  - `packages/auth/src/auth-manager.ts`
  - `packages/manager/src/manager.ts`
  - `apps/api/tests/api-keys-runtime-context.test.ts`
  - `apps/api/tests/deposits-runtime-context.test.ts`
  - `packages/auth/tests/unit/api-key-runtime-scope.test.ts`
  - `packages/manager/tests/unit/order-runtime-scope.test.ts`

### Focused validation

Command:

```sh
npx vitest run apps/api/tests/api-keys-runtime-context.test.ts apps/api/tests/deposits-runtime-context.test.ts packages/auth/tests/unit/api-key-runtime-scope.test.ts packages/manager/tests/unit/order-runtime-scope.test.ts && npm run type-check
```

Result:

- Vitest: `Test Files  4 passed (4)`, `Tests  55 passed (55)`.
- Type-check: `tsc --build --pretty false packages/shared packages/monitor packages/processor packages/notification packages/email packages/manager packages/auth packages/test-utils apps/api` exited with code 0.
- Non-failing stderr/environment notes: Node `punycode` deprecation warnings and `bigint-buffer` native binding fallback.

### Route grep evidence

Command:

```sh
grep -RInE "runtimeContextToLegacyOrganizationId|paymentScopeToLegacyOrganizationId|resolveBusinessOrganizationId|organization_id|X-Organization-ID|x-organization-id" \
  apps/api/src/routes/orders.ts apps/api/src/routes/payment-links.ts apps/api/src/routes/deposits.ts \
  apps/api/src/routes/address-pool.ts apps/api/src/routes/transfers.ts apps/api/src/routes/api-keys.ts \
  apps/api/src/routes/notifications.ts apps/api/src/routes/api-payment-links.ts apps/api/src/routes/api-deposits.ts || true
```

Result: no matches.

Command:

```sh
grep -RIn "organizationId" \
  apps/api/src/routes/orders.ts apps/api/src/routes/payment-links.ts apps/api/src/routes/deposits.ts \
  apps/api/src/routes/address-pool.ts apps/api/src/routes/transfers.ts apps/api/src/routes/api-keys.ts \
  apps/api/src/routes/notifications.ts apps/api/src/routes/api-payment-links.ts apps/api/src/routes/api-deposits.ts || true
```

Result:

```text
apps/api/src/routes/payment-links.ts:644:          organizationId: manager.getPaymentLinkOrganizationIdForRuntimeScope(runtimeContext),
```

This matches the existing documented preview-token compatibility seam, not a new Phase 1 blocker.

### Seam grep evidence

- API-key item routes call scoped AuthManager seams:
  - `apps/api/src/routes/api-keys.ts:238` `getApiKeyByIdForRuntimeScope`
  - `apps/api/src/routes/api-keys.ts:316` `getApiKeyByIdForRuntimeScope`
  - `apps/api/src/routes/api-keys.ts:360` `updateApiKeyForRuntimeScope`
  - `apps/api/src/routes/api-keys.ts:430` `getApiKeyByIdForRuntimeScope`
  - `apps/api/src/routes/api-keys.ts:454` `revokeApiKeyForRuntimeScope`
- AuthManager scoped methods exist:
  - `packages/auth/src/auth-manager.ts:935` `getApiKeyByIdForRuntimeScope`
  - `packages/auth/src/auth-manager.ts:996` `updateApiKeyForRuntimeScope`
  - `packages/auth/src/auth-manager.ts:1050` `revokeApiKeyForRuntimeScope`
- Deposit unbind-by-reference calls the scoped Manager seam:
  - `apps/api/src/routes/deposits.ts:188` `unbindDepositAddressForRuntimeScope`
  - `packages/manager/src/manager.ts:2270` `unbindDepositAddressForRuntimeScope`

## Fit Check

- Matched checklist 1-4: Open runtime default-scope behavior and Cloud/no-context rejection are covered by focused API route tests for API keys and deposits; existing reports/tests cover the wider business route groups.
- Matched checklist 5: targeted grep found no direct legacy helper/header/storage tokens in audited business routes, and only the accepted payment-link preview-token `organizationId` compatibility claim.
- Matched checklist 6: current implementation keeps `organization_id` as an internal storage/compatibility detail in AuthManager/Manager/Processor/repositories, consistent with Phase 1 non-goals.
- Matched checklist 7-8: the two audit blockers are closed with route and seam tests.
- Matched checklist 9: focused type-check passed.
- Matched checklist 10: this report plus the existing audit/hardening reports give a coherent Phase 1 review packet.
- Drift check: no Phase 2+ overlay, repository migration, org-id column rename, or broad architecture refactor was introduced in this pass.

## Risks / Gaps

- The deposit unbind fan-out for omitted protocol is hard-coded to `evm` and `tron`; future protocol additions should centralize the supported-protocol list or update the seam.
- `api_keys.organization_id` and other repository/storage `organization_id` fields remain by design for Phase 1 compatibility; deeper neutral storage/model cleanup belongs to later phases.
- Payment-link preview tokens still carry an `organizationId` claim behind a manager compatibility seam; acceptable for Phase 1 but a future naming/contract cleanup candidate.
- A full test suite was not run. Focused tests and type-check are appropriate for this scoped Phase 1 completion pass because no broader failure signal appeared.

## Recommended Next Step

Promote the current Phase 1 branch/diff for human/code review and merge. After merge, open a follow-up for later-phase cleanup: centralize supported deposit protocols, harden preview-token naming behind a stable compatibility contract, and continue deeper manager/processor/repository neutralization without changing Phase 1 scope.
