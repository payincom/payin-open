# Next-Phase Discovery Upward Report — Payin Open after Phase 2

## Root / parent / local goal lineage

- **rootGoal:** Use Payin Open continuing development to validate/improve RATP.
- **parentGoal:** After Phase 2 merge, choose the next Payin Open task that is useful, bounded, and good for RATP observation.
- **localGoal:** Inspect docs/current code after Phase 2, identify viable next-phase task candidates, compare them, recommend one implementation-sized task for the next RATP run, and produce a context-budgeted task plan.

## Mode decision and context budget

- **Mode:** `direct` discovery node.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 45000.
- **contextBudgetSource:** runtime from parent `session_status`; usable budget set by 40% reserve policy.
- **Rationale:** discovery requires reading docs/code and synthesizing options. Estimated evidence and synthesis are comfortably inside 120k usable tokens, and this subagent is already depth-limited (`depth 1/1`), so further delegation is neither necessary nor available.
- **Infrastructure note:** `rg` was not installed (`bash: line 3: rg: command not found`), so I retried safely with `grep/find`, which succeeded.

## Repository state confirmed

From `/data/openclaw/workspace/payincom/payin-open` before writing these reports:

```text
## main...origin/main
```

Recent history:

```text
78af1a1 Add Phase 2 route composition seams (#7)
68509dc Merge pull request #6 from payincom/phase1-runtime-scope-hardening
09a0b80 Harden Phase 1 runtime-scope API key and deposit operations
a852258 feat: add Open runtime context seams
a886d17 chore: extract PayIn CLI to standalone repository
```

Branch confirmation:

```text
* main 78af1a1 [origin/main] Add Phase 2 route composition seams (#7)
```

## Relevant post-Phase-2 code/docs state

### Phase 2 is merged and substantially complete

Evidence from `.ratp/reports/phase2-root-upward-report.md` and `.ratp/reports/phase2-parent-evaluation.md`:

- `apps/api/src/server.ts` exposes `CreateAppOptions` / `createApp(options)` with built-in route factory/dependency injection.
- Business route groups now have route factories and default exports:
  - `createOrdersRoutes`
  - `createPaymentLinksRoutes`
  - `createDepositsRoutes`
  - `createAddressPoolRoutes`
  - `createTransfersRoutes`
  - `createNotificationsRoutes`
  - plus the earlier `createApiKeysRoutes`
- Parent re-ran and accepted focused validation: `git diff --check`, 8 Vitest files / 97 tests, and `npm run type-check`.
- PR #7 merged at `78af1a1 Add Phase 2 route composition seams (#7)`.

### Current code seams relevant to next work

Targeted inspection confirms:

- `apps/api/src/server.ts` now has `BuiltInRouteFactories`, `BuiltInRouteDependencies`, `CreateAppOptions`, `routeFactories`, `routeDependencies`, `extendPublicRoutes`, and `extendApiRoutes`.
- Business route files still import default singleton accessors as Open defaults, but each route factory accepts dependency overrides.
- `runtimeContextToLegacyOrganizationId` has no matches in `apps/api/src/routes/*` or `apps/api/src/server.ts`.
- Cloud/SaaS terms in current `routes/server` scan are limited to existing `cloudOnlyRouteGuard` usage around intentionally hidden `/organizations` and `/config-management` routes.
- No policy/entitlement/usage sink interface exists in route dependencies yet. `apps/api/src/server.ts` only comments that an overlay can provide its own guard/policy middleware.
- Existing processor events are internal (`ProcessorEventBus`); there is no package-boundary event/usage sink envelope with `paymentScope`, actor, request id, source, and idempotency key.
- Deeper layers remain coupled to concrete storage and lifecycle construction, e.g. `ProcessorCore.create` creates `PostgreSQLDatabase`, `Monitor`, `OrderRepository`, `TransferRepository`, `AddressPoolRepository`; `ConfigurationManager`, `AuthManager`, and `NotificationRepository` still use concrete `pg.Pool` paths.

