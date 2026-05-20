# RATP Parent Observation: Phase 1 Runtime-Scope Hardening

## Branch Goal Lineage Used
- Root goal: Advance Payin Open Phase 1 runtime-scope hardening so Open runtime business routes do not require `X-Organization-ID` and Cloud behavior remains scoped.
- Parent goal: Close the concrete Phase 1 code gaps identified by existing audits: API key item routes should use runtime-scope AuthManager seams, and deposits unbind-by-reference should use a runtime-scope Manager seam.
- Local goal: Inspect current uncommitted implementation, fix correctness/type/test issues, run focused validation, and write an upward report.

## Parent Evaluation
- Status: accepted.
- Evidence checked by parent:
  - Worker upward report exists: `.ratp/reports/phase1-runtime-scope-hardening-upward-report.md`.
  - Parent reran focused tests: 4 test files passed, 55 tests passed.
  - Parent reran `npm run type-check`: passed.
  - Git diff remains scoped to API key runtime-scope seams, deposit unbind runtime-scope seam, focused tests, and RATP reports.

## RATP Behavior Observed
- Positive: Branch-only lineage worked well for this task. The worker stayed within the explicit root → parent → local goal chain and did not broaden into unrelated Payin Open audits or sibling branches.
- Positive: Upward report quality improved because the worker was asked to report both product/code result and RATP behavior. It explicitly recorded that no sibling context was needed.
- Positive: Parent evaluation was straightforward: acceptance criteria mapped directly to changed files and focused validation commands.
- Weakness: First worker attempt failed due provider/runtime auth availability (`auth_unavailable` from `claw-max`). RATP handled this only because the parent retried manually; the protocol still lacks a built-in retry/backoff/fallback rule for execution-node infrastructure failures.
- Weakness: The worker initially tried `rg`, which was unavailable, then recovered to `find`/`grep`. This is acceptable autonomy, but environment capability discovery could be more explicit in node packets for speed.
- Weakness: The RATP flow here was convention/file-based rather than first-class plugin state, because current chat tools do not expose ratp_* tools in this session. Child linkage/report sync remains less durable than desired.

## Recommendation for RATP
- Add a standard node outcome category for `infrastructure_blocked` distinct from task ambiguity or implementation failure.
- Add retry policy guidance to delegation packets: one retry on transient provider/tool failure, then report blocked with exact command/output.
- Keep branch-only lineage as the default; allow sibling context only as named accepted shared constraints.
