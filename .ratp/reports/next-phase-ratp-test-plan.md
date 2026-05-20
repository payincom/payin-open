# Next-Phase RATP Test Plan — Order Policy/Event Seam

## Test objective

Use the next Payin Open implementation slice as a focused RATP dogfood:

> Implement a minimal Open-owned policy and domain-event/usage seam for `POST /api/v1/orders`, with allow-all/no-op Open defaults and injectable test doubles through the Phase 2 route factory dependency system.

This is intentionally not a full Phase 3/4 implementation. It is a bounded seam slice that should reveal whether RATP can preserve scope, manage context budgets, require evidence, and avoid drift into Cloud billing/admin/UI scope.

## Branch-only goal lineage for the next run

```text
rootGoal → Use Payin Open continuing development to validate/improve RATP.
parentGoal → After Phase 2 merge, implement the recommended next bounded Payin Open task and observe RATP behavior.
localGoal → Add the minimal order-create policy/event seam through Phase 2 route composition while preserving Open behavior and excluding Cloud implementation scope.
```

Every child node should receive only this branch lineage plus accepted shared constraints. Do not include sibling candidate tasks from discovery unless needed as explicit non-goals.

## Context budget policy

- **contextWindowTokens:** 200000.
- **Default reserve:** 40% for system/history/tool outputs/synthesis.
- **usableContextTokens:** 120000.
- **contextBudgetSource:** runtime/parent unless a future `session_status` reports a different value.
- **Compact avoidance:** Split by natural function (contract, route integration, validation, review) if implementation evidence begins to exceed ~70k tokens or if file diffs become broad. Avoid relying on compaction; if compaction is unavoidable, write a checkpoint report before continuing.
- **Evidence storage:** Keep large command output summarized in reports. Use targeted grep/sed/read snippets rather than dumping full files.

## Recommended RATP tree

### Depth -1 — Main Session supervisor

- **Role:** supervisor-only; not a work node.
- **Goal:** preserve the human objective and evaluate the root node's upward report.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 15000.
- **contextBudgetSource:** runtime.
- **Mode rationale:** supervisor/evaluator only.
- **Acceptance criteria:** accepts/rejects/revisions root report based on evidence; does not implement code directly.

### Depth 0 — Root implementation node

- **Goal:** Implement and validate the bounded order-create policy/event seam.
- **Mode:** `delegate` if nested subagents are available; otherwise `direct` with Codex leaf and explicit internal checkpoints.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 70000.
- **contextBudgetSource:** runtime/parent.
- **Direct/delegate rationale:** The task can fit in one context window, but delegation is useful because independent contract/integration/validation review creates better evidence and prevents scope drift. If `maxSpawnDepth` blocks children, the root must still preserve the same node packet/checklist locally.
- **Pass criteria:** implementation diff is bounded; validation passes; reports are written; no Cloud logic or broad provider extraction is introduced.
- **Fail criteria:** missing evidence, broad scope drift, unhandled validation failures, or no upward report.

### Depth 1a — Contract design/implementation node

- **Goal:** Create the smallest neutral Open-owned policy and event/usage contracts with allow-all/no-op defaults.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 25000.
- **contextBudgetSource:** runtime/parent.
- **Mode:** `direct`.
- **Direct/delegate rationale:** Small type/API surface; no need to split further.
- **Acceptance criteria:**
  - Defines policy decision/result shape and default allow-all implementation.
  - Defines event/usage envelope and no-op sink.
  - Envelope can carry `RuntimeContext`/`paymentScope`, actor, request id/source where available, operation, and resource identifiers.
  - Names are Open-owned/neutral, not `CloudBilling*` or SaaS-specific.
  - Exports compile and are usable by API route code.
- **Non-goals:** no Cloud implementation, no pricing/plan fields, no all-route operation catalogue unless minimal names are required for order creation.
- **Evidence required:** changed file list, key exported type names, focused test/typecheck output or explanation if tests live in route node.

### Depth 1b — Orders route integration node

- **Goal:** Integrate policy check and post-success event emission into `POST /api/v1/orders` only via `createOrdersRoutes(deps)`.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 35000.
- **contextBudgetSource:** runtime/parent.
- **Mode:** `direct`.
- **Direct/delegate rationale:** One route operation and one dependency object.
- **Acceptance criteria:**
  - `OrdersRouteDependencies` accepts optional policy/event dependencies with safe defaults.
  - Default Open behavior stays equivalent when no dependencies are passed.
  - Denied policy returns a stable non-2xx response before `manager.createOrderForRuntimeScope` is called.
  - Successful order creation emits exactly one event/usage envelope to injected sink.
  - No other route groups are converted in this task.
- **Non-goals:** no route-wide SaaS entitlement layer, no repository/provider extraction, no schema migration.
- **Evidence required:** code diff summary, test names/assertions, grep confirming no unrelated route files changed unless justified.

