# Phase 1 Runtime-Scope Hardening Upward Report

## Result
- Verified the current uncommitted implementation against this branch-only RATP lineage.
- API key `GET /api-keys/:id`, `PATCH /api-keys/:id`, and `DELETE /api-keys/:id` now resolve `RuntimeContext` at the route boundary and call runtime-scope AuthManager seams instead of legacy key-id-only methods.
- AuthManager now exposes scoped `getApiKeyByIdForRuntimeScope`, `updateApiKeyForRuntimeScope`, and `revokeApiKeyForRuntimeScope` methods that constrain legacy `api_keys.organization_id` access through the resolved runtime payment scope.
- `POST /deposits/unbind` by `depositReference` now calls `unbindDepositAddressForRuntimeScope`; omitted `protocol` is accepted and the manager seam unbinds all currently supported scoped protocol bindings (`evm`, `tron`).
- No additional code changes were needed after inspection and validation; the existing uncommitted implementation satisfied the targeted acceptance criteria.

## Evidence
- Focused runtime/API seam tests passed:
  - Command: `npx vitest run apps/api/tests/api-keys-runtime-context.test.ts apps/api/tests/deposits-runtime-context.test.ts packages/auth/tests/unit/api-key-runtime-scope.test.ts packages/manager/tests/unit/order-runtime-scope.test.ts`
  - Result: `Test Files  4 passed (4)` and `Tests  55 passed (55)`.
  - Noted stderr only environmental dependency warnings: Node `punycode` deprecation and `bigint-buffer` native binding fallback.
- TypeScript validation passed:
  - Command: `npm run type-check`
  - Result: `tsc --build --pretty false packages/shared packages/monitor packages/processor packages/notification packages/email packages/manager packages/auth packages/test-utils apps/api` exited successfully.
- Route and seam coverage inspected:
  - `apps/api/src/routes/api-keys.ts` resolves runtime context for item get/update/delete and rejects Cloud/no-context with `ORGANIZATION_CONTEXT_REQUIRED`.
  - `packages/auth/src/auth-manager.ts` scopes item get/update/delete by `apiKeyRuntimeScopeToOrganizationId(scope)` while preserving legacy `organization_id` storage compatibility.
  - `apps/api/src/routes/deposits.ts` validates optional `protocol` for unbind-by-reference and delegates to `manager.unbindDepositAddressForRuntimeScope(runtimeContext, ...)`.
  - `packages/manager/src/manager.ts` maps `OrderRuntimeScope` to legacy organization id inside the manager compatibility seam and fans omitted protocol out to `evm` and `tron`.

## Fit Check
- Acceptance criteria met: API key item routes use runtime-scope AuthManager methods; Open uses default single-merchant scope; Cloud without context remains rejected by focused tests.
- Acceptance criteria met: AuthManager scoped methods limit item operations by resolved payment scope and keep the legacy storage compatibility mapping internal to AuthManager.
- Acceptance criteria met: deposits unbind-by-reference uses a runtime-scope manager seam, accepts optional protocol, and unbinds supported protocols when omitted.
- Branch-only lineage was maintained: work stayed within the root/parent/local goals and did not broaden into sibling audit branches or unrelated Payin features.
- Behavior observation: the branch-only lineage helped avoid drift because it narrowed implementation to the two audited gaps. No missing ancestor goal created meaningful ambiguity, and no sibling context was needed beyond the existing local audit reports in `.ratp/reports`.

## Risks/Gaps
- The manager unbind fan-out is currently hard-coded to supported protocols `evm` and `tron`; future protocol additions must update this seam or centralize the supported-protocol list.
- API key storage still uses `organization_id`; this is intentionally preserved for Phase 1 compatibility, but deeper storage/model neutralization remains future work.
- Focused tests and type-check passed; a full suite was not run because the branch acceptance requested focused validation and no broader failure signal appeared.

## Recommended Next Step
- Promote this branch upward for review/merge, then consider a follow-up that centralizes supported deposit protocols so omitted-protocol unbind behavior automatically tracks future protocol support.
