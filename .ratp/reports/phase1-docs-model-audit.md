# phase1-docs-model-audit

## Goal

Understand Phase 1 RuntimeContext / PaymentScope intent and current status from PayIn Open docs and core context types, and produce an acceptance checklist for hardening business route/service boundaries.

## Result

Phase 1's concrete target is to make PayIn Open's public and route-facing business model single-merchant/self-hosted while keeping legacy storage compatible. Business routes should resolve a neutral `RuntimeContext` / `PaymentScope` once at the route boundary, pass that scope into `*ForRuntimeScope` manager/auth/notification seams, and avoid directly treating Cloud-shaped `organizationId` as the business API model. Mapping a payment scope to `organization_id` is still allowed, but only inside compatibility seams, Open facades, services, or repository/storage layers.

Current docs say the route-seam slice is substantially complete for orders, payment links, deposits, address pool, transfers, API keys, and notifications. The remaining Phase 1 hardening is deeper promotion of `RuntimeContext` / `PaymentScope` into manager and processor service/facade methods where practical, while keeping repository `organization_id` persistence unchanged until repository ports exist.

### Canonical model

- `PaymentScope` is the neutral payment isolation / ownership key. It has an opaque `id`, `kind: 'single-merchant' | 'tenant'`, and optional label. The default Open scope id is stable and currently maps to legacy `organization_id` storage.
- `RuntimeContext` wraps `paymentScope` plus `runtimeKind`, actor, request id, and source metadata.
- `SingleTenantContextProvider` is the Open provider. It returns a single-merchant context and explicitly does not introduce Cloud organization/member/billing behavior.
- `apps/api/src/open-runtime.ts` is the API route boundary helper. It resolves a `RuntimeContext` from authenticated tenant context when present, otherwise from the Open single-tenant provider in Open runtime. It also contains the Cloud-only route guard and legacy conversion helpers.
- `OpenManager` / `OpenProcessor` are Open-facing facades. They omit public `organizationId` inputs and inject the internal Open merchant/payment scope.
- `ConfigurationManager` and related services expose `*ForRuntimeScope` compatibility seams that accept `PaymentScope | RuntimeContext` and convert to legacy ids internally while downstream repositories still persist `organization_id`.

### Acceptance checklist

A Phase 1 boundary change should pass if:

1. Open-facing business route handlers call `resolveRuntimeContext()` / equivalent neutral helper, not `c.get('organizationId')`, for payment/business ownership.
2. Route handlers pass `RuntimeContext` / `PaymentScope` into `*ForRuntimeScope` seams or Open facades; they should not import/use legacy conversion helpers except at an explicitly justified final compatibility boundary.
3. Open runtime business operations work without caller-provided `X-Organization-ID` and use the default single-merchant scope.
4. Cloud/hosted runtime still preserves required organization-context behavior where no authenticated tenant context exists.
5. Direct `organizationId` in routes is confined to documented non-business/Cloud-only surfaces (`auth/me`, `organizations`) or hidden Cloud-only route groups.
6. Existing database/repository `organization_id` columns and lower-level raw-id APIs remain compatible; no repository persistence migration is required in Phase 1.
7. Tests cover both Open default-scope behavior and Cloud missing-context behavior for each converted business route group.
8. New docs/comments call the id a payment/runtime scope at public boundaries and reserve `organization_id` wording for compatibility/storage internals.

## Evidence

