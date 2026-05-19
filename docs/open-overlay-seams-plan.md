# Open overlay seams implementation plan

Date: 2026-05-17
Status: implementation-focused Phase 1 plan for `payin-open`.

## Current structure and flow inventory

### Packages/apps

- `apps/api`: Hono API runtime. `src/server.ts` now exposes a small `createApp(options)` composition seam for infrastructure overrides and additional route mounting. Most route files still import concrete singleton accessors internally, so deeper route-factory dependency injection remains future work.
- `packages/processor`: payment core for orders, deposits, transfers, monitor integration, PostgreSQL repositories, and the Open facade in `src/open/open-processor.ts`.
- `packages/manager`: configuration/payment-link/processor orchestration, plus the Open facade in `src/open/open-manager.ts`.
- `packages/auth`: local users/API keys and inherited organization/member/role storage.
- `packages/notification`: webhook delivery and notification persistence.
- `packages/shared`: logger, config provider interface, checkout rendering helpers.

### Current tenant/scope/auth path

- API auth middleware stores verified identity on the Hono context, including `organizationId` when available.
- Open API route helpers live in `apps/api/src/open-runtime.ts`:
  - `isOpenRuntime()` defaults this repository to Open mode.
  - `resolveBusinessOrganizationId(c)` now delegates to neutral payment-scope resolution but still returns an id for legacy services.
  - `cloudOnlyRouteGuard()` hides hosted SaaS organization/config-management APIs in Open.
- Open facade constants and defaults are in `packages/processor/src/open/open-processor.ts` and are exported as `DEFAULT_OPEN_ORGANIZATION_ID`.
- First formal scope seam is in `packages/processor/src/context/*`:
  - `PaymentScope` is the neutral ownership scope.
  - `RuntimeContext` carries scope plus actor/request metadata.
  - `SingleTenantContextProvider` supplies the default PayIn Open single-merchant scope.
- Many lower-level service/repository signatures still accept raw `organizationId`; this remains a storage compatibility detail for now.
- Business route groups now resolve `RuntimeContext` at the route boundary and pass it to `*ForRuntimeScope` manager/auth/notification seams. Legacy `organization_id` conversion remains inside compatibility seams and repositories.

## Phase 15 checkpoint: route seam audit

Completed API business route RuntimeContext seams:

- `apps/api/src/routes/orders.ts`
- `apps/api/src/routes/payment-links.ts`
- `apps/api/src/routes/deposits.ts`
- `apps/api/src/routes/address-pool.ts`
- `apps/api/src/routes/transfers.ts`
- `apps/api/src/routes/api-keys.ts`
- `apps/api/src/routes/notifications.ts`

Remaining direct `c.get('organizationId')` route references are classified as non-business seams:

- `apps/api/src/routes/auth.ts`
  - `GET /api/v1/auth/me`: **auth internal / authenticated user context**. The value is read from the already-authenticated Hono context to report the caller's current organization membership. It is not a payment/business operation and should not be migrated to `RuntimeContext`.
- `apps/api/src/routes/organizations.ts`
  - `GET /api/v1/organizations/:orgId`
  - `PATCH /api/v1/organizations/:orgId`
  - `DELETE /api/v1/organizations/:orgId`
  - `GET /api/v1/organizations/:orgId/members`
  - `POST /api/v1/organizations/:orgId/members`
  - `PATCH /api/v1/organizations/:orgId/members/:targetUserId`
  - `DELETE /api/v1/organizations/:orgId/members/:targetUserId`
  - `GET /api/v1/organizations/:orgId/api-keys`
  - `POST /api/v1/organizations/:orgId/api-keys`
  - `DELETE /api/v1/organizations/:orgId/api-keys/:keyId`
  - `POST /api/v1/organizations/:orgId/transfer`
  - `GET /api/v1/organizations/:orgId/transfer/pending`
  - Classification: **hosted organization-management route**. This route file models hosted multi-tenant organization/member/role/ownership administration. It intentionally remains on authenticated organization context instead of `RuntimeContext`.

Open handling for hosted organization management:

- `apps/api/src/server.ts` mounts `cloudOnlyRouteGuard('Organizations API')` before `api.route('/organizations', organizationsRoutes)`.
- `cloudOnlyRouteGuard()` returns a 404-style `CLOUD_ONLY_ROUTE_DISABLED` payload in PayIn Open, hiding the hosted organization-management surface from the Open public model.
- Open remains a complete self-hosted single-tenant product through the single merchant runtime context, operator bootstrap/registration, API-key routes, CLI/Agent operations, and business APIs. The underlying `organization_id` remains a compatibility storage scope rather than a merchant-facing Open concept.

