# PayIn Open / PayIn Cloud Pricing and Packaging Direction

This document records the pricing implications of the Open / Cloud split.

## Product boundary recap

PayIn Open and PayIn Cloud should not be priced as two tiers of the same SaaS product. They are two deployment models:

- **PayIn Open**: merchant self-hosted, single-merchant by default, operated by the merchant or their AI agent, non-custodial, API/Skill-first.
- **PayIn Cloud**: PayIn-operated hosted multi-tenant cloud service with onboarding, auth, API keys, sandbox/production environments, monitoring, support, and commercial controls.

## Pricing principles

1. **Open should remove adoption friction**
   - Core PayIn Open should remain free/open-source.
   - Do not charge a mandatory transaction rake for self-hosted Open.
   - Avoid making Open look like a crippled Cloud trial.

2. **Cloud should monetize hosted operations, not merely code access**
   - Cloud pricing should reflect infrastructure, reliability, onboarding, support, monitoring, compliance/ops, and multi-tenant convenience.
   - Cloud can charge subscription, transaction fee, or both.

3. **Enterprise value can sit around Open without weakening Open**
   - Paid support, implementation, managed deployment, security review, custom chain/token work, SLA, and enterprise plugins are valid Open-adjacent revenue.
   - These should be positioned as services/add-ons, not blockers to running Open.

4. **Avoid pricing that creates product confusion**
   - If PayIn Open has a UI, keep it simple and local; do not price-gate SaaS/team/billing features inside Open.
   - Cloud-only features should be clearly tied to hosted multi-tenant operation.

## Recommended packaging

### PayIn Open

| Package | Target user | Price posture | Notes |
| --- | --- | --- | --- |
| Open Core | Developers, merchants, AI-agent operators | Free / OSS | Self-hosted payment gateway, API, monitor, processor, docs, Skill. |
| Open Support | Serious self-hosters | Paid monthly or annual support | Help with setup, upgrades, incident diagnosis, RPC/chain configuration. |
| Open Managed Setup | Merchants who want self-hosting but not setup work | One-time or project fee | Deployment, wallet/address-pool setup, webhook integration, handover. |
| Open Enterprise | Larger merchants | Custom | SLA, security review, private chain/token integration, dedicated support. |

### PayIn Cloud

| Package | Target user | Price posture | Notes |
| --- | --- | --- | --- |
| Cloud Starter | Small online merchants | Low monthly + usage | Hosted dashboard/API, sandbox, basic webhook/order/deposit flows. |
| Cloud Growth | Growing merchants | Higher monthly + lower usage fee | More volume, better support, more webhook/notification capacity. |
| Cloud Enterprise | High volume / regulated / custom merchants | Custom | SLA, dedicated support, custom limits, custom chains/tokens, account management. |

## Suggested Cloud price shape

Use a hybrid model:

```text
monthly platform fee + small transaction fee + optional enterprise/support add-ons
```

Rationale:

- A pure transaction fee underprices idle but operationally expensive customers.
- A pure subscription can overcharge low-volume merchants and slow adoption.
- Hybrid pricing maps well to hosted infrastructure + payment volume.

Keep exact numbers out of code for now. They should live in product/marketing docs and Cloud billing configuration later.

## Feature boundary by package

Open Core should include:

- order payment APIs;
- deposit address binding APIs;
- chain monitor;
- processor;
- webhook notifications;
- local configuration;
- Skill/AI-agent operation docs;
- optional lightweight local admin surface if it remains uncoupled.

Cloud-only commercial features can include:

- hosted multi-tenant dashboard;
- merchant onboarding;
- team/user/role management;
- hosted API key lifecycle;
- sandbox/production environment switching;
- managed monitoring and incident response;
- SLA/support;
- billing, invoices, quotas, usage analytics;
- enterprise compliance/ops workflows.

## Product adjustment from new technical findings

The Open API and Manager layers still expose organization/multi-tenant concepts. Until `OpenManager` and an Open API context shim are implemented, avoid presenting Open as a polished no-code SaaS alternative.

Recommended near-term positioning:

```text
PayIn Open = developer/AI-agent operated self-hosted payment gateway.
PayIn Cloud = managed multi-tenant hosted service for merchants who do not want to operate infrastructure.
```

This reduces pressure to ship a full Open UI and makes the Cloud price easier to justify.

## Current pricing recommendation

Adjust the pricing design as follows:

1. **Keep PayIn Open free for core self-hosting.**
2. **Do not add an Open transaction fee.**
3. **Sell Open support / managed setup separately.**
4. **Make PayIn Cloud the paid hosted product.**
5. **Use Cloud hybrid pricing: platform fee + volume fee + enterprise support.**
6. **Keep Cloud-only account/team/billing/multi-tenant features out of Open.**

This best matches the technical split and avoids turning the Open repo into a second SaaS surface.