- Target architecture and principles: `docs/open-cloud-execution-plan.md:16-24` says Open is the base product, Cloud is an overlay, Open is single-tenant publicly, and Cloud-only concerns must stay out of Open core. `docs/open-cloud-execution-plan.md:28-36` names `RuntimeContext` / `PaymentScope`, `SingleTenantContextProvider`, provider ports, and route composition as target surfaces.
- Phase 1 deliverables: `docs/open-cloud-execution-plan.md:53-65` requires typed context/scope concepts, an Open single-tenant provider, replacement of ad hoc bare `organizationId` route/service seams where practical, DB compatibility preservation, and Open routes not needing `X-Organization-ID`.
- Phase 1 status: `docs/open-cloud-execution-plan.md:67-71` says business route groups now resolve `RuntimeContext`, call `*ForRuntimeScope` seams for orders/payment links/deposits/address pool/transfers/API keys/notifications, and no longer use route-level legacy conversion.
- Handoff summary: `docs/agent-handoff-2026-05-19.md:25-45` lists converted route groups and says existing DB columns/lower storage still use `organization_id`; conversion must live inside compatibility seams/services/repositories, not business route code. `docs/agent-handoff-2026-05-19.md:126-138` marks the route-seam slice substantially complete and lists remaining hardening.
- Scope/auth path: `docs/open-overlay-seams-plan.md:19-30` identifies API helpers, `PaymentScope`, `RuntimeContext`, `SingleTenantContextProvider`, lower-level raw-id compatibility, and business route migration to `*ForRuntimeScope` seams. `docs/open-overlay-seams-plan.md:44-69` classifies remaining direct route `organizationId` reads as non-business auth/internal or hosted organization-management, guarded in Open. `docs/open-overlay-seams-plan.md:103-118` recommends centralizing defaults, promoting route seams, adding tests, then promoting manager/processor facades while keeping persistence unchanged. Guardrails are explicit at `docs/open-overlay-seams-plan.md:134-139`.
- Product boundary: `docs/architecture/open-vs-cloud.md:7-19` defines Open as self-hosted, single-merchant/operator, no Cloud operations/credentials, reusable payment core. `docs/architecture/open-vs-cloud.md:21-32` defines Cloud as hosted multi-tenant SaaS. `docs/architecture/open-vs-cloud.md:239-257` says `OpenProcessor` / `OpenManager` omit `organizationId`, Cloud adapters belong outside this repo, `PaymentScope.id` is still stored in `organization_id`, and Open-facing APIs must not expose that storage detail.
- Canonical type definitions: `packages/processor/src/context/payment-scope.ts:1-8` states Open uses one fixed single-merchant scope, Cloud maps scope to tenant/organization, and persistence still stores it in `organization_id` while Open-facing APIs must not ask for organization id. The `PaymentScope` shape and helpers are at `packages/processor/src/context/payment-scope.ts:9-35`.
- Runtime provider definitions: `packages/processor/src/context/runtime-context.ts:16-28` defines neutral `RuntimeContext`; `packages/processor/src/context/runtime-context.ts:48-80` defines `SingleTenantContextProvider` as Open's provider, explicitly without Cloud org/member/billing behavior, and exposes the legacy `organizationId` only as compatibility.
- Export surface: `packages/processor/src/index.ts:14-33` exports `PaymentScope`, scope helpers, `RuntimeContext`, `RuntimeContextProvider`, and `SingleTenantContextProvider` from `@payin/processor`.
- API boundary helper: `apps/api/src/open-runtime.ts:30-66` resolves business payment scope/runtime context, defaulting to Open single-tenant scope when no authenticated organization exists in Open runtime. `apps/api/src/open-runtime.ts:68-95` documents legacy conversion as a compatibility extractor and says route handlers should resolve neutral context at request boundary. `apps/api/src/open-runtime.ts:137-168` gives Open/Cloud-specific organization-context messaging and hides Cloud-only routes in Open.
- Cloud-only route hiding: `apps/api/src/server.ts:172-182` mounts `cloudOnlyRouteGuard` before `/organizations` and `/config-management` route groups.
- Manager seams: `packages/manager/src/manager.ts:49-61` defines `OrderRuntimeScope = PaymentScope | RuntimeContext` and maps it to legacy id. `packages/manager/src/manager.ts:1770-1784` and `1794-1810` show `createPaymentLinkForRuntimeScope` / `updatePaymentLinkForRuntimeScope` compatibility seams. `packages/manager/src/manager.ts:1940-1948` explicitly says routes should not import legacy conversion helpers directly.
- Open manager facade: `packages/manager/src/open/open-manager.ts:33-57` describes the Open-facing manager facade as the boundary that injects internal Open merchant scope and keeps SaaS tenant concepts out of Open callers. `packages/manager/src/open/open-manager.ts:63-80` shows public methods injecting the internal id into legacy manager calls.
- Test evidence: `packages/processor/tests/unit/runtime-context.test.ts:11-40` checks default Open scope, neutral runtime context without public organization API, and compatibility helper mapping. `apps/api/tests/orders-runtime-context.test.ts:97-113` verifies Open orders use default scope without organization id; `apps/api/tests/orders-runtime-context.test.ts:115-135` verifies Cloud still returns `ORGANIZATION_CONTEXT_REQUIRED`; `apps/api/tests/orders-runtime-context.test.ts:159-184` verifies listing uses the manager runtime-scope seam and the route payload has no `organizationId`. `packages/manager/tests/unit/order-runtime-scope.test.ts:10-32` and `35-93` verify manager scope-to-legacy-id compatibility behavior.
- Grep check from this audit: no `runtimeContextToLegacyOrganizationId` or `paymentScopeToLegacyOrganizationId` usage was found in `apps/api/src/routes` or core service directories. Remaining direct `c.get('organizationId')` route reads are only `apps/api/src/routes/auth.ts:419` and `apps/api/src/routes/organizations.ts` lines 76, 133, 159, 186, 206, 245, 273, 306, 327, 365, 398, 502, matching the documented non-business/Cloud-only classification.

## Fit Check

- Matched: summarized Phase 1 target in concrete route/service/storage terms.
- Matched: identified canonical docs, types, providers, API helpers, facades, and manager seams.
- Matched: listed explicit non-goals and allowed legacy compatibility zones.
- Matched: used file/line evidence and kept the work read-only except for this report.
- Not performed: no test suite was run; this was a model/docs/code-boundary audit, not a validation run.

## Risks / Gaps

- Route-seam status looks substantially complete, but Phase 1 is not fully exhausted: docs still call out deeper manager/processor service/facade promotion where practical.
- `OpenManagerOptions` still accepts `organizationId` as an internal compatibility override; that is acceptable for now but should stay out of merchant-facing payloads/docs.
- Business routes can still return `ORGANIZATION_CONTEXT_REQUIRED` in Cloud/no-context mode, which is intentional; tests should ensure Open runtime never exposes that path for ordinary single-tenant business operations.
- Lower-level repositories/services still use `organization_id`; this is allowed now but should eventually be hidden behind repository/provider ports.
- API route groups beyond the listed business seams (`auth`, `organizations`, `config-management`) remain intentionally Cloud/auth-management shaped; future work must not accidentally reclassify them as Open business APIs without a separate design decision.

## Recommended Next Step

Use the acceptance checklist above to audit the remaining manager/processor service methods: for each business capability, keep route code on `RuntimeContext`, add or preserve a `*ForRuntimeScope`/Open-facade seam, and move any remaining raw `organizationId` conversion down to compatibility/service/repository boundaries with tests proving Open callers do not supply `X-Organization-ID`.
