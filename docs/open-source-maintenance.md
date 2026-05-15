# PayIn Open and PayIn Private Maintenance Model

PayIn Open is the public upstream repository. The private PayIn commercial repository is the downstream product repository.

## Repository roles

- `payincom/payin-open` — public upstream. Holds the open-source core payment gateway, standard self-hosted deployment docs, SDK/API basics, tests, and general bug fixes.
- `payincom/payin` — private downstream. Holds managed-cloud operations, commercial extensions, enterprise integrations, customer-specific code, production configuration, and private runbooks.

## Default development rule

Ask this first for every change:

> Does this help all self-hosted PayIn Open users without exposing commercial strategy, customer data, or private operations?

If yes, implement it in `payin-open` first. The private repo should then merge from `payin-open`.

If no, implement it only in the private `payin` repo.

## Bug fix flow

| Bug type | Fix location | Sync direction |
| --- | --- | --- |
| Open-core bug shared by both products | `payin-open` | `payin-open` → private `payin` |
| Private cloud / enterprise-only bug | private `payin` | no public sync |
| Security issue in open core | private hotfix if needed, then clean public fix/advisory | `payin-open` → private `payin` |
| Private fix that reveals a reusable open-core improvement | re-implement as a clean public PR | `payin-open` → private `payin` |

Avoid copying arbitrary private commits into the public repo. Extract the general solution, remove private dependencies, and submit it as a clean open-core change.

## Sync cadence

- Merge `payin-open/main` into private `payin/main` at least weekly.
- Merge immediately for security fixes and production-impacting core bug fixes.
- Record the public upstream commit used by every private production release.

## Architecture rule

The dependency direction is:

```text
private payin extensions -> PayIn Open core
```

The open core must not depend on private modules, hosted-cloud production configuration, customer-specific workflows, or enterprise-only capabilities.

## Where features belong

| Belongs in PayIn Open | Belongs in private PayIn |
| --- | --- |
| Core order/deposit payment flows | Managed cloud operations |
| Standard blockchain monitoring | Production Railway environment config |
| Public RPC/provider templates | Customer-specific integrations |
| Basic dashboard and payment pages | Enterprise SSO / advanced RBAC |
| Public API/webhook basics | Advanced audit, reporting, workflow automation |
| Self-host deployment docs | Private support/runbooks/SLA tooling |
| General tests and bug fixes | Commercial entitlement strategy |
