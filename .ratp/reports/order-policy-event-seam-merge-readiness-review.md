# Merge Readiness Review — Order Policy + Event Seam

## Decision

**REVISION_APPLIED** — merge-ready after a small review-time fix.

The branch is ready for commit/PR from this review node's perspective. I found one small behavioral blocker: an injected `orderCreateEventSink` failure could make `POST /api/v1/orders` return failure after the manager had already created the order. I applied the smallest fix with Codex CLI: event recording is now best-effort/no-throw, with focused regression coverage.

## Node Packet / RATP Fit

- **rootGoal:** Use Payin Open continuing development to validate/improve RATP while implementing a bounded order-create policy/event seam.
- **parentGoal / linkage:** Implementation delivered and parent validation accepted; this node determines merge readiness or applies a small clear revision.
- **localGoal:** Review current diff and reports for merge readiness; fix a small blocker if clear; write this report.
- **goalLineage:** `rootGoal → discovery selected minimal POST /api/v1/orders policy + event seam → implementation delivered and parent validation accepted → merge-readiness review`.
- **contextWindowTokens:** 200000
- **usableContextTokens:** 120000
- **estimatedRequiredTokens:** 40000
- **contextBudgetSource:** parent/runtime delegation packet
- **mode:** `direct`, with Codex CLI for the bounded code/test fix per workspace coding rule.
- **canCompleteInOneContextWindow:** yes; review + small fix + validation fit comfortably within 120k usable tokens.
- **compact occurred:** no.

## Revision Applied

### Problem

Before this review fix, `apps/api/src/routes/orders.ts` awaited `orderCreateEventSink.record(...)` inside the outer order-create `try` block. If an injected sink threw/rejected, the handler would enter the generic create-order catch path and return a failure response even though `manager.createOrderForRuntimeScope(...)` had already succeeded.

That is a merge-readiness blocker for this minimal Open seam because it can trigger duplicate client retries after a real order has been created. Since the seam is default no-op and not yet a durable Cloud billing/entitlement mechanism, event recording should not change the order-create success semantics.

### Fix

- `apps/api/src/routes/orders.ts`
  - Wrapped `orderCreateEventSink.record(...)` in a local `try/catch`.
  - Sink failures now log `console.warn('Failed to record order-created event:', eventError)` and do not enter the outer order-create failure path.
- `apps/api/tests/orders-runtime-context.test.ts`
  - Added regression coverage: a throwing injected `orderCreateEventSink` still returns `201`, returns created order data, calls the manager, calls the sink once, and logs the warning.

## Diff / Scope Review

Tracked runtime/test changes remain bounded to:

- `apps/api/src/order-create-seam.ts` — new untracked seam contracts/defaults: allow-all policy, no-op event sink, neutral `order.created` envelope.
- `apps/api/src/routes/orders.ts` — wires optional policy and event sink only in `POST /orders`; review-time fix makes event sink best-effort.
- `apps/api/tests/orders-runtime-context.test.ts` — focused tests for default behavior, deny policy, successful event envelope, and throwing event sink.

Expected untracked report files are present:

- `.ratp/reports/next-phase-discovery-upward-report.md`
- `.ratp/reports/next-phase-ratp-test-plan.md`
- `.ratp/reports/next-phase-discovery-parent-evaluation.md`
- `.ratp/reports/order-policy-event-seam-upward-report.md`
- `.ratp/reports/order-policy-event-seam-ratp-observation.md`
- `.ratp/reports/order-policy-event-seam-parent-evaluation.md`
- `.ratp/reports/order-policy-event-seam-merge-readiness-review.md` (this report)

No conflict markers were found in the target runtime/test files or expected RATP reports.

## Drift Review

No Cloud billing/subscription/plan/admin/entitlement implementation drift was found.

Evidence:

```text
git diff --unified=0 -- apps/api/src/order-create-seam.ts apps/api/src/routes/orders.ts \
  | grep '^+' | grep -v '^+++' \
  | grep -nEi 'cloud|saas|billing|subscription|plan|entitlement|pricing|admin'
→ no matches
```

The seam remains neutral and Open-owned:

- Default policy: allow all.
- Default sink: no-op.
- Injected deny path: stops before manager resolution/call.
- Injected event path: records after manager success, best-effort.
- No admin UI, migrations, billing, pricing, subscriptions, plan limits, entitlements, or Cloud overlay implementation added.

## Report Review

The expected discovery/implementation/parent reports exist and include context-budget / compact notes. Examples verified:

- Discovery upward report includes `contextWindowTokens=200000`, `usableContextTokens=120000`, `estimatedRequiredTokens`, `contextBudgetSource`, and a no-compaction/direct-or-delegate rationale.
- RATP test plan includes explicit context budget policy and compact avoidance guidance.
- Implementation upward report includes `contextWindowTokens=200000`, `usableContextTokens=120000`, `estimatedRequiredTokens=85000`, `contextBudgetSource`, `canCompleteInOneContextWindow`, and `compact occurred: no`.
- RATP observation includes the same budget and compact notes.
- Parent evaluation notes direct mode and no compact.

Staleness note: the pre-review implementation upward report and parent evaluation correctly identified the event-sink propagation risk as a review item. This merge-readiness report supersedes that risk after applying the best-effort/no-throw fix and rerunning validation.

## Validation

Validation after the review-time code change:

```text
npm run boundary:check
→ passed: PayIn Open boundary check passed.

npx vitest run apps/api/tests/orders-runtime-context.test.ts
→ passed: 1 test file, 13 tests.

npm run type-check
→ passed.

git diff --check
→ passed: no output.

anti-drift grep over added runtime lines
→ passed: no matches.
```

Observed non-failing warnings during Vitest remain benign/runtime-preexisting:

- Node `[DEP0040]` `punycode` deprecation warning.
- `bigint-buffer` pure JS fallback warning.

## Fit Check

- **Acceptance criteria matched:** yes.
- **Small blocker found and fixed:** yes, event sink failure no longer changes order-create response after manager success.
- **Default Open behavior preserved:** yes, allow-all/no-op defaults remain; focused tests still pass.
- **Deny/event paths covered:** yes, including deny-before-manager, success event envelope, and throwing sink best-effort behavior.
- **Scope drift:** low; implementation remains limited to `POST /api/v1/orders` route seam.
- **Infrastructure status:** no infrastructure block. Codex CLI completed the revision and validations; direct validation rerun passed aside from the intentionally separated anti-drift command after a shell snippet issue.

## Recommendation

Proceed to commit/PR preparation after supervisor approval. Include this merge-readiness report with the branch evidence, and note the review-time best-effort event-sink revision in the PR summary.
