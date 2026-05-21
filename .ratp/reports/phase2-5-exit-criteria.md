# Phase 2.5 Exit Criteria — Minimal Open-Owned Policy/Event Seams

Date: 2026-05-21
Branch: `phase2-5-policy-event-completion`

## RATP node packet

- **rootGoal:** Complete Payin Open Phase 2.5: establish and validate minimal Open-owned policy/event seams on top of the merged Phase 2 route/app composition system, without drifting into Cloud/SaaS implementation.
- **parentGoal / linkage:** Main Session is supervisor-only; this root work node defines Phase 2.5 completion, assesses merged Phase 2/#8/#9 state, implements any bounded missing work, validates, and reports upward.
- **goalLineage:** `rootGoal → Phase 1 runtime-scope seams merged; Phase 2 route/app composition merged in PR #7; order-create policy/event seam merged in PR #8; docs refresh merged in PR #9 → parentGoal: RATP should complete Phase 2.5 while Main Session supervises only → localGoal: define exit criteria, inspect state, implement any minimal missing seam(s), validate, report.`
- **contextWindowTokens:** 200000
- **usableContextTokens:** 120000
- **estimatedRequiredTokens:** 110000
- **contextBudgetSource:** parent runtime/session_status supplied in delegation packet
- **mode decision:** `direct` with Codex implementation leaf. The work is expected to fit in one usable window if implementation remains one adjacent seam plus concise evidence; no compact expected.

## Scope decision

Phase 2.5 is not a full Phase 3/4 overlay-readiness milestone. Its purpose is to prove that the Phase 2 app/route composition system can host neutral Open-owned policy/event seams for high-value business operations while preserving default Open behavior.

PR #8 proves this for one operation (`POST /api/v1/orders`). To call the phase complete with pattern confidence rather than a one-off, Phase 2.5 should add exactly one adjacent operation group unless inspection shows that would duplicate the same evidence with no value. The smallest valuable adjacent group is payment-link lifecycle create/update/publish because:

1. `payment-links` is already a Phase 2 dependency-aware route factory.
2. Payment links are a high-value merchant operation adjacent to order creation.
3. Create/update/publish cover policy-before-mutation plus event-after-success semantics without requiring storage extraction or Cloud/SaaS concepts.
4. The implementation can remain Open-owned: allow-all policy defaults and no-op/best-effort event sink defaults.

## Exit criteria

Phase 2.5 exits complete when all criteria below are met:

1. **Documented criteria:** This file records explicit Phase 2.5 exit criteria and RATP context-budget fields.
2. **Current-state assessment:** The upward report explains why PR #8 alone is a strong first seam but one adjacent payment-link seam is the minimal bounded completion slice.
3. **Open-owned neutral contracts:** Payment-link seam types use neutral names and concepts; no Cloud billing, subscription, plan, entitlement, pricing, admin, metering storage, migrations, repository extraction, or overlay implementation is added.
4. **Default Open behavior preserved:** Default payment-link create/update/publish behavior remains allow-all and no-op event recording.
5. **Injection through route factory dependencies:** `createPaymentLinksRoutes(deps)` accepts typed policy/event dependencies so overlays/tests can inject behavior without copying route code.
6. **Focused behavior tests:** Tests cover default behavior, injected deny before manager mutation, successful event recording, and best-effort sink failure semantics.
7. **Validation:** Required validation passes: `npm run boundary:check`, focused payment-link route tests, `npm run type-check`, `git diff --check`, and anti-drift grep on added runtime lines for Cloud/SaaS terms. `npm run build -w apps/docs` is only required if docs app content changes.
8. **Evidence reports:** `.ratp/reports/phase2-5-upward-report.md` records E1–E8 evidence; because implementation changes are made, `.ratp/reports/phase2-5-merge-readiness-review.md` records merge-readiness review.
9. **Lifecycle boundary:** Stop at merge-ready evidence; do not open a PR or merge unless parent explicitly approves.
