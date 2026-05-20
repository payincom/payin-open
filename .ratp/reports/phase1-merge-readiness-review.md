# Phase 1 Merge Readiness Review

## Decision

accepted

The current uncommitted Phase 1 diff is merge-ready for human/code review. I found no clear Phase 1 merge blocker and made no code changes.

## Root Goal

Complete Payin Open Phase 1 RuntimeContext / PaymentScope hardening so Open runtime business operations do not require `X-Organization-ID`, Cloud behavior remains scoped, and the Phase 1 diff is ready for human/code review and merge.

## Parent Goal / Linkage

Previous RATP root completion accepted Phase 1 as functionally complete. This review node serves the parent goal of moving from validated complete to merge-ready quality.

## Local Goal

Audit the current uncommitted diff and RATP reports for merge readiness: scope cleanliness, accidental files, test/doc coherence, naming consistency, and reviewer-facing summary.

## Mode Decision / Context Budget

- Mode: `direct`.
- Context budget: one review context was sufficient because the parent supplied accepted validation evidence and the remaining work was a focused diff/report hygiene audit.
- Implementation decision: no blocker was found, so Codex CLI was not invoked and no code patch was made.

## Files Inspected

### Git status / changed files

`git status --short` showed only these tracked Phase 1 code/test files plus untracked `.ratp` reports:

- `apps/api/src/routes/api-keys.ts`
- `apps/api/src/routes/deposits.ts`
- `apps/api/tests/api-keys-runtime-context.test.ts`
- `apps/api/tests/deposits-runtime-context.test.ts`
- `packages/auth/src/auth-manager.ts`
- `packages/auth/tests/unit/api-key-runtime-scope.test.ts`
- `packages/manager/src/manager.ts`
- `packages/manager/tests/unit/order-runtime-scope.test.ts`
- `.ratp/reports/*.md`

`git diff --stat` showed 8 tracked files changed, `413 insertions(+), 7 deletions(-)`, all within the Phase 1 code/test surface above.

`git ls-files --others --exclude-standard` showed only `.ratp/reports/` files:

- `phase1-business-route-audit.md`
- `phase1-completion-upward-report.md`
- `phase1-docs-model-audit.md`
- `phase1-parent-evaluation-2.md`
- `phase1-ratp-behavior-observation-2.md`
- `phase1-ratp-parent-observation.md`
- `phase1-runtime-scope-hardening-upward-report.md`
- `phase1-service-seam-audit.md`

No accidental editor/temp/build artifacts were present in the untracked set.

### Reports reviewed

- `.ratp/reports/phase1-completion-upward-report.md`
- `.ratp/reports/phase1-parent-evaluation-2.md`
- Report directory listing for related Phase 1 audit/observation files.

## Diff Hygiene Findings

- Scope cleanliness: the tracked diff is limited to the two accepted Phase 1 blocker areas and their tests:
  - API key item `GET/PATCH/DELETE` runtime-scope hardening.
  - Deposit unbind-by-reference runtime-scope hardening.
  - AuthManager/ConfigurationManager compatibility seams and focused tests.
- Accidental files: none found. The only untracked files are `.ratp/reports/*.md`, which are expected RATP evidence/report files.
- Naming consistency: the new `*ForRuntimeScope` method names are consistent with existing Phase 1 seam naming (`listApiKeysForRuntimeScope`, `bindDepositAddressForRuntimeScope`, etc.). Comments clearly label current `organization_id` usage as compatibility/storage seam behavior.
- Broad refactor risk: no broad unrelated refactor, repository migration, column rename, Phase 2+ overlay work, or unrelated route churn appears in the diff.
- Whitespace/check hygiene: `git diff --check` returned cleanly.

## Reviewer Blocker Check

No reviewer-facing blocker found.

Specific checks:

- API key item routes now resolve `runtimeContext`, keep Cloud/no-context rejection, and call scoped AuthManager seams:
  - `getApiKeyByIdForRuntimeScope`
  - `updateApiKeyForRuntimeScope`
  - `revokeApiKeyForRuntimeScope`
