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
   - API service with hosted payment pages
   - RPC providers only if the target chain requires keys or production-grade capacity
   - Webhook endpoint for merchant system
4. Configure environment variables with secret values redacted in chat/log output. For Open testnet demos, Ethereum Sepolia defaults to publicnode and does not require Alchemy/Infura keys.
5. Run repository-local Open preflight checks before mutating anything. Prefer the PayIn operator CLI for deployed runtime operations; use npm scripts while working inside the source tree:
   - `npm exec --yes --package github:payincom/payin-cli -- payin doctor --url <api-url>` or `npm run open:doctor`
   - `npm run open:init -- --check`
   - `npm exec --yes --package github:payincom/payin-cli -- payin smoke --url <api-url>` or `npm run open:smoke` for dry-run smoke expectations
6. Deploy services.
7. Run initialization only against the confirmed sandbox database with `npm run open:init`.
8. Verify `/health` and public config with `npm run open:smoke -- --url <sandbox-api-url>`.
9. Register the first local Open operator, then create an API key. Public registration is locked after the first operator. JWT operator requests must include `X-Organization-Id` with the Open merchant id; API-key requests carry scope automatically.
10. Import or generate EVM address-pool addresses for the sandbox merchant.
11. Run full live sandbox smoke with redacted credentials: `npm run open:smoke -- --url <sandbox-api-url> --api-key <redacted> --create-order --chain-id ethereum-sepolia --currency USDC --webhook-id <sandbox-webhook-id>`.
12. Confirm the smoke order was created.
13. Confirm the public payment page rendered.
14. Confirm public order status is reachable.
15. Confirm blockchain monitoring status was checked through `/api/v1/chains` and logs show the intended RPC provider (publicnode by default, or the configured keyed provider).
16. Confirm webhook test delivery was accepted.
17. Summarize what is ready and what remains before production.

## Quick Local Sandbox

Use this minimal path for first-run Open demos. Deployment/bootstrap remains in docs/scripts; the PayIn CLI starts after a runtime URL exists and is for operations, not installing infrastructure:

```bash
git clone https://github.com/payincom/payin-open.git
cd payin-open
npm install
cp .env.example .env.local
# edit .env.local: DB_CONNECTION_STRING, JWT_SECRET, WEBHOOK_SECRET, PAYIN_RUNTIME=open, NODE_ENV=sandbox
npm run open:doctor
npm run open:init -- --check
npm run open:init
npm run open:init -- --check --strict
npm run dev:api
npm run open:smoke -- --url http://localhost:3000
```

For live order smoke, register the first local Open operator, create an API key, add address-pool addresses, then run `open:smoke -- --url ... --api-key ... --create-order` or `npm exec --yes --package github:payincom/payin-cli -- payin smoke --url ... --api-key ... --create-order`. Public registration is locked after the first operator; use controlled local/admin workflows for additional operators.

## PayIn Operator CLI

The external `payin` CLI (https://github.com/payincom/payin-cli) supports both Open and Cloud runtime operations. It is not an installer/deployer. Use it after a PayIn runtime is reachable. Until npm publication, invoke it from GitHub:

```bash
npm exec --yes --package github:payincom/payin-cli -- payin profile add sandbox <sandbox-api-url>
npm exec --yes --package github:payincom/payin-cli -- payin doctor --profile sandbox
npm exec --yes --package github:payincom/payin-cli -- payin smoke --profile sandbox --api-key *** --create-order --webhook-id <sandbox-webhook-id> --require-live
npm exec --yes --package github:payincom/payin-cli -- payin api-key create --profile sandbox --name backend-orders-service
npm exec --yes --package github:payincom/payin-cli -- payin address-pool status --profile sandbox
npm exec --yes --package github:payincom/payin-cli -- payin webhooks test --profile sandbox <webhook-id>
```

All CLI commands should support `--json`; secrets must stay redacted in summaries.

## RPC Provider Guidance

- Open testnet/demo defaults use public RPC first for out-of-the-box operation.
- Public RPC is for demos and low-volume testing; production should use dedicated RPC providers and monitoring.
- Users can make a third-party provider primary by moving it first in `preferredProviders`, e.g. `[alchemy, publicnode]`.
- Users can keep public RPC primary with keyed fallback, e.g. `[publicnode, alchemy]`.
- Empty, redacted, or placeholder keys such as `${ALCHEMY_API_KEY}`, `***`, and `your_*` are ignored and must not be treated as working endpoints.

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
- Public docs hub: `https://payincom.github.io/payin-com/docs/`
- `docs/self-hosting/`
- `docs/self-hosting/agent-operations.md`
- `docs/reference/`
- `docs/self-hosting/troubleshooting.md`

Prefer public docs and this skill for merchant-facing explanations. Use internal/development docs only when the task requires implementation detail.

## Agent Operations Gate

Use `docs/self-hosting/agent-operations.md` as the operational source of truth for `open:doctor`, `open:init`, and `open:smoke`.

For merchant launch preparation, treat this as the minimum sandbox gate before recommending production/mainnet:

```bash
npm run open:doctor -- --strict --json --url <sandbox-api-url> --api-key <redacted>
npm run open:init -- --check --strict --json
npm run open:smoke -- --url <sandbox-api-url> --api-key <redacted> --create-order --order-reference <unique-smoke-id> --webhook-id <sandbox-webhook-id> --require-live --json
```

Do not proceed to production/mainnet unless the sandbox gate passes and the human explicitly approves production writes.
