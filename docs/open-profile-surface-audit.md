# PayIn Open Profile/Admin Surface Audit

Date: 2026-05-22
Scope: Phase 3 P3.D audit of public/profile/admin surfaces that can imply hosted Cloud multi-tenant operations in PayIn Open.

## Runtime Route Findings

| Surface | Route(s) | Open action | Cloud behavior |
| --- | --- | --- | --- |
| Organization, member, role management | `/api/v1/organizations`, `/api/v1/organizations/*` | Hidden with `cloudOnlyRouteGuard('Organizations API')` | Preserved |
| Hosted user/admin management | `/api/v1/users`, `/api/v1/users/*` | Hidden with `cloudOnlyRouteGuard('Users Management API')` | Preserved |
| Hosted OAuth signup/profile bootstrap | `/api/v1/auth/oauth`, `/api/v1/auth/oauth/*` | Hidden with `cloudOnlyRouteGuard('OAuth API')` | Preserved |
| Multi-tenant configuration management | `/api/v1/config-management`, `/api/v1/config-management/*` | Hidden with `cloudOnlyRouteGuard('Config Management API')` | Preserved |
| Super-admin diagnostics | `/api/v1/config/diagnostics`, `/api/v1/config/diagnostics/*` | Hidden with `cloudOnlyRouteGuard('Super Admin Diagnostics API')` | Preserved |
| Billing/subscription/plan management | No Open runtime route found | No code change needed | N/A |

## Docs/Test Findings

- Self-hosting runbook now lists hidden Open hosted-admin surfaces and points operators to Open single-merchant API plus Agent/operator commands.
- Self-hosting configuration docs now direct Open diagnostics to `open:doctor` and `open:init -- --check` instead of the Cloud super-admin diagnostics API.
- Focused `apps/api/tests/open-runtime.test.ts` coverage verifies Open 404 disabled payloads for the newly hidden surfaces and Cloud non-404 behavior for the same mounted routes.

## Explicit Non-Changes

- No UI, OAuth redesign, RBAC redesign, billing implementation, schema migration, or broad auth behavior change was added.
- Open local first-operator registration, login, logout, password, API key, and business operation routes remain available.
