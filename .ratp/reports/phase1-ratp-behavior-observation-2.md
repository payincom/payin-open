# RATP Behavior Observation 2: Payin Open Phase 1 Completion Pass

## Context

This observation covers the RATP root-node completion pass for Payin Open Phase 1 RuntimeContext / PaymentScope hardening.

- Root goal: complete Phase 1 so Open runtime business operations do not require `X-Organization-ID`, Cloud behavior remains scoped, and docs/code/tests are reviewable.
- Local goal: inspect current uncommitted implementation and audit reports, identify remaining Phase 1 blockers, patch only if necessary, validate, and report upward.
- Mode chosen: `direct`.

## Branch-only lineage behavior

Branch-only lineage worked well in this pass. The node used only:

```text
root Phase 1 hardening goal → local final audit/completion goal
```

Accepted shared evidence from earlier audits was used because it directly constrained this branch. Sibling/later Payin work was not pulled in. This reduced drift: the final checklist stayed focused on route/runtime-scope seams, Open default-scope behavior, Cloud scoped rejection, accepted storage compatibility boundaries, the two known code gaps, focused tests, and review documentation.

## Direct vs delegate decision

Direct mode was appropriate:

- The remaining task was a bounded audit/validation/reporting pass.
- Prior audits had already decomposed the work into concrete exit criteria.
- Existing uncommitted implementation already appeared to close the two code blockers.
- No new code edits were required, so invoking a Codex leaf worker would have added overhead without improving isolation or evidence.

If the pass had found a code blocker, the next step should have been a Codex CLI implementation leaf because workspace rules require Codex for programming edits.

## Infrastructure / retry behavior

- Required infrastructure used successfully: shell, git, grep, npm/vitest, and TypeScript build.
- Validation command completed successfully on the first try:

```sh
npx vitest run apps/api/tests/api-keys-runtime-context.test.ts apps/api/tests/deposits-runtime-context.test.ts packages/auth/tests/unit/api-key-runtime-scope.test.ts packages/manager/tests/unit/order-runtime-scope.test.ts && npm run type-check
```

- Result: 4 Vitest files / 55 tests passed; `npm run type-check` exited 0.
- Non-failing noise: Node `punycode` deprecation warnings and `bigint-buffer` native binding fallback.
- No infrastructure_blocked condition occurred in this pass.
- `rg` was not assumed; grep was sufficient for route evidence, matching the node packet fallback policy.

## Drift risks observed

- Phase creep risk: audit reports mention deeper manager/processor/repository neutralization. Treating those as Phase 1 exit blockers would incorrectly expand into later phases. The checklist explicitly kept repository/storage `organization_id` compatibility as allowed.
- Naming-cleanup risk: payment-link preview token still contains an `organizationId` claim. It is documented as an accepted compatibility seam for Phase 1, not a blocker.
- Test-scope risk: running the full suite could consume more time without direct evidence of need. Focused tests plus type-check were enough for the scoped completion goal.
- Implementation ownership risk: existing uncommitted work was created before this root-node pass. The root node therefore emphasized independent inspection and validation rather than claiming new code authorship.

## What RATP did well

- The required Phase 1 exit checklist converted scattered audit reports into pass/fail review criteria.
- Upward reporting forced a clean separation between product/code result, evidence, fit check, risks, and next step.
- Branch-only lineage prevented unrelated Payin features and later Open/Cloud overlay work from entering the completion criteria.
- Infrastructure honesty was improved versus earlier attempts: no hidden retry/failure occurred, and the report distinguishes successful validation from non-failing environment warnings.

## What should improve next

1. RATP should make "existing implementation validation" a first-class mode distinct from implementation work. This pass mostly evaluated existing uncommitted code and wrote review evidence.
2. Reports should reference checklist item numbers in evidence tables by default; this would make parent evaluation faster.
3. Durable RATP state/linkage should be used when available instead of file-only convention, so parent acceptance can sync reports without manual path inspection.
4. Delegation packets should continue to state explicit infrastructure retry policy and `rg`→`grep/find` fallback; this pass benefited from that clarity.
5. When prior work exists outside the current root-node execution, reports should clearly say "validated existing uncommitted implementation" rather than implying the node authored all changes.

## Summary Judgment

RATP behavior was healthy for this completion pass. The node stayed branch-scoped, chose direct mode appropriately, avoided unnecessary implementation/delegation, validated with focused evidence, and produced an upward report that should be straightforward for the main supervisor to evaluate.