### Docs are partly stale after Phase 2 merge

- `docs/agent-handoff-2026-05-19.md` still says Phase 2 is “started” and recommends converting `notifications.ts` next, which is obsolete after PR #7.
- `docs/open-overlay-seams-plan.md` contains a Phase 2 checkpoint that describes only the first `createApp` + `api-keys` slice and still says most built-in Open route modules are not factories. This is now stale.
- `docs/open-cloud-execution-plan.md` has a status update indicating remaining Phase 2 work is “convert the rest of the built-in route groups,” also stale after Phase 2.
- Self-hosting docs are more current and correctly emphasize that API-key calls do not need `X-Organization-Id`, while JWT operator calls may still need the internal Open merchant id.

## Candidate next implementation tasks

### Candidate 1 — Minimal Open-owned policy + event/usage port slice for order creation

- **Goal:** Add small Open-owned `PolicyPort` and `EventSink`/`UsageSink` contracts with allow-all/no-op defaults, and wire them through the existing Phase 2 route composition seam for `POST /api/v1/orders` only.
- **Why it matters:** The coupling audit identifies missing policy/entitlement hooks and unified usage/audit event envelopes as major blockers for a future Cloud overlay. A one-operation order-create slice proves the pattern without implementing Cloud billing, plans, metering, or admin scope.
- **Expected code areas:**
  - New shared/core contracts, likely under `packages/shared/src` or a small package-local API module: policy decision/result types, operation names, event envelope/sink types, default allow-all/no-op implementations.
  - `apps/api/src/routes/orders.ts`: extend `OrdersRouteDependencies`, invoke policy before `manager.createOrderForRuntimeScope`, emit a post-success event envelope.
  - `apps/api/src/server.ts`: route dependency typing only if needed; probably no broad route registry changes beyond accepting the existing `routeDependencies.orders` object.
  - Tests in `apps/api/tests/orders-runtime-context.test.ts` and/or a focused new route composition test.
  - Docs update to mark this as first Phase 3/4 seam slice, not a Cloud feature.
- **Estimated complexity/context budget:** medium-small. ~35k-45k tokens implementation/review budget; 1-3 production files plus tests/docs.
- **RATP suitability:** excellent. It uses the new Phase 2 route factory seam, has clear anti-drift constraints, can be split into contract/design, route integration, validation/review, and RATP observation nodes, and produces measurable evidence without large code churn.
- **Risks/non-goals:**
  - Risk: naming the ports too Cloud-shaped or over-generalizing all operations at once.
  - Risk: policy denial semantics could affect public API behavior if not defaulted carefully.
  - Non-goal: no Cloud billing/subscription/plan enforcement, no database schema changes, no SaaS tenant policy implementation, no broad conversion of all route groups.
- **Validation strategy:**
  - Route tests prove default allow-all behavior preserves existing `POST /orders` success path.
  - Route tests inject a deny policy and assert standard denial response before manager call.
  - Route tests inject event sink and assert emitted envelope includes `paymentScope`, actor/source/request metadata when available, operation, and created order id/reference.
  - `npm run type-check`.
  - `npm run boundary:check`.
  - `git diff --check`.
  - Focused grep: no `plan_type`, `monthly_order_limit`, `billing`, `subscription`, or Cloud-specific logic added to Open route code except neutral docs/comments if unavoidable.

### Candidate 2 — Open self-hosted runtime profile hardening slice

- **Goal:** Tighten Phase 3 self-hosting behavior around local setup/operator semantics and docs, especially reducing remaining operator confusion about when `X-Organization-Id` is needed and making `open:doctor`/`open:init` report the Open runtime profile clearly.
- **Why it matters:** Phase 3 deliverables include explicit local setup/admin/operator semantics, safe default admin posture, and self-hostable config/profile clarity. This directly improves the Open product experience.
- **Expected code areas:**
  - `scripts/open/open-doctor.ts`, `scripts/open/open-init.ts`, `scripts/open/open-smoke.ts` if current messages need tightening.
  - `docs/self-hosting/getting-started.md`, `docs/self-hosting/agent-operations.md`, `docs/self-hosting/configuration.md`.
  - Possibly `apps/api/src/open-runtime.ts` if runtime reporting lacks clarity.