No remaining direct `organizationId` route reference was classified as a business route requiring another RuntimeContext migration slice.

Next recommended phase beyond route migration:

- Promote `RuntimeContext`/`PaymentScope` into manager and processor service/facade methods while keeping repository `organization_id` persistence unchanged.
- Expand the initial `createApp(options)` composition seam into route factories with injected manager/auth/notification/runtime/policy/event dependencies.
- After service seams are stable, introduce policy/event ports so a hosted overlay can provide Cloud-specific implementations without copying Open route files.

## Phase 2 checkpoint: first app composition seam

Implemented first slice:

- `apps/api/src/server.ts` exports `CreateAppOptions` and `createApp(options)`.
- The default Open app behavior is unchanged when no options are provided.
- Composed runtimes can now:
  - override `getManager` for health/infrastructure wiring;
  - override `cloudOnlyRouteGuard`;
  - mount additional unauthenticated public routes through `extendPublicRoutes(app)`;
  - mount additional API v1 routes through `extendApiRoutes(api)`.
- `apps/api/tests/open-runtime.test.ts` covers overlay route mounting and infrastructure dependency override behavior.

Implemented first route-factory slice:

- `apps/api/src/routes/api-keys.ts` exports `ApiKeysRouteDependencies` and `createApiKeysRoutes(deps)` while preserving the default route export.
- The route factory accepts injected auth manager access, auth/audit/permission middleware factories, runtime-context resolution, and organization-context error messaging.
- `apps/api/tests/api-keys-runtime-context.test.ts` covers composition with injected auth, middleware, and runtime dependencies.

Limitations still remaining before full Phase 2 exit:

- Most built-in Open route modules still import `getManager()`, `getAuth()`, route-level middleware factories, and runtime helpers directly; `api-keys` is the first converted route factory.
- Cloud cannot yet replace built-in Open route dependencies without route-factory refactors.
- Policy/entitlement and event sink dependencies are not injected yet.

## Ordered refactor plan

1. **Centralize Open runtime context defaults (current first step)**
   - Keep `PaymentScope` in `packages/processor/src/context/payment-scope.ts`.
   - Add `RuntimeContext` and `SingleTenantContextProvider` in `packages/processor/src/context/runtime-context.ts`.
   - Export these types/providers from `@payin/processor`.
   - Update Open facades and API runtime helpers to use the provider while preserving existing public behavior.

2. **Promote scope/context at route seams**
   - Add route helpers that return `RuntimeContext` for business routes.
   - Convert one route group at a time (`orders.ts`, then `payment-links.ts`, then deposits/address-pool) to derive context once per handler and pass only compatibility ids at the final service call.
   - Add tests proving Open callers do not need to provide an organization id for single-tenant operations.

3. **Promote scope/context at manager/processor facades**
   - Add overloads or input objects accepting `PaymentScope`/`RuntimeContext` beside existing raw-id methods.
   - Keep `organization_id` persistence unchanged until repository ports exist.
   - Prefer Open facades (`OpenManager`, `OpenProcessor`) from Open-facing scripts/API code.

4. **Introduce policy and event ports with Open defaults**
   - Add allow-all Open policy defaults for create order, create/update/publish payment link, bind address, address import/archive, webhook create/retry, and config writes.
   - Add domain event sink envelopes including `paymentScope`, actor, request id, and idempotency key.
   - Do not add Cloud billing or plan logic to Open; only add ports and defaults.

5. **Move toward route/app composition**
   - Convert route groups into factories accepting runtime/auth/policy/event dependencies.
   - Keep `createApp()` as the Open default wiring and later add a `createOpenApp(deps)` surface.
   - Cloud overlay should compose routes through these factories instead of copying route files.

6. **Extract storage/provider interfaces where needed**
   - Start with processor order/transfer/address repositories and notification repository.
   - Follow with config/auth repositories only after runtime/context route seams are stable.

## Guardrails

- Open public API remains single-tenant/self-hosted; do not expose organization/member/billing/admin Cloud concepts as Open product features.
- Existing DB `organization_id` columns are compatibility storage, not Open public model.
- New Cloud behavior belongs behind ports/providers and must default to no-op/allow-all in Open.
- Prefer small vertical slices with tests and run `npm run boundary:check` plus touched-package checks.
