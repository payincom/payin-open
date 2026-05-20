# RATP Upward Report: Order Policy + Event Seam

## Root Goal
Use Payin Open continuing development to validate/improve RATP while implementing a bounded, useful next Open architecture slice.

## Parent Goal / Linkage
The accepted next-phase discovery recommended a minimal Open-owned policy + domain-event/usage seam for `POST /api/v1/orders` because it exercises the Phase 2 route factory dependency system without drifting into full Cloud billing/entitlement/admin scope.

## Local Goal
Implement a minimal Open-owned policy and domain-event/usage seam for `POST /api/v1/orders` only, with allow-all/no-op Open defaults and injected test doubles, then run focused validation and report upward.

## Goal Lineage / Ancestor Context
`rootGoal → Use Payin Open continuing development to validate/improve RATP → ancestorGoal → After Phase 2 merge, choose next bounded Payin Open task; discovery accepted order policy/event seam → parentGoal → Implement the recommended bounded seam as a RATP test without scope drift → localGoal → Add minimal policy + event/usage seam for POST /api/v1/orders, validate, report.`

## Mode Decision and Context Budget
- Mode: `direct`, tool-assisted with Codex CLI for implementation per workspace rule; root node handled branch setup, validation, review, and reports.
- Direct/delegate rationale: estimated work (85k tokens; implementation slice about 60k + review/report about 25k) fit inside usable budget (120k), so no subagent delegation was needed. Codex CLI was used as the mandated coding tool, not as a separate OpenClaw subagent.
- contextWindowTokens: 200000
- usableContextTokens: 120000
- estimatedRequiredTokens: 85000
- contextBudgetSource: parent-provided runtime/session budget in delegation packet
- canCompleteInOneContextWindow: yes, with reserve preserved
- compact occurred: no
- Infrastructure incidents: `rg` was unavailable in shell; used `find | xargs grep` fallback. Codex shell also lacked `apply_patch`; Codex used file write/Python edits instead. Neither blocked completion.

## Result
Implemented the bounded order-create seam on branch `order-policy-event-seam` from `main` at `78af1a1 Add Phase 2 route composition seams (#7)`.

Default Open semantics remain unchanged: the default policy allows all order-create requests and the default sink is no-op. Injected dependencies can deny creation before the manager is resolved/called, and successful creation emits a neutral `order.created` envelope.

No PR was opened, no merge was performed, and no additional route groups were converted.

## Changed Files
- `apps/api/src/order-create-seam.ts` — new neutral contracts/defaults:
  - `OrderCreatePolicy`, `OrderCreatePolicyRequest`, `OrderCreatePolicyDecision`
  - `OrderCreateEventSink`, `OrderCreateEventEnvelope`
  - `allowAllOrderCreatePolicy`
  - `noOpOrderCreateEventSink`
- `apps/api/src/routes/orders.ts` — extends `OrdersRouteDependencies` with `orderCreatePolicy` and `orderCreateEventSink`; wires only the `POST /orders` handler.
- `apps/api/tests/orders-runtime-context.test.ts` — adds deny-policy and event-sink tests; existing default Open create test continues to prove allow-all preservation.
- `.ratp/reports/order-policy-event-seam-upward-report.md` — this report.
- `.ratp/reports/order-policy-event-seam-ratp-observation.md` — RATP behavior observation.

Existing untracked discovery reports remain present and were not removed:
- `.ratp/reports/next-phase-discovery-upward-report.md`
- `.ratp/reports/next-phase-ratp-test-plan.md`
- `.ratp/reports/next-phase-discovery-parent-evaluation.md`

## Evidence Map

### E1 — Repository baseline
- Branch: `order-policy-event-seam`
- Baseline HEAD: `78af1a1 Add Phase 2 route composition seams (#7)`
- Initial status before branch creation: `main...origin/main` with the three next-phase discovery reports untracked.
- Current branch status includes implementation changes plus the existing discovery reports and the two new RATP reports.