- **Estimated complexity/context budget:** small-medium. ~25k-35k tokens; mostly docs/scripts/tests.
- **RATP suitability:** good, but less ideal than Candidate 1 for testing the newly merged Phase 2 route composition seams. It exercises product clarity and validation scripts more than route/app composition.
- **Risks/non-goals:**
  - Risk: becoming a broad self-hosting rewrite.
  - Non-goal: no UI/admin console, no full onboarding product, no unsafe automatic production admin creation, no Cloud operator flows.
- **Validation strategy:**
  - Run `npm run open:doctor`, `npm run open:init -- --check`, and `npm run open:smoke` in non-mutating modes.
  - Add/update tests if scripts have unit coverage.
  - `npm run type-check`, `npm run boundary:check`, `git diff --check`.

### Candidate 3 — Post-Phase-2 docs/hand-off consistency repair

- **Goal:** Update stale architecture/handoff docs so they reflect that Phase 2 route factories and app composition are merged, and set the next task queue accurately.
- **Why it matters:** Current docs still tell the next agent to start the route-factory slice, which has already merged. This creates drift risk for future RATP nodes.
- **Expected code areas:**
  - `docs/agent-handoff-2026-05-19.md` or a new dated handoff doc.
  - `docs/open-overlay-seams-plan.md`.
  - `docs/open-cloud-execution-plan.md`.
  - Possibly `.ratp/reports/*` only as reference, not modifications.
- **Estimated complexity/context budget:** small. ~15k-25k tokens.
- **RATP suitability:** fair. It is bounded and valuable but too documentation-only to exercise RATP implementation/evidence loops deeply.
- **Risks/non-goals:**
  - Risk: rewriting strategic docs too broadly or prematurely changing the phase plan.
  - Non-goal: no production code, no implementation of Phase 3/4 seams.
- **Validation strategy:**
  - `grep` for obsolete “Remaining Phase 2 work” statements.
  - `npm run boundary:check` if docs touch Open/Cloud boundary wording.
  - `git diff --check`.

### Candidate 4 — Manager/processor scope promotion at one deeper facade seam

- **Goal:** Promote `RuntimeContext`/`PaymentScope` one level deeper into a manager/processor facade method for a bounded operation, reducing raw `organizationId` flow below routes.
- **Why it matters:** Phase 1 docs explicitly leave deeper manager/processor promotion as future hardening. This would continue moving compatibility ids inward.
- **Expected code areas:**
  - `packages/manager/src/manager.ts` and/or `packages/processor/src/open/open-processor.ts` / `packages/processor/src/services/order-service.ts`.
  - Focused route/unit tests for the chosen operation.
- **Estimated complexity/context budget:** medium. ~45k-65k tokens; larger if touching processor service tests.
- **RATP suitability:** good but riskier. It has real architectural value, but it may overlap with policy/event seams and requires careful compatibility review.
- **Risks/non-goals:**
  - Risk: broad refactor into repositories/storage or breaking Cloud-compatible raw-id methods.
  - Non-goal: no repository schema/interface extraction, no mass method rename.
- **Validation strategy:**
  - Focused unit tests around the selected manager/processor seam.
  - Existing runtime-context route tests.
  - `npm run type-check`, `git diff --check`, selected package tests.

### Candidate 5 — Repository/provider extraction boundary spike for processor or notification storage

