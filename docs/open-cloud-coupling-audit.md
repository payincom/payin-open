# PayIn Open / Cloud Overlay Coupling Audit

Date: 2026-05-17
Scope:

- Open base candidate: `/data/openclaw/workspace/payin-open`
- Old production Cloud source/copy source: `/data/openclaw/workspace/payin`
- Excluded except as negative reference: `payin-cloud-layer`

This audit evaluates whether current `payin-open` is ready to act as the base core for a future clean `payin-cloud-overlay`. The criterion is not only whether Open can run alone, but whether Cloud can add full hosted multi-tenant SaaS behavior by composition instead of forking, patching, or copying Open payment logic.

## 1. payin-open 独立性快速检查

### Repository/product boundary

`payin-open` has been rebranded and hardened as an Open product:

- `package.json` is named `payin-open`, has Open verification scripts, and builds only `apps/api` under `build:apps`.
- `README.md` positions the repository as `PayIn Open — Self-hosted Stablecoin Payment Gateway`, not hosted Cloud.
- Old Cloud `apps/admin` and `Dockerfile.admin` are absent from `payin-open`; they exist in old `payin`.
- Open has self-hosting docs under `docs/self-hosting/*` while old `payin` has Cloud ops docs under `docs/cloud-ops/*`.
- Boundary rules exist in `scripts/quality/check-open-boundary.cjs` and currently reject `apps/admin`, Cloud runtime domains, private Railway ids, `CloudProcessor`/`CloudManager`, etc.

Verification performed in this audit:

```bash
cd /data/openclaw/workspace/payin-open
npm run boundary:check
```

Result: `PayIn Open boundary check passed.`

### Runtime/API independence

Open can start a self-hosted API/runtime path with:

- `apps/api/src/index.ts` initializes auth, direct OAuth/social auth optionally, manager, processor, then Hono app.
- Open operator commands exist in root `package.json`: `open:init`, `open:doctor`, `open:smoke`, `open:verify`.
- Open hides some Cloud-only HTTP surfaces via `apps/api/src/open-runtime.ts` and `apps/api/src/server.ts`:
  - `/api/v1/organizations` guarded by `cloudOnlyRouteGuard('Organizations API')`
  - `/api/v1/config-management` guarded by `cloudOnlyRouteGuard('Config Management API')`
- Open introduces fixed single-merchant compatibility scope:
  - `packages/processor/src/open/open-processor.ts` exports `DEFAULT_OPEN_ORGANIZATION_ID` and `OpenProcessor`.
  - `packages/manager/src/open/open-manager.ts` wraps `ConfigurationManager` and injects the Open organization id.
  - `packages/processor/src/context/payment-scope.ts` introduces `PaymentScope`, `singleMerchantScope`, `tenantPaymentScope`.

### Independence caveats

Open independence is real but still compatibility-layer based:

- Core DB tables still use `organization_id` in orders, transfers, address pool, config, notifications, and API keys.
- Many API routes still call the lower-level `ConfigurationManager` directly and resolve a compatibility organization through `resolveBusinessOrganizationId(c)` rather than consistently using `OpenManager`.
- Auth still contains SaaS constructs (`organizations`, `organization_members`, plans, roles, API-key organization scope, audit logs) in `packages/auth/src/database/schema.ts` and `packages/auth/src/organization-manager.ts`.
- Open has no bundled admin UI, but old Cloud dashboard was removed rather than replaced with explicit overlay extension contracts.

Conclusion for independence: **sufficient for a headless self-hosted Open runtime direction, but not yet cleanly separated from inherited Cloud tenancy internals.**

## 2. old payin-cloud vs payin-open 能力对比矩阵

