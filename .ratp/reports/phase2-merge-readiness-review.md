# Phase 2 Merge-Readiness Review

## RATP node packet

- **Root Goal:** Finish Payin Open Phase 2 app/route composition through a reviewable PR lifecycle, not merely implementation.
- **Parent Goal / Linkage:** Phase 2 implementation is accepted; this node moves it from implementation-complete toward merge-ready by reviewing diff hygiene, stash reconciliation, and PR readiness.
- **Local Goal:** Review the current Phase 2 diff for merge readiness, decide whether `stash@{0}` is superseded or contains missing useful changes, identify blockers, and write a clear upward report.
- **Goal lineage:** `rootGoal → Fully complete Phase 2 route/app composition lifecycle → parentGoal → implementation accepted; remaining work is merge readiness, stash reconciliation, commit/PR → localGoal → diff hygiene + stash decision + PR readiness review`.
- **Context budget / mode:** Fits one context window; mode `direct`. No child delegation needed because this is a focused review of the current dirty tree and stash.
- **Non-goals respected:** No Cloud overlay implementation, billing/subscription/admin scope, repository/storage providers, migrations, UI changes, commit, push, or PR creation.

## Decision

**Merge-readiness decision: PASS / ready for supervisor commit+PR after accepting this review.**

I found **no blocking issue** in the current Phase 2 diff. I did not change production code or tests. The only file written by this node is this report.

## Evidence inspected

Commands run from `/data/openclaw/workspace/payincom/payin-open`.

### Working tree and diff shape

```sh
git status --short
git branch --show-current
git diff --stat
git diff --name-status
git diff --check
```

Observed branch: `phase2-app-route-composition`.

`git status --short` before this report showed only expected Phase 2 modified route/server/test files plus untracked Phase 2 RATP reports:

- Modified route/app files:
  - `apps/api/src/routes/address-pool.ts`
  - `apps/api/src/routes/deposits.ts`
  - `apps/api/src/routes/notifications.ts`
  - `apps/api/src/routes/orders.ts`
  - `apps/api/src/routes/payment-links.ts`
  - `apps/api/src/routes/transfers.ts`
  - `apps/api/src/server.ts`
- Modified focused tests:
  - `apps/api/tests/address-pool-runtime-context.test.ts`
  - `apps/api/tests/deposits-runtime-context.test.ts`
  - `apps/api/tests/open-runtime.test.ts`
  - `apps/api/tests/orders-runtime-context.test.ts`
  - `apps/api/tests/payment-links-runtime-context.test.ts`
  - `apps/api/tests/transfers-runtime-context.test.ts`
- Untracked RATP reports:
  - `.ratp/reports/phase2-parent-evaluation.md`
  - `.ratp/reports/phase2-progress-ledger.md`
  - `.ratp/reports/phase2-ratp-behavior-observation.md`
  - `.ratp/reports/phase2-root-upward-report.md`

Diff stat for tracked files before this report:

```text
13 files changed, 2961 insertions(+), 2386 deletions(-)
```

`git diff --check` passed with no output.

### Focused validation re-run by this node

```sh
npx vitest run \
  apps/api/tests/open-runtime.test.ts \
  apps/api/tests/api-keys-runtime-context.test.ts \
  apps/api/tests/orders-runtime-context.test.ts \
  apps/api/tests/payment-links-runtime-context.test.ts \
  apps/api/tests/deposits-runtime-context.test.ts \
  apps/api/tests/address-pool-runtime-context.test.ts \
  apps/api/tests/transfers-runtime-context.test.ts \
  apps/api/tests/notifications-runtime-context.test.ts
```

Result: **8 test files passed, 97 tests passed**.

```sh
npm run type-check
```

Result: passed; TypeScript build completed for `packages/shared packages/monitor packages/processor packages/notification packages/email packages/manager packages/auth packages/test-utils apps/api`.

Benign noise observed during Vitest only: Node `punycode` deprecation warnings and `bigint-buffer` pure JS fallback warnings.

### Factory/default export checks

Checked route factory definitions and default exports:

```text
apps/api/src/routes/orders.ts: OrdersRouteDependencies, createOrdersRoutes(...), export default createOrdersRoutes();
apps/api/src/routes/payment-links.ts: PaymentLinksRouteDependencies, createPaymentLinksRoutes(...), export default createPaymentLinksRoutes();
apps/api/src/routes/deposits.ts: DepositsRouteDependencies, createDepositsRoutes(...), export default createDepositsRoutes();
apps/api/src/routes/address-pool.ts: AddressPoolRouteDependencies, createAddressPoolRoutes(...), export default createAddressPoolRoutes();
apps/api/src/routes/transfers.ts: TransfersRouteDependencies, createTransfersRoutes(...), export default createTransfersRoutes();
apps/api/src/routes/notifications.ts: NotificationsRouteDependencies, createNotificationsRoutes(...), export default createNotificationsRoutes();
apps/api/src/routes/api-keys.ts: ApiKeysRouteDependencies, createApiKeysRoutes(...), export default createApiKeysRoutes();
```

`apps/api/src/server.ts` imports the factories/types and wires `createApp(options)` with:

- `BuiltInRouteFactories`
- `BuiltInRouteDependencies`
- `routeFactories?: BuiltInRouteFactories`
- `routeDependencies?: BuiltInRouteDependencies`

Business routes are still mounted under the same paths, now via factory/dependency composition.

### Scope-guard checks

Checked for conflict markers:

```sh
grep -RInE '^(<<<<<<<|=======|>>>>>>>)' apps/api .ratp
```

No matches.

