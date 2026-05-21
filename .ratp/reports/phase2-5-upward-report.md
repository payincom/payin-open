# Phase 2.5 Upward Report — Minimal Open-Owned Policy/Event Seams

Date: 2026-05-21
Branch: `phase2-5-policy-event-completion`
Decision: **PASS — merge-ready evidence complete**

## Root Goal

Complete Payin Open Phase 2.5 with merge-ready evidence: minimal Open-owned policy/event seams on top of Phase 2 route/app composition, with no Cloud/SaaS drift.

## Parent Goal / Linkage

Phase 2.5 root implemented a payment-link seam after Phase 2 route/app composition, order-create policy/event seam, and docs refresh were merged. This node validates the current branch, fixes only small clear blockers if needed, and writes the missing upward and merge-readiness reports.

## Local Goal

Validate current branch state for the payment-link policy/event seam, confirm bounded scope and anti-drift constraints, run required checks, and report upward.

## Mode Decision and Context Budget

- **contextWindowTokens:** 200000
- **usableContextTokens:** 120000
- **estimatedRequiredTokens:** 45000
- **contextBudgetSource:** parent/runtime delegation packet
- **mode:** `direct`
- **rationale:** Inspection, focused validation, and report writing fit comfortably within the usable context budget; no delegation needed.
- **compact outcome:** no compact required.

## Result

Phase 2.5 is complete at merge-ready evidence level. The branch adds a minimal, neutral payment-link lifecycle policy/event seam for create/update/publish without introducing Cloud/SaaS implementation concepts, storage, migrations, metering, repository extraction, route copying, or private overlay code.

No code blockers were found during review, and no code edits were required by this completion node. The missing report files were written.

## E1–E8 Evidence

### E1 — Documented criteria

Evidence file: `.ratp/reports/phase2-5-exit-criteria.md`

The exit-criteria file records the Phase 2.5 scope decision, RATP node packet, context-budget fields, lifecycle boundary, and completion criteria.

### E2 — Current-state assessment

PR #8 already proved the seam pattern for `POST /api/v1/orders`; Phase 2.5 adds one adjacent high-value operation group rather than expanding into a larger overlay milestone. Payment-link create/update/publish provides a bounded second proof point across policy-before-mutation and event-after-success semantics while reusing the Phase 2 route-factory dependency pattern.

### E3 — Open-owned neutral contracts

Evidence file: `apps/api/src/payment-link-seam.ts`

The seam defines neutral Open-owned contracts:

- `PaymentLinkPolicyOperation = 'create' | 'update' | 'publish'`
- `PaymentLinkPolicyInput`
- `PaymentLinkPolicyDecision`
- `PaymentLinkPolicy`
- `PaymentLinkEventEnvelope`
- `PaymentLinkEventSink`
- `allowAllPaymentLinkPolicy`
- `noOpPaymentLinkEventSink`

The contracts are limited to payment-link lifecycle requests, runtime context, payment scope, actor/request metadata, and payment-link identifiers/status/slug. They do not add Cloud billing, subscription, plan, entitlement, pricing, admin, metering, storage, migration, repository extraction, or overlay implementation.

### E4 — Default Open behavior preserved

Evidence files:

- `apps/api/src/payment-link-seam.ts`
- `apps/api/src/routes/payment-links.ts`
- `apps/api/tests/payment-links-runtime-context.test.ts`

Default route construction uses:

- `deps.paymentLinkPolicy ?? allowAllPaymentLinkPolicy`
- `deps.paymentLinkEventSink ?? noOpPaymentLinkEventSink`

The allow-all policy permits existing Open behavior, and the no-op sink preserves mutation behavior when no event sink is injected. Focused tests passed, including existing Open runtime default-scope create/list/get/update/publish coverage.

### E5 — Injection through route factory dependencies

Evidence file: `apps/api/src/routes/payment-links.ts`

`PaymentLinksRouteDependencies` now accepts:

- `paymentLinkPolicy?: PaymentLinkPolicy`
- `paymentLinkEventSink?: PaymentLinkEventSink`

`createPaymentLinksRoutes(deps)` wires those dependencies once and applies them in the existing payment-link route handlers. This allows overlays/tests to inject behavior without copying or forking routes.

### E6 — Focused behavior tests

Evidence file: `apps/api/tests/payment-links-runtime-context.test.ts`

Focused tests cover:

- injected policy denial before create manager mutation;
- injected policy denial before update manager mutation;
- event recording for successful create, update, and publish;
- best-effort event sink failure that does not fail the mutation response;
- preservation of existing runtime-scope manager seam behavior.

Focused validation result: `npx vitest run apps/api/tests/payment-links-runtime-context.test.ts` passed with **1 file / 13 tests**.

### E7 — Required validation

Validation commands run from `/data/openclaw/workspace/payincom/payin-open`:

1. `npm run boundary:check` — **passed** (`PayIn Open boundary check passed.`)
2. `npx vitest run apps/api/tests/payment-links-runtime-context.test.ts` — **passed** (`1 passed`, `13 tests`)
3. `npm run type-check` — **passed**
4. `git diff --check` — **passed** (no output)
5. Anti-drift grep on added runtime lines for `cloud|saas|billing|subscription|plan|entitlement|pricing|admin` — **passed** (no output)

Infrastructure note: `rg` was not installed in this runtime, so anti-drift search used `grep` fallback. The fallback succeeded.

### E8 — Evidence reports

Written in this completion node:

- `.ratp/reports/phase2-5-upward-report.md`
- `.ratp/reports/phase2-5-merge-readiness-review.md`

## Changed Files

Implementation/evidence files present on branch:

- `apps/api/src/payment-link-seam.ts` — new neutral seam contracts/defaults
- `apps/api/src/routes/payment-links.ts` — route-factory injection plus create/update/publish policy/event calls
- `apps/api/tests/payment-links-runtime-context.test.ts` — focused policy/event seam tests
- `.ratp/reports/phase2-5-exit-criteria.md` — exit criteria
- `.ratp/reports/phase2-5-upward-report.md` — this report
- `.ratp/reports/phase2-5-merge-readiness-review.md` — merge-readiness review

## Fit Check

- **Matched acceptance criteria:** all required files inspected; neutral contracts/defaults confirmed; allow-all policy confirmed; no-op/best-effort event sink confirmed; injection through `createPaymentLinksRoutes(deps)` confirmed; scope limited to create/update/publish lifecycle; no Cloud/SaaS implementation drift found; all required validations passed; missing reports written.
- **Missing criteria:** none.
- **Drift risk:** low.
- **Decision:** accept / PASS.

## Risks / Gaps

- The event sink is intentionally best-effort and currently logs sink failures with `console.warn`; this is acceptable for Phase 2.5 but a future production sink may want structured logging/telemetry.
- Policy/event contracts are deliberately minimal; future phases should avoid extending them with Cloud-specific billing/subscription concepts in this repository.

## Recommended Next Step

Parent should accept Phase 2.5 as merge-ready evidence complete and proceed with normal PR/review flow if desired. Do not merge automatically from this node.