| Capability                        | Old production `payin` source                                                                                                                           | Current `payin-open`                                                                      | Overlay implication                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Payment order core                | `packages/processor/src/services/order-service.ts`, `packages/manager/src/manager.ts`, `apps/api/src/routes/orders.ts`                                  | Present, mostly same code, with Open merchant-organization resolution in API and Open facades       | Good shared Open core candidate, but tenant id is still threaded through service/repository signatures.             |
| Public checkout/order pages       | `apps/api/src/routes/pay-order.ts`, `checkout.ts`, `api-payment-links.ts`, `apps/api/public/*`                                                          | Present                                                                                   | Feasible to share, but needs extension hooks for Cloud branding, hosted domains, risk/entitlement checks.           |
| Payment links                     | `packages/manager/src/services/payment-link.service.ts`, `apps/admin/src/pages/PaymentLinks.tsx`, `apps/api/src/routes/payment-links.ts`                | Backend present; Cloud admin UI removed                                                   | Core link/order logic belongs in Open; UI and SaaS management belong in overlay.                                    |
| Deposit/address pool              | `packages/processor/src/services/deposit-service.ts`, `repositories/address-pool.repository.ts`, `apps/admin/src/pages/Deposits.tsx`, `AddressPool.tsx` | Backend present; Open headless operation via API/scripts                                  | Core belongs in Open; Cloud needs quota/policy hooks before binding/importing addresses.                            |
| Monitor/RPC scanning              | `packages/monitor/*`                                                                                                                                    | Present                                                                                   | Strong Open core candidate; mostly tenant-agnostic. Cloud needs orchestration/config adapters.                      |
| Processor orchestration           | `packages/processor/src/core/processor-core.ts`, `processor.ts`                                                                                         | Present plus `OpenProcessor` facade                                                       | Partly ready; creation hard-codes concrete PostgreSQL repositories/services and Monitor. Need DI/seams.             |
| Webhooks/notifications            | `packages/notification/*`, `apps/api/src/routes/notifications.ts`                                                                                       | Present                                                                                   | Core delivery can be Open; Cloud needs audit/metering hooks and tenant limits.                                      |
| Auth/users/API keys               | `packages/auth/*`, `apps/api/src/routes/auth.ts`, `api-keys.ts`                                                                                         | Present, modified for first Open operator and registration lock                           | Mixed: local Open auth belongs in Open, SaaS organizations/members/roles likely Cloud overlay or adapter.           |
| Organizations/members             | `packages/auth/src/organization-manager.ts`, `apps/api/src/routes/organizations.ts`, admin org switcher                                                 | Backend still present but HTTP route hidden in Open by guard                              | Strong Cloud ownership; Open currently carries it as compatibility storage.                                         |
| Config management                 | `apps/api/src/routes/config-management.ts`, `packages/manager/src/config-provider-adapter.ts`, admin Config pages                                       | Backend present but multi-tenant route hidden in Open; local config docs/scripts exist    | Config provider seam exists but needs clearer overlay override and hosted runtime policy.                           |
| Admin UI                          | `apps/admin/*`, `Dockerfile.admin`, `railway.*.admin.toml`, `scripts/deployment/deploy-admin-to-railway.sh`                                             | Removed and boundary check forbids `apps/admin`                                           | Should become Cloud overlay/admin app, not Open.                                                                    |
| Cloud ops docs/skill              | `docs/cloud-ops/*`, `skills/payin-cloud/SKILL.md`, `AGENTS.md`, `CLAUDE.md`                                                                             | Removed/replaced by `docs/self-hosting/*`, `skills/payin-open/*`                          | Cloud overlay should take Cloud ops skill/docs from old `payin`.                                                    |
| Billing/subscription/entitlements | Only permission names such as `billing:read/write` in `packages/auth/src/permissions.ts`; org `plan_type`, `monthly_order_limit` in schema              | Same inherited placeholders, no full billing logic                                        | Major gap. Overlay cannot enforce commercial policy cleanly without Open policy hooks.                              |
| Usage metering                    | No obvious dedicated metering package/table in old source; events/audit/webhooks exist                                                                  | Same                                                                                      | Missing seam: domain events/usage sinks.                                                                            |
| Audit trail                       | `packages/auth/src/middleware/audit-middleware.ts`, `audit_logs` table, `/audit` route                                                                  | Present                                                                                   | Usable for Open admin audit, but Cloud needs tenant-scoped, compliance-grade audit/event sink hooks.                |
| Hosted runtime config/domains     | old `payin` README/docs/deploy scripts/admin UI know Cloud role                                                                                         | Open uses placeholders and boundary checks; `PAYIN_RUNTIME`/`PAYIN_EDITION` switch exists | Overlay can set runtime env, but using env switches inside Open for Cloud behavior is not enough as long-term seam. |

