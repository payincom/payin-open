---
name: payin-open
description: Deploy, integrate, operate, and troubleshoot PayIn Open, the open-source stablecoin payment gateway for merchants.
---

# PayIn Open Skill

Use this skill when helping a merchant deploy, integrate, operate, or troubleshoot PayIn Open.

PayIn Open is the self-hosted open-source payment gateway in the PayIn product family. PayIn Cloud is the hosted online service. PayIn Go is a separate face-to-face payment product for in-person merchants.

## Core Principle

PayIn Open is merchant-first. Explain actions in business language, then provide technical steps.

The default path is:

1. Start with sandbox/testnet.
2. Verify the full payment flow.
3. Prepare production/mainnet only after explicit approval.

## Required Task Classification

Before acting, classify the task as one of:

1. Open-source repository change
2. Public documentation change
3. Sandbox deployment or maintenance
4. Production deployment or maintenance
5. Merchant integration
6. Internal operation

If the task mixes scopes, split the plan and ask for confirmation before any hosted environment write.

## Safety Rules

Never:

- Print secrets, private keys, API keys, database URLs, RPC keys, or webhook secrets.
- Commit `.env` files or secret-bearing config.
- Touch production/mainnet without explicit human approval.
- Set destructive database initialization flags in production.
- Claim payment monitoring works based only on API health.
- Mix repo changes with hosted environment operations without saying so.

Always:

- Confirm whether the target is repository, sandbox, or production.
- Start with sandbox/testnet for merchant onboarding.
- Use separate sandbox and production databases.
- Redact secrets in logs and summaries.
- Verify API health after deployment.
- Verify payment creation, payment page rendering, blockchain monitoring, and webhook delivery before production launch.

## Recommended Merchant Prompt

```text
I want to deploy PayIn Open, the open-source stablecoin payment gateway.
I am a merchant and want to run my own payment system.
Start with sandbox/testnet.
Do not touch production/mainnet unless I explicitly approve.
Never print or commit secrets.
Explain each step in business language.
```

## Sandbox Deployment Checklist

1. Confirm hosting target, for example Docker, a VPS, Kubernetes, or a cloud app platform.
2. Confirm sandbox/testnet environment.
3. Prepare required services:
   - PostgreSQL database
   - API service
   - Admin service
   - RPC providers if required
   - Webhook endpoint for merchant system
4. Configure environment variables with secret values redacted in chat/log output.
5. Deploy services.
6. Run migrations or initialization only against the confirmed sandbox database.
7. Verify `/health`.
8. Create a test order.
9. Open the payment page.
10. Verify blockchain monitoring status.
11. Verify webhook delivery.
12. Summarize what is ready and what remains before production.

## Production Launch Checklist

Before production/mainnet:

- Sandbox flow has been verified end to end.
- Production database is separate from sandbox.
- Production RPC providers are configured and healthy.
- Webhook endpoint is reachable and signature verification is implemented.
- Secrets are stored only in the hosting provider or secret manager.
- Backups and rollback plan are documented.
- Monitoring and alerting are in place.
- Human approval has been given for production writes/deployment.

## Troubleshooting Order

When a payment is not detected:

1. Confirm environment: sandbox or production.
2. Confirm payment flow: order or deposit.
3. Confirm chain/network and token.
4. Confirm the customer paid the correct address and amount.
5. Check API order/deposit status.
6. Check chain monitor health and lag.
7. Check RPC provider health.
8. Check webhook delivery logs.
9. Summarize likely cause and safe next action.

## Documentation Sources

Use these repository paths as source material:

- `README.md`
- `apps/docs/`
- `docs/self-hosting/`
- `docs/reference/`
- `docs/reference/`
- `docs/self-hosting/troubleshooting.md`

Prefer public docs and this skill for merchant-facing explanations. Use internal/development docs only when the task requires implementation detail.