### Depth 1c — Validation/evidence node

- **Goal:** Independently validate behavior and anti-drift constraints.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 30000.
- **contextBudgetSource:** runtime/parent.
- **Mode:** `direct`.
- **Direct/delegate rationale:** Evidence-gathering can be independent from implementation.
- **Acceptance criteria:**
  - Focused Vitest command for order route tests passes.
  - `npm run type-check` passes.
  - `npm run boundary:check` passes.
  - `git diff --check` passes.
  - Scope-guard grep is run on touched files for forbidden Cloud/SaaS terms.
  - Validation logs distinguish benign warnings from failures.
- **Non-goals:** do not run destructive DB/live commands; do not require full `open:verify` unless parent explicitly asks.
- **Evidence required:** exact commands, summarized pass/fail counts, stderr warning classification.

### Depth 1d — RATP observation/review node

- **Goal:** Produce the upward report and RATP behavior observation for the root to evaluate.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 20000.
- **contextBudgetSource:** runtime/parent.
- **Mode:** `direct`.
- **Direct/delegate rationale:** Review/reporting is compact and should stay close to parent evaluation.
- **Acceptance criteria:**
  - Writes `.ratp/reports/order-policy-event-seam-upward-report.md`.
  - Writes `.ratp/reports/order-policy-event-seam-ratp-observation.md`.
  - Maps each acceptance criterion to evidence.
  - Explicitly states accepted/rejected scope decisions.
  - Recommends `accept`, `revision`, `reject`, or `infrastructure_blocked` with reason.
- **Non-goals:** do not open PR; do not merge; do not continue to next route group.
- **Evidence required:** report paths, validation references, fit check.

## Required evidence map for the next run

Use criterion-level evidence IDs in the upward report:

- **E1 Repository baseline:** branch/status/head before edits.
- **E2 Scope diff:** changed file list and diff stat.
- **E3 Contract evidence:** exported types/defaults and compile evidence.
- **E4 Route behavior evidence:** tests for default allow-all, denial, and event emission.
- **E5 Validation commands:** exact focused Vitest, type-check, boundary check, diff-check commands and results.
- **E6 Anti-drift grep:** forbidden Cloud/SaaS term scan and explanation for any expected hits.
- **E7 RATP behavior:** direct/delegate decision, context use estimate, compact avoidance outcome, infrastructure incidents.

## Scope guard grep convention

Run a focused command similar to:

```bash
grep -RInE "plan_type|monthly_order_limit|billing|subscription|CloudBilling|SaaS|customer plan|pricing|metering implementation" \
  apps/api/src/routes/orders.ts packages/shared/src packages/processor/src packages/manager/src --include="*.ts" || true
```

Interpretation:

- Neutral words such as `usage` or `event` may appear in contract names, but the implementation must not enforce SaaS pricing/plans.
- Any `billing`, `subscription`, `plan_type`, or `monthly_order_limit` addition in touched runtime code should trigger revision unless it appears only in an explicit non-goal comment/doc and is justified.

## Lifecycle endpoint

The next RATP run should stop at **merge-ready implementation evidence**, not at a full Cloud overlay milestone:

1. Baseline confirmed.
2. Implementation completed on a branch or clean working tree.
3. Focused validation passed.
4. Upward report and RATP behavior observation written.
5. Parent/supervisor evaluates and decides whether to open PR.

Do **not** proceed automatically to:

- converting more route groups;
- implementing Cloud entitlements/billing;
- extracting repository providers;
- opening/merging PR;
- creating a private Cloud overlay repository.

## Expected RATP observations to capture

- Did branch-only lineage prevent drift from a neutral Open port into Cloud billing logic?
- Did Phase 2 route factories make integration smaller than pre-Phase-2 edits would have been?
- Was the task small enough for direct execution, or did contract/integration/review split materially improve quality?
- Were evidence IDs enough for parent evaluation without rereading full diffs?
- Did scope-guard grep catch or overflag anything?
- Did any infrastructure/tool issue require `infrastructure_blocked` handling?

## Parent evaluation checklist

The parent should request revision if any are true:

- The implementation changes more than one route group without explicit approval.
- Policy/event contracts contain Cloud-specific billing/subscription/plan semantics.
- Default Open order creation behavior changes for normal allow-all mode.
- Denial policy is not tested.
- Event sink emission is not tested.
- `type-check`, `boundary:check`, or focused tests fail without a true infrastructure blocker.
- Reports are missing criterion-level evidence.

The parent can accept if all are true:

- Code diff is bounded and neutral.
- Tests prove default allow-all, denial, and event emission behavior.
- Validation passes.
- No forbidden Cloud scope was introduced.
- Upward report and RATP observation are complete enough for PR decision.