## 3. 各模块 Open / Cloud 归属判断

| Module/path                                                                                               | Recommended owner                                                | Reason                                                                                                              | Current status                                                                             |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/shared`                                                                                         | Open core                                                        | ConfigProvider, logger, checkout/config utilities reusable by all runtimes                                          | Good Open module.                                                                          |
| `packages/monitor`                                                                                        | Open core                                                        | Chain/RPC scanner should remain tenant-agnostic. It exposes adapter/RPC config classes and event emitters.          | Good shared core; needs Cloud orchestration hooks, not Cloud logic.                        |
| `packages/processor/src/core`, `services/order-service.ts`, `services/deposit-service.ts`                 | Open core domain, with tenant adapter seams                      | Order/deposit/payment state are reusable product core.                                                              | Coupled to `organizationId`, PostgreSQL, Monitor, concrete repositories.                   |
| `packages/processor/src/repositories/*`                                                                   | Open default adapters; Cloud may provide adapters                | Open can ship PostgreSQL default; Cloud needs multi-tenant/storage tuned implementations if necessary.              | Repositories are concrete classes, not interfaces.                                         |
| `packages/processor/src/open/open-processor.ts`                                                           | Open runtime facade                                              | Correct Open-facing single-merchant wrapper.                                                                        | Useful but partial; not a general Cloud extension seam.                                    |
| `packages/manager/src/manager.ts`                                                                         | Mixed: Open config/payment manager core plus Cloud config legacy | Reusable configuration/payment orchestration belongs in Open, but organization/global config model is Cloud-shaped. | Implements `ConfigProvider`, owns DB pool, validators, payment links, processor lifecycle. |
| `packages/manager/src/open/open-manager.ts`                                                               | Open runtime facade                                              | Correct for hiding org id from Open callers.                                                                        | Partial; API routes still often use `ConfigurationManager` directly.                       |
| `packages/auth/src/auth-manager.ts`                                                                       | Split                                                            | Local users/API keys can be Open; organizations/members/OAuth/team roles are Cloud/SaaS concerns.                   | Highly mixed. Constructor only accepts connection/JWT/email; no provider/policy DI.        |
| `packages/auth/src/organization-manager.ts`                                                               | Cloud overlay, or Open compatibility internal only               | SaaS organization/team ownership belongs to Cloud.                                                                  | Still in Open because DB compatibility needs `organizations`.                              |
| `packages/auth/src/middleware/*`                                                                          | Split                                                            | Auth middleware useful; org membership and permission model should be pluggable.                                    | Static permission model and DB-backed auth.                                                |
| `packages/notification`                                                                                   | Open core delivery with Cloud event/audit hooks                  | Webhook delivery belongs in Open; Cloud needs metering/audit/SLA integration.                                       | Concrete PostgreSQL repository and queue, no event sink interface.                         |
| `apps/api/src/routes/orders.ts`, `deposits.ts`, `payment-links.ts`, `notifications.ts`, `address-pool.ts` | Open API core with overlay route composition                     | Business APIs are reusable; Cloud should add tenant/auth/policy wrappers.                                           | Routes import shared auth middleware and call singleton manager; hooks are ad hoc.         |
| `apps/api/src/routes/organizations.ts`, `config-management.ts`, `users.ts`, `/audit`                      | Cloud or optional local admin                                    | Organization/config-management are SaaS/admin surfaces; audit may be both.                                          | Still compiled in Open; some routes hidden by runtime guard.                               |
| `apps/api/src/open-runtime.ts`                                                                            | Transitional Open compatibility                                  | Provides runtime guard/merchant-organization resolution.                                                                      | Helpful for Phase 1, but not enough as a formal plugin/overlay API.                        |
| `apps/admin/*` in old `payin`                                                                             | Cloud overlay                                                    | Multi-org dashboard, config management, API keys, payment links, deposits, orders.                                  | Removed from Open. Should be copied/adapted into overlay.                                  |
| `docs/cloud-ops/*`, `skills/payin-cloud/*` in old `payin`                                                 | Cloud overlay                                                    | Hosted ops/runbooks.                                                                                                | Removed from Open. Should move to overlay.                                                 |

## 4. 重点耦合度分析

### 4.1 Package/module boundaries

Good:

- Workspaces are package-based (`packages/shared`, `monitor`, `processor`, `manager`, `auth`, `notification`, etc.).
- `packages/monitor` is comparatively clean: chain/RPC concerns and event emitters, no organization/user/billing concepts found in primary APIs.
- Open-specific facades now exist: `OpenProcessor`, `OpenManager`, `PaymentScope`.

Weak:

- `apps/api` is both Open runtime and old Cloud API runtime. It imports every route and uses `PAYIN_RUNTIME` guards rather than exporting a composable route factory for Open vs Cloud.
- `packages/processor/src/core/processor-core.ts` constructs concrete `PostgreSQLDatabase`, `Monitor`, `OrderRepository`, `TransferRepository`, `AddressPoolRepository`, `ChainBlocksRepository`, `OrderService`, `DepositService`, `DelayedConfirmationService` directly inside `ProcessorCore.create`. Cloud cannot swap repository/storage/event/policy behavior without modifying Open core.
- `packages/manager/src/manager.ts` owns DB connection, payment link service, validators, processor lifecycle, notification service, and config provider behavior in one class.
- `packages/auth` mixes local operator auth with SaaS organization management in one `AuthManager`/`OrganizationManager` package.

### 4.2 Tenant/context injection

Existing seams:

- `apps/api/src/open-runtime.ts` has `resolveBusinessOrganizationId(c)`.
- `packages/processor/src/context/payment-scope.ts` defines `PaymentScope` with `single-merchant` and `tenant` kinds.
- `OpenProcessor`/`OpenManager` hide `organizationId` for Open callers.
- Lower-level Processor APIs accept explicit `organizationId`, so Cloud can still call them directly.

Coupling risk:

- Tenant context is still a string parameter named `organizationId` throughout domain APIs and DB objects:
  - `CreateOrderRequest.organizationId` in `packages/processor/src/services/order-service.ts`
  - `BindAddressRequest.organizationId` in `packages/processor/src/services/deposit-service.ts`
  - repository filters under `packages/processor/src/repositories/*`
  - route code comments such as `multi-tenant isolation` in `apps/api/src/routes/*`
- Open default context is resolved in HTTP routes, not through a central request/runtime context object.
- Cloud overlay would need to ensure every API route and future service call passes the right tenant. A missed path could create cross-tenant leakage.

Required direction: replace ad hoc `organizationId` threading with a typed `PaymentScope` / `TenantContext` / `RequestContext` passed through service boundaries, with Open and Cloud providers.

### 4.3 Auth provider seams

Existing:

- `AuthManagerOptions` allows `connectionString`, `jwtSecret`, token expiration, optional `EmailService`, `baseUrl`.
- `createAuthMiddleware`, `requirePermission`, and audit middleware provide reusable route middleware.
- Direct OAuth/Social OAuth are initialized in `apps/api/src/index.ts` with best-effort skipping.

Missing/weak:

- No `AuthProvider` interface for Cloud to supply hosted auth/session/API-key policy externally.
- `AuthManager` always creates `new Pool({ connectionString })` and `new OrganizationManager(this.db)`.
- Permissions are static in `packages/auth/src/permissions.ts`; Cloud billing/entitlement/risk cannot inject dynamic policy decisions.
- Open uses `auth.register` branch with `isOpenRuntime()` and registration lock; Cloud behavior remains in the same route file.

Overlay impact: Cloud can reuse old auth as-is only by running the same `packages/auth` internals. A clean overlay cannot replace auth behavior without forking route/middleware construction.

### 4.4 Policy/entitlement hooks

Evidence:

- `packages/auth/src/permissions.ts` contains permission names including `billing:read`, `billing:write`, but no real billing implementation.
- `organizations` schema has `plan_type` and `monthly_order_limit`, but `OrderService.createOrder`, `PaymentLinkService`, deposit binding, address import, and webhook routes do not call an entitlement/policy port.

Missing:

- `PolicyEngine`/`EntitlementProvider` before operations such as create order, publish link, bind address, import address pool, create webhook, retry webhook, enable chain/token, etc.
- No Open default allow-all policy implementation.
- No standard error/result shape for policy denial.

Overlay impact: Cloud billing/plan enforcement would require scattering SaaS checks through Open route/service code, which violates the target decomposition.

### 4.5 Billing/usage/audit event hooks

Existing:

- `ProcessorEventBus` emits domain/system events (`ORDER_COMPLETED`, `DEPOSIT_RECEIVED`, `TRANSFER_DETECTED`, etc.).
- `OrderService` and `DepositService` extend `EventEmitter`.
- `packages/notification` has event types and maps processor events in `packages/manager/src/manager.ts` via `mapOrderStatusEvent`, `mapDepositEvent`.
- Auth audit middleware records API calls to `audit_logs`.

Missing/weak:

- No unified domain event bus contract at package boundary for Cloud usage metering/audit.
- No guaranteed event envelope with `tenantId`, actor, request id, runtime, source, idempotency key.
- No usage sink interface for Cloud to subscribe to order creation/completion, checkout page creation, webhook delivery, RPC/monitor usage.
- `ProcessorCore.create` creates its own `ProcessorEventBus`; external event sinks are not constructor dependencies.

Overlay impact: Cloud usage/billing would either parse DB tables, wrap many routes manually, or patch Open internals.

### 4.6 Repository/storage adapters

Existing:

- `packages/processor/src/database/interface.ts` defines a broad `DatabaseInterface`.
- Repositories are factored by domain (`order.repository.ts`, `transfer.repository.ts`, `address-pool.repository.ts`, etc.).
- Notification and auth have repositories/schema modules.

Weak:

- Repository classes are concrete and created inside core constructors.
- `AuthManager`, `ConfigurationManager`, `NotificationRepository` directly create/use `pg.Pool` or expect concrete DB.
- No exported interfaces like `OrderRepositoryPort`, `TransferRepositoryPort`, `NotificationRepositoryPort`, `AuthRepositoryPort`.

Overlay impact: Cloud cannot safely replace storage, add tenant guardrails, or add read replicas/audit writes by adapter injection. It must use same schema/classes or fork.

### 4.7 Hosted/runtime config overrides

Existing:

- `ConfigProvider` exists in `@payin/shared` and is implemented by `ConfigurationManager` plus `ConfigProviderAdapter`.
- `OrderService`/`DepositService` use `configProvider.getConfig(key, organizationId)` for selected business settings.
- `PAYIN_RUNTIME`/`PAYIN_EDITION` toggles Open vs Cloud behavior in `open-runtime.ts`.

Weak:

- `ConfigProvider` only provides `getConfig`, not typed runtime/environment/tenant config with policy and provenance.
- Open and Cloud route composition is controlled by runtime guards rather than dependency injection.
- Manager config includes both global and organization config values; Open hides multi-tenant config-management route instead of replacing it with a clear local config port.

### 4.8 Processor/monitor orchestration seams

Existing:

- Monitor is injected into services after being created in `ProcessorCore.create`.
- RPC config builder and manager are modular under `packages/monitor/src/rpc/*`.
- `ProcessorCore` supports monitor chains, recovery ranges, and config provider.

Missing:

- No `MonitorFactory`, `ProcessorLifecycleHooks`, or orchestration plugin interface.
- Cloud cannot add hosted observability/SLA/health event sinks around processor start/stop/recovery without wrapping the whole process or modifying `ProcessorCore`.
- Global singleton `globalThis.__payinRPCManager` in `ProcessorCore.create` is runtime-coupled and not overlay-friendly.

### 4.9 Public checkout extension points

Existing:

- Checkout/public routes are present in `apps/api/src/routes/pay-order.ts`, `pay-deposit.ts`, `checkout.ts`, `api-payment-links.ts`, `order-status.ts`, `transfer-status.ts`.
- URL generation helpers exist in `apps/api/src/utils/url-builder.ts`.
- Shared checkout code exists under `packages/shared/src/checkout`.

Missing:

- No formal `CheckoutRenderer`/`BrandingProvider`/`HostedUrlProvider`/`RiskCheck` ports.
- Cloud-specific hosted domains, merchant branding, support links, abuse/risk checks, and entitlements would need route/template changes.

### 4.10 Admin UI boundary

Good:

- Old `apps/admin/*`, `Dockerfile.admin`, admin Railway files, and admin deploy script are absent from Open.
- `scripts/quality/check-open-boundary.cjs` forbids `apps/admin` and admin deploy artifacts.

Remaining issue:

- Open backend still exposes or compiles backend surfaces the old admin used (`users`, `audit`, `config`, `notifications`, API keys). Some Cloud-only routes are hidden at runtime, not split at package boundary.
- The future overlay should copy/adapt old `apps/admin/*`, but it needs a stable Open API contract and Cloud route composition layer.

## 5. 是否可以通过 overlay 实现完整 Cloud 多租户能力

### What is currently feasible by overlay/composition

A Cloud overlay could likely reuse these Open parts without copying core logic:

- `packages/monitor` for blockchain scanning.
- `packages/processor` lower-level APIs with explicit `organizationId` for orders/deposits/transfers/address pools.
- `packages/manager` for payment links/config and processor lifecycle, if the overlay accepts the current DB/schema model.
- `packages/notification` for webhook delivery.
- `apps/api` route logic as reference or direct reuse if Cloud continues to run the same API service with `PAYIN_RUNTIME` not set to Open.
- Old `payin/apps/admin/*` as Cloud dashboard source.

### What is not cleanly feasible yet

A complete clean `payin-cloud-overlay` cannot yet be implemented purely as an overlay because it would need to do at least one of the following:

1. Reuse Open's `apps/api` as the Cloud primary runtime and rely on `PAYIN_RUNTIME` branches. This makes Open and Cloud two modes of one app, not a clean overlay.
2. Copy route/service logic from `apps/api/src/routes/*` to add Cloud auth/context/policy/billing wrappers. That duplicates Open core/API behavior.
3. Modify Open core to add entitlement/risk/metering checks at each operation. That scatters SaaS checks through Open.
4. Use concrete Open repositories/classes and inspect DB tables externally for usage/billing. That is fragile and bypasses domain events.
5. Fork `AuthManager`/`OrganizationManager` because auth and organization membership are not provider-based.

Therefore: **partial overlay is feasible for admin UI/docs/ops and for wrapping existing lower-level Processor/Manager calls, but full Cloud multi-tenant SaaS overlay is not yet cleanly feasible without first adding Open seams.**

## 6. 缺失的 Open seams / ports / extension points

Priority missing seams:

1. **Runtime/app composition port**
   - Need `createOpenApp(deps)` and/or route module factories where Cloud can provide auth/context/policy/event/config dependencies and add routes without editing Open.
   - Current: `apps/api/src/server.ts` imports and mounts concrete routes directly.

2. **Request/Tenant/Payment context port**
   - Need typed `RequestContext` / `PaymentScope` propagation through route -> manager -> processor -> repository.
   - Current: business routes now pass `RuntimeContext`/`PaymentScope` into narrow `*ForRuntimeScope` seams for manager/auth/notification operations, but many deeper service/repository APIs still persist and accept legacy `organization_id` as a compatibility storage detail.

3. **Auth provider port**
   - Need `AuthProvider`, `SessionVerifier`, `ApiKeyVerifier`, `ActorContextProvider` interfaces.
   - Current: `AuthManager` is concrete DB/JWT/organization implementation.

4. **Policy/entitlement port**
   - Need `PolicyEngine` or operation hooks like `beforeCreateOrder`, `beforeBindAddress`, `beforeCreateWebhook`, with Open default allow-all.
   - Current: only static permissions; no billing/plan enforcement hooks.

5. **Usage/audit/domain event sink port**
   - Need event envelope emitted from domain operations with tenant/actor/request metadata and idempotency keys.
   - Current: processor event bus and auth audit exist but are not a unified extension API.

6. **Repository interfaces / storage adapter ports**
   - Need interfaces for order, transfer, address pool, chain state, notification logs/endpoints, auth/users/api keys, config values.
   - Current: concrete classes and `pg.Pool` creation inside managers.

7. **Processor lifecycle/orchestration hooks**
   - Need hooks/factories around monitor creation, RPC manager, recovery, service start/stop, health reporting.
   - Current: `ProcessorCore.create` does orchestration internally.

8. **Checkout extension ports**
   - Need branding, hosted URL, support/risk, checkout policy, and renderer/template hooks.
   - Current: public routes/templates/utilities are concrete.

9. **Admin/API contract boundary**
   - Need documented Open management API surface vs Cloud SaaS admin API surface.
   - Current: Open hides some Cloud-only routes but still compiles inherited admin-support backend.

## 7. 哪些必须先改 payin-open

Before full Phase 2 implementation of `payin-cloud-overlay`, improve Open in this order:

1. **Introduce dependency-composed API/runtime factories**
   - Refactor `apps/api/src/server.ts` and route modules to accept dependencies instead of importing singleton `getManager()`, `getAuth()`, and runtime guards directly.
   - Keep current behavior as default Open wiring.

2. **Promote `PaymentScope` from compatibility type to primary service boundary**
   - Change core service/facade signatures to accept `PaymentScope` or `RequestContext` instead of raw `organizationId` where possible.
   - Maintain DB `organization_id` as adapter storage detail.

3. **Add policy/entitlement hooks with Open allow-all defaults**
   - Cover create/list/update payment links, create orders, bind/unbind deposits, import/archive addresses, create/update webhooks, retry webhooks, config changes.
   - Cloud overlay can then enforce plan/usage/risk without modifying core.

4. **Add domain event/usage sink interfaces**
   - Emit structured events for order created/completed/expired, deposit bound/received, transfer detected/confirmed, webhook delivered/failed, payment link published/order-created.
   - Include scope/actor/request metadata.

5. **Extract repository/storage interfaces from concrete PostgreSQL classes**
   - Start with processor repositories and notification repository because these are core Cloud metering/isolation points.
   - Follow with auth/config repositories if Cloud wants a different SaaS identity implementation.

6. **Split local Open auth from SaaS organization management**
   - Keep an Open default local auth implementation.
   - Move or adapterize `OrganizationManager`/member/team model behind a provider so Cloud owns it.

7. **Formalize checkout extension points**
   - Allow Cloud to inject hosted base URL, branding/theme, support metadata, risk/abuse check, and entitlement denial UI.

8. **Document Open package exports/contracts**
   - Define which package APIs overlay may import and which internals are private.
   - Add boundary tests that prevent Cloud-only checks from entering Open core.

## 8. 哪些 Cloud 代码后续应抽到新的 payin-cloud-overlay

From old `/data/openclaw/workspace/payin`, the future overlay should extract/adapt:

1. **Cloud Admin UI**
   - Entire `apps/admin/*` as starting source, especially:
     - `apps/admin/src/contexts/AuthContext.tsx`
     - organization switcher/selector components
     - pages: `Dashboard.tsx`, `Orders.tsx`, `Deposits.tsx`, `PaymentLinks.tsx`, `ApiKeys.tsx`, `Config/*`
     - API client `apps/admin/src/lib/api.ts`
   - Must be adapted to the overlay API, not copied into Open.

2. **Admin deployment artifacts**
   - `Dockerfile.admin`
   - `railway.production.admin.toml`, `railway.test.admin.toml`
   - `scripts/deployment/deploy-admin-to-railway.sh`
   - These are Cloud/hosted deployment only.

3. **Cloud ops docs and skill**
   - `docs/cloud-ops/*`
   - `skills/payin-cloud/SKILL.md`
   - Old `AGENTS.md`/`CLAUDE.md` guidance if still relevant.

4. **SaaS organization/member/admin surfaces**
   - `apps/api/src/routes/organizations.ts` behavior and old admin organization UI concepts.
   - Long-term owner should be overlay or Cloud auth package, not Open core.

5. **Hosted config management UI/surfaces**
   - `apps/api/src/routes/config-management.ts` and admin `Config/*` pages should become Cloud overlay admin surfaces, while Open keeps local/self-hosted config.

6. **Cloud auth/onboarding behavior**
   - Multi-user registration, OAuth hosted callback flows, organization creation/switching, invite/member/ownership transfer flows should be Cloud overlay-owned or provider-backed.

7. **Cloud-only commercial features to implement/extract**
   - Billing/subscription provider integration.
   - Entitlements/plan limits beyond current schema placeholders.
   - Usage metering.
   - Cloud audit trail and support/risk/admin controls.
   - Hosted operations/SLA monitoring.

Do **not** extract/copy these as Cloud-owned duplicates:

- Order payment core (`packages/processor/src/services/order-service.ts`).
- Deposit/address-pool core (`packages/processor/src/services/deposit-service.ts`, repositories).
- Monitor/RPC scanner (`packages/monitor/*`).
- Payment link domain service (`packages/manager/src/services/payment-link.service.ts`) except UI/admin wrappers.
- Webhook delivery core (`packages/notification/*`) except Cloud-specific event sinks/policies.

## 9. 明确结论：现在是否可以进入 Phase 2；如果不能，阻塞点是什么

Conclusion: **现在不应进入“完整生产 Cloud overlay 实现”的 Phase 2。可以进入 Phase 2 的准备性工作（创建干净 overlay repo skeleton、搬迁 Cloud admin/docs/ops、定义 contracts），但完整多租户 SaaS overlay 被 Open seam 缺失阻塞。**

Blocking points:

1. **App composition seam is only partial**: `apps/api/src/server.ts` now exposes `createApp(options)` for route extension and a few infrastructure overrides, but built-in route modules still import singleton dependencies. Cloud cannot yet replace auth/context/policy/config/event dependencies for Open routes without route-factory refactors.
2. **Tenant context is centralized at route seams, not all core layers**: business routes now use `RuntimeContext`/`PaymentScope` seams, but raw `organizationId` remains the storage and many service/repository isolation mechanism.
3. **No policy/entitlement hooks**: Cloud billing/plan/risk limits would require scattering SaaS checks through Open core or route code.
4. **No usage/metering event port**: processor/auth/notification events exist, but not a unified overlay extension API with tenant/actor/request metadata.
5. **Concrete repository/storage construction**: Processor/Auth/Manager/Notification construct `pg`/repositories internally, preventing Cloud storage/audit wrappers.
6. **Auth/org model is mixed into Open**: Open still carries SaaS organization/member/role code for compatibility; Cloud cannot cleanly own it through a provider seam.
7. **Checkout/admin extension contracts missing**: old admin UI can move to overlay, but public checkout hosted branding/risk/URL extension points are not formalized.

Recommended Phase 1 exit action:

- Treat this audit as a **not-ready-for-full-Phase-2** result.
- First perform targeted Open refactors for seams/ports above.
- In parallel only, create `payin-cloud-overlay` skeleton and copy non-core Cloud-only assets from old `payin` (admin UI/docs/ops) behind temporary adapters, but avoid duplicating payment/order/deposit/processor logic.