- **Goal:** Extract one small repository/provider interface, such as `NotificationRepositoryPort` or a processor order repository port, while keeping the PostgreSQL implementation as the Open default.
- **Why it matters:** Coupling audit identifies concrete storage constructors as a major overlay-readiness blocker.
- **Expected code areas:**
  - `packages/notification/src/repository/notification.repository.ts` or `packages/processor/src/repositories/order.repository.ts`.
  - Consumers in notification service or processor core.
  - Unit tests for default adapter behavior.
- **Estimated complexity/context budget:** medium-high. ~60k-85k tokens depending on chosen repository.
- **RATP suitability:** mixed. It is architecturally meaningful, but too easy to turn into a deep DI/storage refactor and less directly tied to Phase 2 route composition.
- **Risks/non-goals:**
  - Risk: interface churn, constructor cascade, test fixture breakage.
  - Non-goal: no full storage abstraction layer, no schema migration, no Cloud storage implementation.
- **Validation strategy:**
  - Package-specific tests.
  - `npm run type-check`.
  - `npm run boundary:check`.
  - Review diff for no Cloud-only implementation.

## Recommendation: choose Candidate 1

**Recommended next implementation task:**

> Add a minimal Open-owned policy and domain-event/usage seam for `POST /api/v1/orders`, with allow-all/no-op Open defaults and injectable test doubles through the Phase 2 route factory dependency system.

This is the best next RATP test because:

1. **It directly exercises the Phase 2 merge.** The task should wire through `createOrdersRoutes(deps)` / `routeDependencies.orders`, proving the newly merged route composition seam is useful for the very next architectural layer.
2. **It addresses a documented overlay blocker without implementing Cloud.** The coupling audit calls out missing policy/entitlement hooks and event/usage sinks. A neutral Open-owned port with defaults is the right upstream seam; actual Cloud billing/entitlements stay out of scope.
3. **It is implementation-sized.** One operation (`POST /orders`) is enough to prove policy denial and event emission semantics; broader route coverage can follow once the pattern is accepted.
4. **It is RATP-observable.** The task naturally splits into contract design, route integration, validation/evidence, and parent review. The risk of scope creep is clear and testable via grep/diff review.
5. **It complements, not replaces, docs cleanup.** The implementation can include a small doc update, but docs-only repair should not be the main next RATP test because it would not stress the new composition seams.

## Proposed next RATP decomposition

### Node 0 — Root implementation supervisor: order policy/event seam

- **Goal:** Implement the minimal Open-owned policy and event/usage seam for `POST /api/v1/orders`, preserving Open default behavior and avoiding Cloud logic.
- **Parent linkage:** Serves the accepted discovery recommendation and the root goal of using Payin Open to validate/improve RATP.
- **Mode:** `delegate` if runtime allows child subagents; `direct+Codex leaf` acceptable if subagent depth is constrained or working tree is dirty.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 70000.
- **contextBudgetSource:** runtime/parent.
- **Direct/delegate rationale:** Root should preserve scope/evaluation context and delegate implementation/review leaves because implementation + evidence could approach medium complexity; however, all work still fits one window if nested spawning is unavailable.
- **Pass criteria:** All child nodes accepted; production diff limited to neutral ports/defaults, order route integration, focused tests, and minimal docs; validation passes.
- **Fail criteria:** Adds Cloud billing/plan/SaaS logic, broad route conversion beyond orders, schema migrations, or unvalidated behavior changes.

### Node 1 — Contract design leaf: neutral policy and event types

- **Goal:** Define the smallest neutral contracts and Open defaults needed for order-create policy check and post-success event emission.
- **Expected deliverable:** Proposed/implemented types such as `PolicyPort`, `PolicyDecision`, `PolicyOperation`, `DomainEventSink`, `DomainEventEnvelope`, `allowAllPolicy`, `noopEventSink`.
- **Expected code areas:** `packages/shared/src/...` or another justified Open-owned package location with exports.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 25000.
- **contextBudgetSource:** runtime/parent.
- **Mode rationale:** `direct` leaf; small contract surface.
- **Pass criteria:** Names are not Cloud/billing-specific; contracts include `paymentScope`, actor/source/request metadata where available; defaults preserve behavior; exported types compile.
- **Fail criteria:** Dynamic entitlement implementation, SaaS pricing/plan fields, or all-route/all-service redesign.

