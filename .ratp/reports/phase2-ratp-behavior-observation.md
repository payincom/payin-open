# RATP Behavior Observation — Payin Open Phase 2

## Setup observed

- Main Session acted as supervisor-only and delegated the Phase 2 root work node to this subagent.
- Branch-only lineage in the task prompt was useful: `rootGoal → Fully implement Payin Open Phase 2 app and route composition` and local Phase 2 goals stayed visible without unrelated sibling context.
- The prompt included accepted docs, exact route groups, untrusted partial artifacts, stash identity, non-goals, validation expectations, and report paths. That was enough to continue after context compaction.

## Decomposition quality

The suggested child split mapped well to the work, but the existing working tree already contained broad route-factory draft changes. A strict multi-subagent split by route group would have increased merge risk because six route files and their tests were already modified in one tree. A direct root + Codex leaf approach was more efficient:

- Root preserved acceptance criteria and scope boundaries.
- Codex leaf handled the missing app composition seam and focused tests.
- Root independently validated and wrote the upward report.

For future tasks with clean starting points, the proposed route-group split is still useful. For dirty working trees, an initial inventory/reconciliation node should come before parallel implementation.

## Branch-only lineage and anti-drift

Branch-only lineage helped avoid reopening Phase 1. The docs made clear that Phase 1 RuntimeContext seams were accepted and Phase 2 should focus on route/app composition. This reduced drift into repository/storage extraction or production Cloud overlay work.

The strongest anti-drift constraints were:

- Treat partial artifacts and stash as untrusted.
- Preserve default Open exports/behavior.
- Keep Cloud-only route concepts out of Open route registry.
- Do not implement billing/admin/entitlement/metering.

These constraints directly shaped the final design: `routeFactories`/`routeDependencies` in `createApp(options)`, but no Cloud overlay implementation.

## Context pressure

Context pressure was moderate. The route diffs are large, and full file output was frequently truncated. The most effective pattern was:

- Use targeted `grep` for route factory/default export invariants.
- Use focused `sed` only around relevant server/test regions.
- Rely on test/typecheck evidence rather than reading every changed line in full.

The compaction summary preserved enough exact identifiers to continue safely.

## Infrastructure/tool behavior

- Shell, git, grep, Vitest, TypeScript, and Codex CLI were available.
- Codex completed the app composition leaf and validation successfully.
- No provider/runtime failure required the `infrastructure_blocked` retry path.
- Vitest emitted benign warnings (`punycode` deprecation, `bigint-buffer` pure JS fallback), but tests passed.
- No tight polling loop was needed; long-running commands used sufficient `yieldMs`/`process poll` waits.

## Direct vs delegate tradeoff

Direct root execution worked better than spawning additional children because:

- Existing uncommitted changes were already interdependent.
- The final missing gap was localized to `server.ts` and `open-runtime.test.ts`.
- Extra subagents would have needed shared dirty-tree coordination and likely produced overlapping edits.

Delegating one Codex leaf was valuable because it handled implementation mechanics while the root retained checklist/scope/evaluation context.

## Protocol improvement suggestions

1. Add an explicit “dirty working tree reconciliation” phase to RATP templates when uncommitted/stash artifacts are known.
2. Require child reports to include both changed-file list and “accepted/rejected draft artifacts” decisions.
3. Add a standard evidence section format for validation commands, including benign warnings vs failures.
4. Add a small “scope guard grep” convention for tasks with strict non-goals, e.g. checking for forbidden Cloud/billing terms in touched Open files.
5. For large route refactors, prefer one integration owner over parallel route children once overlapping draft changes already exist.

## Overall assessment

RATP was useful as a supervisor/worker contract and anti-drift checklist. The main value came from preserving exact scope and exit criteria through compaction. The main limitation is that RATP can suggest decomposition, but dirty working trees need an explicit reconciliation step before parallelizing; otherwise parallel children can amplify merge/conflict risk.