Checked changed route/server/test diffs for scope-creep terms such as billing/subscription/admin/cloud-overlay concepts. The only relevant matches were existing/runtime-scope error/help text and comments about hosted Cloud `X-Organization-Id` or organization-scoped API keys; I found no production Cloud overlay, billing/subscription/admin/entitlement/metering implementation introduced by this Phase 2 diff.

The existing Cloud-only guards in `server.ts` for hosted organization/config-management routes are preserved; the Open route registry is not expanded into Cloud overlay behavior.

## Stash reconciliation decision

### Stash inspected

```sh
git stash show --stat stash@{0}
git stash show --name-only stash@{0}
git show --patch stash@{0} -- <route files> | grep factory/default markers
```

`stash@{0}` is named:

```text
phase2-app-route-composition-prestart-saved-before-phase1-cleanup
```

It touches exactly these five route files:

- `apps/api/src/routes/address-pool.ts`
- `apps/api/src/routes/deposits.ts`
- `apps/api/src/routes/orders.ts`
- `apps/api/src/routes/payment-links.ts`
- `apps/api/src/routes/transfers.ts`

It does **not** contain `server.ts`, tests, `notifications.ts`, or RATP report changes.

### Direct content comparison

I compared the stashed final file content against the current working tree for all five touched route files:

```sh
for f in \
  apps/api/src/routes/address-pool.ts \
  apps/api/src/routes/deposits.ts \
  apps/api/src/routes/orders.ts \
  apps/api/src/routes/payment-links.ts \
  apps/api/src/routes/transfers.ts; do
  git show "stash@{0}:$f" > /tmp/stashfile
  cmp -s /tmp/stashfile "$f" && echo "IDENTICAL $f" || echo "DIFFERS $f"
done
```

Result: all five files were **IDENTICAL** to the current working tree.

### Stash decision

**`stash@{0}` is fully superseded by the current working tree for the files it contains.** It contains no missing route changes and no app/test/report changes. It is safe to drop after the supervisor accepts this review. I did not drop it from this node to preserve working-tree/stash state for parent evaluation.

Suggested parent action after accepting this report:

```sh
git stash drop stash@{0}
```

## Blocker review

No blockers found.

Checklist:

- [x] Expected branch and diff files only; no accidental broad files found.
- [x] No conflict markers found.
- [x] No whitespace errors via `git diff --check`.
- [x] Default Open exports preserved.
- [x] Factory exports/types present for route groups.
- [x] `createApp` composition seam includes factory and dependency overrides.
- [x] Focused route/app Vitest suite passed: 8 files / 97 tests.
- [x] Type-check passed.
- [x] Stash inspected and confirmed superseded by exact content comparison.
- [x] No Cloud overlay/billing/subscription/admin implementation drift found.
- [x] RATP reports are consistent with the current lifecycle state: implementation-complete, parent-accepted, merge-readiness pending until this node.

## Remaining non-blocking risks

- The diff is mechanically large because route modules were wrapped into factories. Reviewers should focus on the dependency defaulting pattern and unchanged route behavior rather than line movement alone.
- Phase 2 intentionally stops at route/app composition. Manager/service/repository provider extraction remains later-phase work.
- `stash@{0}` should be dropped before the branch is considered locally clean, but it does not affect the working tree or PR content.
- Full CI has not run for the eventual PR yet; this node re-ran focused Vitest and type-check locally.

## Suggested commit message

```text
feat(api): add Phase 2 route composition seams
```

Optional body:

```text
Convert business route modules to dependency-aware route factories while preserving default Open exports. Wire createApp with built-in route factory and dependency injection options for future overlay composition. Extend focused runtime-context/app composition tests and record RATP Phase 2 review artifacts.
```

## Suggested PR summary

```markdown
## Summary
- convert orders, payment-links, deposits, address-pool, transfers, and notifications routes to dependency-aware factories with default Open exports preserved
- add createApp route factory/dependency composition options for built-in API routes, including existing api-keys factory wiring
- extend focused runtime-context and app composition tests for injected dependencies and route factory overrides
- document Phase 2 RATP implementation, parent evaluation, progress, and merge-readiness/stash reconciliation

## Validation
- git diff --check
- npx vitest run apps/api/tests/open-runtime.test.ts apps/api/tests/api-keys-runtime-context.test.ts apps/api/tests/orders-runtime-context.test.ts apps/api/tests/payment-links-runtime-context.test.ts apps/api/tests/deposits-runtime-context.test.ts apps/api/tests/address-pool-runtime-context.test.ts apps/api/tests/transfers-runtime-context.test.ts apps/api/tests/notifications-runtime-context.test.ts
- npm run type-check

## Stash note
- `stash@{0}` was inspected and confirmed superseded: all five stashed route files are identical to the current working tree; safe to drop after review acceptance.
```

## RATP behavior observation

The prior Phase 2 root node stopped because its local acceptance criteria ended at implementation, validation, and upward reporting. The human's correction is valid: the root goal should represent a lifecycle endpoint such as `implementation-complete`, `review-ready`, `PR-open`, `CI-green`, or `merged`. This review node closes the merge-readiness gap but still does not complete commit/PR/CI. The next parent/supervisor step should be explicit: accept this node, drop the superseded stash, commit, push/open PR, then watch CI as separate lifecycle nodes or parent actions.

## Fit check

- **Matched parent goal:** This review moves Phase 2 from accepted implementation toward merge-ready by checking diff hygiene, rerunning validation, and resolving stash uncertainty.
- **Missing criteria:** None for this node. Commit/PR/CI are intentionally parent-next steps.
- **Drift risk:** Low; no code edits beyond this report, no scope expansion.
- **Recommended next step:** Supervisor accepts this report, drops `stash@{0}`, commits Phase 2, opens PR, and monitors CI.
