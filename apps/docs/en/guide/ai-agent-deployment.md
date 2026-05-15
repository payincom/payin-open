# AI-Assisted Deployment

PayIn Open is designed to work well with AI agents. A merchant can ask an agent to read the public docs and PayIn Open skill, then help deploy sandbox, integrate webhooks, and prepare production safely.

## What the Agent Should Read

Give your agent these sources:

1. The PayIn Open repository: `https://github.com/payincom/payin-open`
2. The public docs in `apps/docs/`
3. The PayIn Open skill: `skills/payin-open/SKILL.md`
4. The deployment docs in `docs/self-hosting/`

## Recommended Prompt

```text
You are helping me deploy PayIn Open, the open-source stablecoin payment gateway.

My goal:
- I am a merchant.
- I want to run my own payment system.
- Start with sandbox/testnet.
- Do not touch production/mainnet unless I explicitly approve.

Rules:
- Explain each step in business language.
- Never print secrets.
- Never commit secrets or .env files.
- Before any write operation, tell me whether it affects the repo, sandbox, or production.
- Show me every production command before running it.
- Verify health checks after deployment.
- Verify payment creation, payment page rendering, blockchain monitoring, and webhook delivery.
```

## Required Task Classification

Before acting, the agent should classify the task as one of:

1. Open-source repository change
2. Public documentation change
3. Sandbox deployment or maintenance
4. Production deployment or maintenance
5. Merchant integration
6. Internal operation

If the target environment is unclear, the agent should ask before acting.

## Safe Deployment Order

1. Read the README and docs.
2. Confirm the target environment is sandbox/testnet.
3. Prepare environment variables without exposing secret values.
4. Deploy API/admin services.
5. Run database migrations or initialization only after confirming the target database.
6. Verify `/health`.
7. Create a test order.
8. Confirm the payment page works.
9. Verify blockchain monitoring.
10. Verify webhook delivery.
11. Prepare a production launch checklist.

## Production Rules

Production/mainnet operations require explicit human approval.

The agent must not:

- Print private keys, API keys, database URLs, or webhook secrets.
- Commit `.env` files.
- Enable production payments before sandbox validation.
- Set destructive database initialization flags in production.
- Claim payment monitoring works based only on API health.

## Skill Location

The agent-facing skill lives at:

```text
skills/payin-open/SKILL.md
```

Use it as the operational playbook for deployment, integration, and troubleshooting.