### E2 — Scope diff
- Runtime implementation is limited to:
  - `apps/api/src/order-create-seam.ts`
  - `apps/api/src/routes/orders.ts`
- Test coverage is limited to:
  - `apps/api/tests/orders-runtime-context.test.ts`
- No database migrations, repository/storage provider extraction, admin UI, pricing, billing, subscription, plan-limit, entitlement, or full overlay work was added.
- No route groups beyond order creation were converted; only the existing `createOrdersRoutes` dependency object was extended.

### E3 — Contract evidence
`apps/api/src/order-create-seam.ts` defines Open-owned neutral contracts/defaults:
- `OrderCreatePolicy.check(input)` returns `{ allowed: true }` by default via `allowAllOrderCreatePolicy`.
- `OrderCreateEventSink.record(envelope)` is a no-op by default via `noOpOrderCreateEventSink`.
- Envelope name is neutral domain language: `order.created`.
- Envelope includes `paymentScope`, optional `actor`, optional `requestId`, optional `source`, and created order `id`/`reference`.

### E4 — Route behavior evidence
`apps/api/src/routes/orders.ts`:
- `OrdersRouteDependencies` now accepts optional `orderCreatePolicy` and `orderCreateEventSink`.
- Defaults are selected in the route factory: allow-all policy and no-op event sink.
- `POST /orders` validates input and resolves runtime context before calling the policy.
- Deny path returns a 4xx JSON response and does not resolve/call the manager.
- Success path calls `manager.createOrderForRuntimeScope(runtimeContext, createRequest)` as before, enriches the response with the payment URL, then records `order.created`.
- `GET /orders`, `GET /orders/stats`, and `GET /orders/:id` were not functionally changed.

### E5 — Validation commands
All focused validation passed:

```text
npm run boundary:check
→ PayIn Open boundary check passed.

npx vitest run apps/api/tests/orders-runtime-context.test.ts
→ 1 test file passed; 12 tests passed.

npm run type-check
→ passed.

git diff --check
→ passed (no output; zero exit).
```

Warnings observed during Vitest were pre-existing/runtime dependency warnings and not test failures:
- Node `[DEP0040]` punycode deprecation warning.
- `bigint-buffer` pure JS fallback warning.

### E6 — Anti-drift grep
Commands run:

```text
grep -nEi "saas|subscription|billing|entitlement|plan limit|pricing|admin ui|cloud overlay" apps/api/src/order-create-seam.ts apps/api/src/routes/orders.ts
→ no matches in the checked forbidden scope phrase set.

git diff --unified=0 -- apps/api/src/order-create-seam.ts apps/api/src/routes/orders.ts \
  | grep '^+' | grep -v '^+++' | grep -nEi 'cloud|saas|billing|subscription|plan|entitlement|pricing|admin'
→ no matches in added runtime lines.
```

Result: no forbidden Cloud/SaaS scope terms were introduced in added runtime code.

### E7 — RATP behavior
- Branch-only lineage was maintained in this report and during implementation.
- Main Session remains supervisor-only; this subagent acted as RATP root node.
- Direct mode was chosen because usable budget (120k) exceeded estimated required budget (85k).
- Codex CLI was used for coding edits per workspace rule; no OpenClaw child subagent was spawned.
- Compact did not occur.
- Infrastructure issues were classified as non-blocking tool availability incidents with fallbacks (`rg` unavailable, shell `apply_patch` unavailable inside Codex).

## Fit Check
- Matches acceptance criteria: yes.
- Missing criteria: none known.
- Drift risk: low. Implementation is small, neutral, dependency-injected, and isolated to `POST /api/v1/orders` create behavior.
- Recommended parent decision: accept after supervisor diff review.

## Risks / Gaps
- Event sink failures currently propagate through the existing catch block and can make order creation return an error after manager success. This is conservative for a synchronous injected seam, but a future slice may want explicit best-effort/async sink semantics if product direction requires it.
- The default export `export default createOrdersRoutes()` captures allow-all/no-op defaults at module load, as intended for current Open behavior.