- API key ownership checks remain present after scoped lookup.
- AuthManager scoped methods constrain get/update/delete by `organization_id = resolved runtime payment scope` while keeping legacy storage internal.
- Deposit unbind-by-reference now calls `unbindDepositAddressForRuntimeScope(runtimeContext, ...)` instead of passing a raw legacy organization id at route level.
- Omitted deposit unbind protocol is intentionally handled in the manager seam by fan-out to currently supported `evm` and `tron`; unsupported protocol validation remains at the route boundary.
- Tests directly cover the changed behavior:
  - Open default single-merchant scope for API key get/update/revoke.
  - Cloud missing-context rejection for API key get.
  - Open runtime-scope seam call for deposit unbind-by-reference.
  - Cloud missing-context rejection for deposit unbind-by-reference.
  - Unit coverage for AuthManager API-key get/update/revoke runtime-scope seams.
  - Unit coverage for ConfigurationManager deposit unbind runtime-scope fan-out.
- Existing report claims are coherent with the diff and accepted validation evidence. I found no stale claim contradicted by the current code in the reports reviewed.

## Validation Evidence

I did not rerun the full focused Vitest/type-check validation because no blocker or suspicious broad change appeared during review and the parent supplied accepted shared evidence that the focused suite and type-check passed twice.

Accepted shared validation evidence from parent context:

```sh
npx vitest run apps/api/tests/api-keys-runtime-context.test.ts apps/api/tests/deposits-runtime-context.test.ts packages/auth/tests/unit/api-key-runtime-scope.test.ts packages/manager/tests/unit/order-runtime-scope.test.ts
```

Result: 4 files / 55 tests passed.

```sh
npm run type-check
```

Result: passed.

Additional lightweight review validation run in this node:

```sh
git diff --check
```

Result: passed with no whitespace/conflict-marker issues.

## Remaining Non-blocking Risks

- Deposit unbind fan-out for omitted protocol is hard-coded to `evm` and `tron`; future protocols should centralize/update this list.
- `organization_id` remains the compatibility storage field inside lower-level seams by Phase 1 design; deeper neutral storage/model naming belongs to later phases.
- Payment-link preview-token `organizationId` compatibility remains documented as accepted Phase 1 behavior and should be revisited in a later cleanup.
- Full suite was not run in this review node; focused validation and type-check have already passed twice and are proportionate to this scoped diff.

## Suggested Commit Message

```text
Harden Phase 1 runtime-scope API key and deposit operations
```

Optional body:

```text
- Scope API key item get/update/revoke through RuntimeContext-aware AuthManager seams
- Route deposit unbind-by-reference through a RuntimeContext-aware manager seam
- Preserve Cloud missing-organization rejection while allowing Open default single-merchant scope
- Add focused route and unit coverage for the Phase 1 hardening gaps
- Record RATP Phase 1 audit/completion/merge-readiness reports
```

## Suggested PR Summary

```md
## Summary
- Hardened remaining Phase 1 API-key item operations to use RuntimeContext/PaymentScope-aware seams.
- Hardened deposit unbind-by-reference to use a RuntimeContext-aware manager seam while preserving existing Open/Cloud behavior.
- Added focused route and unit tests for Open default-scope behavior, Cloud missing-context rejection, and compatibility seam scoping.
- Included RATP audit/completion/merge-readiness reports for reviewer traceability.

## Validation
- npx vitest run apps/api/tests/api-keys-runtime-context.test.ts apps/api/tests/deposits-runtime-context.test.ts packages/auth/tests/unit/api-key-runtime-scope.test.ts packages/manager/tests/unit/order-runtime-scope.test.ts
- npm run type-check
- git diff --check
```

## RATP Behavior Observation

- Branch-scoped behavior: this node stayed within `root Phase 1 hardening goal → parent merge-readiness goal → local diff/report hygiene review` and did not expand into Phase 2+ work.
- Direct mode was appropriate: the task fit a single context and required review/reporting only; no delegation was needed.
- Protocol friction: `rg` was unavailable in the environment, but `grep` fallback worked. No infrastructure blocker resulted.

## Recommended Next Step

Proceed to human/code review and merge preparation. Do not add more Phase 1 code unless human review identifies a concrete blocker; track protocol centralization, preview-token naming, and deeper storage neutralization as later-phase follow-ups.
