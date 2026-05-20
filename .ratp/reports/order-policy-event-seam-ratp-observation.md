# RATP Observation: Order Policy + Event Seam Slice

## Node Packet
- rootGoal: Use Payin Open continuing development to validate/improve RATP.
- parentGoal / linkage: Implement the accepted next bounded Payin Open task selected after Phase 2: a minimal Open-owned policy + domain-event/usage seam for `POST /api/v1/orders`.
- localGoal: Add minimal policy + event/usage seam for `POST /api/v1/orders`, validate, and report upward without opening a PR.
- goalLineage: `rootGoal → accepted next-phase discovery → parent bounded seam implementation → local order-create policy/event seam`.
- acceptance criteria: branch from clean main; neutral contracts/defaults; wire only order create; preserve defaults; tests for allow-all/deny/event; focused validation; reports E1-E7; no PR/merge/scope expansion.
- non-goals: no Cloud overlay, SaaS billing, subscriptions, plan limits, entitlement service, pricing, admin UI, migrations, repository extraction, or extra route groups.

## Context Budget and Mode
- contextWindowTokens: 200000
- usableContextTokens: 120000
- estimatedRequiredTokens: 85000
- contextBudgetSource: parent-provided runtime/session budget
- reservePolicy: 40% reserved for system/history/tool outputs/synthesis
- canCompleteInOneContextWindow: yes
- mode: `direct`
- direct/delegate rationale: the task had one cohesive route seam and one focused test file; delegation would add overhead without independent review value. Codex CLI was sufficient for the coding leaf, while root retained review/validation/report context.
- compact occurred: no

## Branch-only lineage behavior
Branch-only lineage worked well here. The implementation stayed tied to the accepted discovery recommendation and did not pull in unrelated Phase 2 sibling ideas or broader Cloud overlay concerns. The local goal was specific enough to prevent route-group expansion.

## Infrastructure Incidents
- `rg` was unavailable in the shell. Fallback used `find ... | xargs grep` for discovery and `grep` for anti-drift validation.
- Codex attempted `apply_patch` inside its shell, but `apply_patch` was unavailable there. It recovered by writing the new file and using Python text edits.
- These incidents were non-blocking and did not require marking the task `infrastructure_blocked`.

## Protocol Observations
- The context-budget packet was useful: it justified direct execution while still reserving review/report space.
- The explicit anti-drift grep requirement caught the need to distinguish existing runtime strings from newly added runtime lines; checking added lines via `git diff --unified=0` is a better pattern for future bounded slices.
- For coding tasks where workspace rules mandate Codex CLI, RATP should clarify whether Codex is treated as a tool-assisted direct leaf or as a formal child node. Here it was tool-assisted direct work because it was not an OpenClaw subagent and root performed independent validation.
- Reports benefited from evidence IDs E1-E7; this made final parent evaluation simpler than a free-form summary.

## Improvement Suggestions
1. Add a standard RATP evidence recipe for "anti-drift grep on added runtime lines" to avoid false positives from existing files.
2. Add a node-packet field for "mandatory coding tool used" so Codex CLI usage can be tracked without pretending it is an RATP child subagent.
3. Treat missing shell utilities (`rg`, `apply_patch`) as infrastructure incidents only when no fallback exists; otherwise record them as recovered incidents.
