# Phase 3 Open Runtime Profile Upward Report

## Goal Lineage

- `rootGoal`: PayIn Open becomes a complete, free, self-hostable single-tenant Open product and overlay-ready base core, while Cloud remains a future private overlay that composes Open without fork/copy.
- `ancestorContext`: Phase 1 RuntimeContext/PaymentScope merged; Phase 2 app/route composition merged; Phase 2.5 order/payment-link seams merged; do not implement Cloud overlay or Cloud-only concepts in Open.
- `parentGoal`: Start Phase 3 with a bounded Open self-hosted runtime profile slice.
- `parentGoalLinkage`: serves the human-approved Open/Cloud execution plan in `docs/open-cloud-execution-plan.md`, Phase 3 — Open self-hosted runtime profile.
- `localGoal`: inspect current self-hosting scripts/docs/runtime reporting, implement the smallest valuable Phase 3 slice clarifying Open runtime profile and safe local operator semantics, validate, and report upward.
- `contextWindowTokens`: 200000 fallback/parent.
- `usableContextTokens`: 120000.
- `estimatedRequiredTokens`: 50000-70000.
- `contextBudgetSource`: parent/fallback.
- `modeDecision`: direct implementation after inspection confirmed a small docs/scripts/runtime-profile slice fit in one window.

## Acceptance Criteria / Non-goals

- Created/used fresh branch: `phase3-open-runtime-profile`.
- Inspected the required files before editing: `docs/open-cloud-execution-plan.md`, `docs/self-hosting/*`, `scripts/open/open-doctor.ts`, `scripts/open/open-init.ts`, `scripts/open/open-smoke.ts`, `scripts/open/ops-lib.ts`, `apps/api/src/open-runtime.ts`, and package scripts.
- Preserved default behavior: no auth, route, database, bootstrap, production mutation, or runtime behavior was changed.
- Non-goals honored: no `/data/openclaw/workspace/payin` modifications; no `payin-cloud-overlay`; no Cloud billing/subscription/plan enforcement/usage pricing/admin UI; no hosted org/member/role management; no DB schema migration; no broad repository extraction; no requirement for Open business API callers to pass organization ids.

## Slice Chosen

- Added a shared Open runtime posture check/report in `scripts/open/ops-lib.ts`.
- Wired the shared posture checks into `open:doctor`, `open:init -- --check`, and `open:smoke` output paths.
- Kept runtime behavior unchanged: the slice is reporting/docs/tests only.

## Changes

- `scripts/open/ops-lib.ts`
  - Added `DEFAULT_OPEN_MERCHANT_SCOPE_ID` and `resolveOpenMerchantScopeId` for ops messaging.
  - Added `collectOpenRuntimePostureChecks` covering:
    - Open single-tenant self-hosted runtime profile;
    - default local merchant scope;
    - API-key behavior with no `X-Organization-ID` for business API key calls;
    - JWT operator caveat requiring verified local operator membership and `X-Organization-Id`;
    - safe production admin posture with no default production admin promotion.
  - Included posture checks in `collectOpenDoctorChecks` so `open:doctor` and `open:init` share the same report.
- `scripts/open/open-smoke.ts`
  - Added the same shared posture checks to smoke output, including dry-run mode.
- `tests/open-ops.test.ts`
  - Added focused coverage for the shared runtime/operator posture report.
  - Extended non-Open runtime failure coverage to include `runtime.profile`.
- `docs/self-hosting/agent-operations.md`
  - Documented the new runtime posture checks in the `open:doctor` checklist.
  - Clarified production readiness expects first local operator/bootstrap only, with no default production admin promotion.

## Evidence

- `open:doctor` now reports Open single-tenant self-hosted profile, default merchant scope, API-key scope behavior, JWT operator caveat, and production admin posture before existing readiness checks.
- `open:init -- --check` inherits the same posture report through `collectOpenDoctorChecks`.
- `open:smoke` reports the same posture in safe dry-run mode before live smoke checklist items.
- API-key header construction remains unchanged and tests still assert it does not emit `X-Organization-ID`.

## Validation Results

- `npm test -- tests/open-ops.test.ts` — passed, 12 tests.
- `npm run open:doctor` — passed with expected non-strict warnings for missing local DB/secrets/live URL.
- `npm run open:init -- --check` — passed with expected non-strict warnings for missing local DB/secrets.
- `npm run open:smoke` — passed in dry-run mode with expected warning for missing `--url`.
- `npm run type-check` — passed.
- `npm run boundary:check` — passed.
- `git diff --check` — passed.

## Risks / Gaps

- The posture report is informational except for non-Open runtime profile detection; it intentionally does not enforce new production policy beyond existing command behavior.
- `open:doctor` still reports missing DB/secrets/live URL as non-strict warnings by design.
- The JWT operator caveat remains tied to existing auth middleware semantics; no auth migration or operator automation was added in this slice.

## Fit Check

- Fits Phase 3 by making local setup/admin/operator semantics clearer in existing Open ops commands and docs.
- Preserves default behavior and avoids new public Cloud/SaaS concepts.
- Keeps Open single-tenant self-hosted messaging explicit without adding organization/member/role management surfaces.
- Does not touch `/data/openclaw/workspace/payin`.

## Recommended Next Step

- Open a PR for this bounded slice.
- Follow-up: add a focused Open runtime auth doc/example for creating the first local operator and then using a business API key without `X-Organization-ID`, if operators need a copy-paste runbook beyond the existing self-hosting docs.