### Node 2 — Route integration leaf: `POST /orders`

- **Goal:** Wire the neutral policy/event dependencies into `createOrdersRoutes(deps)` for only `POST /api/v1/orders`.
- **Expected deliverable:** Before manager call, evaluate policy for create-order; after successful order creation, emit an event/usage envelope through the injected sink; default dependencies are allow-all/no-op.
- **Expected code areas:** `apps/api/src/routes/orders.ts`, possibly `apps/api/src/server.ts` type imports only if necessary.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 35000.
- **contextBudgetSource:** runtime/parent.
- **Mode rationale:** `direct` implementation leaf; one route operation.
- **Pass criteria:** Existing default route behavior remains unchanged; injected deny policy prevents manager call with standard response; injected sink receives one success event with runtime context; no other route groups are changed.
- **Fail criteria:** Policy called before authentication/runtime context is available in a way that breaks current auth semantics; broad refactor of unrelated handlers; Cloud-specific enforcement.

### Node 3 — Focused validation leaf

- **Goal:** Prove behavior and scope with tests/checks.
- **Expected deliverable:** Test evidence and command logs.
- **Expected code areas:** `apps/api/tests/orders-runtime-context.test.ts` and maybe one unit test for default contracts.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 30000.
- **contextBudgetSource:** runtime/parent.
- **Mode rationale:** `direct` validation leaf; independent evidence-gathering.
- **Pass criteria:**
  - Focused Vitest order tests pass.
  - `npm run type-check` passes.
  - `npm run boundary:check` passes.
  - `git diff --check` passes.
  - Forbidden-scope grep shows no direct Open route additions for `plan_type`, `monthly_order_limit`, `billing`, `subscription`, Cloud entitlement implementation, or usage metering implementation beyond neutral port names/docs.
- **Fail criteria:** Any failing required validation without documented infrastructure-blocked retry; missing negative policy test; missing event sink assertion.

### Node 4 — RATP behavior/review leaf

- **Goal:** Review the result against the discovery recommendation and record how well RATP handled the task.
- **Expected deliverable:** Upward report plus RATP behavior observation.
- **Expected code areas:** `.ratp/reports/order-policy-event-seam-upward-report.md` and `.ratp/reports/order-policy-event-seam-ratp-observation.md`.
- **contextWindowTokens:** 200000.
- **usableContextTokens:** 120000.
- **estimatedRequiredTokens:** 20000.
- **contextBudgetSource:** runtime/parent.
- **Mode rationale:** `direct` review leaf; parent/root can perform without code edits.
- **Pass criteria:** Report maps every acceptance criterion to evidence; identifies scope risks; recommends accept/revision with reasons.
- **Fail criteria:** No upward report, no evidence map, or report ignores anti-drift constraints.

## Non-goals for the recommended task

- Do not implement Cloud billing, subscription, plan limits, usage pricing, customer admin UI, or hosted tenant management.
- Do not modify old `/data/openclaw/workspace/payin`.
- Do not create a private Cloud overlay repository.
- Do not convert every route group to policy/event ports in one change.
- Do not extract repository/storage providers or change DB schema.
- Do not make Open API callers pass organization ids for order creation.

## Suggested lifecycle endpoint for the implementation run

The next run should end at a merge-ready local branch/PR candidate, not at full Phase 3 completion:

1. Implementation node writes code/tests/docs in a new branch.
2. Validation node runs focused tests plus `type-check`, `boundary:check`, and `git diff --check`.
3. Review node produces upward report and RATP observation.
4. Parent/supervisor decides whether to open PR.

This keeps the next task small enough for RATP observation while still producing an architectural seam that Payin Open actually needs.
