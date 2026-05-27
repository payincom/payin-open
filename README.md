# PayIn Open — Self-hosted Stablecoin Payment Gateway

PayIn Open is the open-source, self-hosted payment gateway for online merchants who want to operate their own stablecoin payment infrastructure.

It helps merchants create payment orders, show payment pages, monitor blockchain transactions, update payment status, and notify business systems through APIs and webhooks.

## Product Family

| Product | Scenario | Deployment model | Positioning |
| --- | --- | --- | --- |
| **PayIn Open** | Online business | Merchant self-hosted open-source system | Deploy and operate your own PayIn payment gateway independently. |
| **PayIn Cloud** | Online business | PayIn-hosted cloud service | Register, integrate, and let PayIn operate the payment infrastructure. |
| **PayIn Go** | In-person / offline business | Separate face-to-face payment product | Small merchant and point-of-sale payment flows. |

This repository is for **PayIn Open**. It should not contain PayIn Cloud production runbooks, customer-specific operations, or PayIn Go product internals.

## What PayIn Open Does

PayIn Open helps a merchant:

1. Create payment orders for customers.
2. Show checkout/payment pages.
3. Monitor supported blockchains for incoming stablecoin payments.
4. Update order and deposit status after confirmation.
5. Notify merchant systems through APIs and webhooks.
6. Run separate sandbox/testnet and production/mainnet deployments.

Typical use cases:

- Online store checkout
- SaaS invoice payment
- Cross-border B2B payment
- Merchant deposit address management
- Internal stablecoin payment infrastructure

## Repository Layout

```text
payin-open/
├── apps/
│   ├── api/              # Open API service and hosted payment pages
│   ├── docs/             # Repository-local docs preview/source
│   ├── mcp-server/       # MCP server for AI-assisted workflows
│   ├── address-tool/     # Address/wallet operational helper app
│   └── wallet-tools/     # Wallet operational helper app
├── packages/             # Shared libraries, monitor, processor, auth, manager
├── docs/
│   ├── self-hosting/     # Public self-hosting notes
│   ├── reference/        # Technical configuration references
│   └── dev/              # Developer-facing design notes and examples
├── skills/payin-open/    # Agent-facing deployment and operations playbook
├── scripts/              # Open init/doctor/smoke and maintenance helpers
└── tools/                # Operational tools
```

## Operating Model

PayIn Open is **headless-first**. Merchants can operate it through APIs, scripts, and the PayIn Open Agent Skill. A lightweight management UI may exist for local visibility, but Open should not depend on PayIn Cloud's multi-tenant admin model.

Use this rule when adding features:

- Put reusable payment, monitoring, processing, and webhook logic in PayIn Open first.
- Keep PayIn-hosted multi-tenant SaaS concerns in PayIn Cloud.
- Hide organization/tenant complexity from the Open self-hosted public surface whenever possible.

## Quick Start: Docker Compose Sandbox

The fastest self-hosted path is Docker-first: run PostgreSQL, run database initialization as an explicit one-off task with the same API image and environment, then start the API. The default sandbox/testnet config can smoke Ethereum Sepolia through publicnode; add Alchemy/Infura/Ankr/etc. keys later when you need dedicated RPC capacity.

```bash
git clone https://github.com/payincom/payin-open.git
cd payin-open
export JWT_SECRET="$(openssl rand -base64 32)"
export WEBHOOK_SECRET="$(openssl rand -base64 32)"
docker compose up -d postgres
until docker compose exec -T postgres pg_isready; do sleep 2; done
docker compose build api
docker compose run --rm --no-deps api npm run open:doctor
docker compose run --rm --no-deps api npm run open:init -- --check
docker compose run --rm --no-deps api npm run open:init
docker compose run --rm --no-deps api npm run open:init -- --check --strict
docker compose up -d api
```

The two exported secrets are consumed by the Compose `api` service; keep them in the same shell for every `docker compose` command. Compose points `DB_CONNECTION_STRING` at its `postgres` service, so the `pg_isready` loop waits for the database container before `open:doctor` and the one-off init commands connect to it.

Verify runtime and readiness after init:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/chains
curl http://localhost:3000/api/tokens
docker compose run --rm --no-deps api npm run open:smoke -- --url http://api:3000
```

`/health` is process health only; it can pass before schema/config is ready. Treat `/api/chains`, `/api/tokens`, and `open:smoke -- --url` after `open:init` as the deployment readiness checks. The compose API service sets `PAYIN_RUNTIME=open` and uses `DB_CONNECTION_STRING`, `JWT_SECRET`, and `WEBHOOK_SECRET`; do not use legacy `INIT_DB` container startup hooks.

## Local Node Development

Use local Node when you are changing code rather than validating a container deployment:

```bash
npm install
cp .env.example .env.local
# edit .env.local with DB_CONNECTION_STRING, JWT_SECRET, WEBHOOK_SECRET, PAYIN_RUNTIME=open, NODE_ENV=sandbox
npm run open:doctor
npm run open:init -- --check
npm run open:init
npm run open:init -- --check --strict
npm run dev:api
```

In another terminal, verify the live API:

```bash
npm run open:smoke -- --url http://localhost:3000
```

## Container Provider Deployment Model

PayIn Open is provider-neutral. Any Docker/container-capable platform can run it if the provider supports a PostgreSQL database, environment variables/secrets, private networking from app containers to the database, and an explicit one-off job/task using the same image as the API service.

Universal phases:

1. Provision PostgreSQL and a private connection string reachable from application containers.
2. Build/deploy the repository `Dockerfile` as the API image with `PAYIN_RUNTIME=open`, `NODE_ENV=sandbox` or `production`, `DB_CONNECTION_STRING`, `JWT_SECRET`, and `WEBHOOK_SECRET`.
3. Run a one-off provider job/task using that same image, env, and private network: `npm run open:init -- --check`, `npm run open:init`, then `npm run open:init -- --check --strict`.
4. Start or restart the long-running API process: `node apps/api/dist/index.js`.
5. Expose a public HTTPS URL, set `BASE_URL`, then verify `/health`, `/api/chains`, `/api/tokens`, and `open:smoke -- --url https://...`.

Do not run init from your laptop when the database hostname is private to the provider network. Do not bake initialization into container startup with `INIT_DB` or `DEMO_DATA`; keep it as an operator-controlled one-off task.

## Railway Example: New Sandbox Project

Railway is one provider example, not the required deployment target. Use the same universal model: deploy the Docker image, run init as a Railway-supported one-off task/job with the `payin-api` service image, variables, and private network, then start/verify the API. If your Railway workspace cannot run a one-off task with the service image and private network, Railway SSH is the fallback; avoid local `railway run ... open:init` when `DB_CONNECTION_STRING` uses Railway private Postgres references such as `${{Postgres.DATABASE_URL}}`.

```bash
railway init --name payin-open-sandbox
railway add --service payin-api
railway add --database postgres
railway variables --service payin-api --set 'PAYIN_RUNTIME=open' --skip-deploys
railway variables --service payin-api --set 'NODE_ENV=sandbox' --skip-deploys
railway variables --service payin-api --set 'DB_CONNECTION_STRING=${{Postgres.DATABASE_URL}}' --skip-deploys
railway variables --service payin-api --set "JWT_SECRET=$(openssl rand -base64 32)" --skip-deploys
railway variables --service payin-api --set "WEBHOOK_SECRET=$(openssl rand -base64 32)" --skip-deploys
railway up --service payin-api --detach
railway status
railway logs --service payin-api --deployment
```

For initialization, prefer Railway's provider-supported one-off/scheduled-execution mechanism on the deployed `payin-api` service image, with the service variables and private network attached. Railway documents custom start commands and scheduled executions in service settings; use the Dashboard flow for your workspace rather than an unverified local CLI shortcut. The command sequence for that one-off task is:

```bash
npm run open:doctor
npm run open:init -- --check
npm run open:init
npm run open:init -- --check --strict
```

If a provider-supported one-off task is unavailable, use Railway SSH as a fallback after configuring an SSH key:

```bash
railway ssh --service payin-api
# inside the Railway shell:
npm run open:doctor
npm run open:init -- --check
npm run open:init
npm run open:init -- --check --strict
exit
```

Railway references: [Build and start commands](https://docs.railway.com/builds/build-and-start-commands), [Cron jobs](https://docs.railway.com/cron-jobs), and [Railway SSH](https://docs.railway.com/cli/ssh).

Create a public Railway domain, set `BASE_URL`, and verify readiness:

```bash
railway domain --service payin-api
railway variables --service payin-api --set 'BASE_URL=https://your-payin-open.up.railway.app' --skip-deploys
curl https://your-payin-open.up.railway.app/health
curl https://your-payin-open.up.railway.app/api/chains
curl https://your-payin-open.up.railway.app/api/tokens
npm run open:smoke -- --url https://your-payin-open.up.railway.app
```

For more detail, see [`docs/self-hosting/README.md`](docs/self-hosting/README.md) and [`docs/self-hosting/railway.md`](docs/self-hosting/railway.md).

For a live order smoke test, first run `open:init` (it creates no default login), register the first local Open operator through `/auth/register`, create an API key, add EVM addresses to the address pool, then run:

```bash
npm run open:smoke -- \
  --url http://localhost:3000 \
  --api-key <redacted> \
  --create-order \
  --chain-id ethereum-sepolia \
  --currency USDC
```

PayIn Open is headless by default. It does not require the Cloud multi-tenant admin dashboard. Operate it through API, the PayIn operator CLI, and [`skills/payin-open/SKILL.md`](skills/payin-open/SKILL.md).

Authentication is local-first: `open:init` prepares the Open merchant organization, the first local operator registers through `/auth/register`, operators use JWT sessions for local administration, and merchant integrations use scoped API keys. PayIn Open core does not ship OAuth, Supabase Auth, hosted social login, or Cloud onboarding flows. If PayIn Cloud Layer needs third-party login or hosted tenant onboarding, that integration belongs in Cloud-owned code that composes with PayIn Open through explicit operator/API-key boundaries.

The PayIn CLI is maintained separately at https://github.com/payincom/payin-cli. It is an operations client, not an installer. Use docs/templates/infra tools to deploy Open or Cloud, then use `payin` for diagnostics, smoke checks, API keys, address pools, webhooks, and runtime operations. Until the npm package is published, run it from GitHub:

```bash
npm exec --yes --package github:payincom/payin-cli -- payin profile add local http://localhost:3000
npm exec --yes --package github:payincom/payin-cli -- payin doctor --profile local
npm exec --yes --package github:payincom/payin-cli -- payin smoke --profile local
```

Useful commands:

```bash
npm run boundary:check # Check Open / Cloud repository boundaries
npm run open:verify    # Run the full Open independence verification suite
npm exec --yes --package github:payincom/payin-cli -- payin --help # Run the PayIn operator CLI
npm run build            # Build packages and apps
npm run test             # Run tests
npm run test:e2e:order   # Run the Order business E2E test against local testnet services
npm run test:e2e:deposit # Run the Deposit business E2E test against local testnet services
npm run lint:check       # Check linting
npm run open:init        # Initialize Open schema and merchant organization
```

Railway-hosted sandbox/testnet E2E reproduction:

```bash
export E2E_BASE_URL=https://your-payin-open.up.railway.app
export TEST_USERNAME=admin
export TEST_PASSWORD='use-your-sandbox-password'
export TEST_CHAIN=ethereum-sepolia

curl "$E2E_BASE_URL/health"
npm run test:e2e:order
npm run test:e2e:deposit
```

Use only a self-hosted PayIn Open sandbox/testnet deployment. Do not target mainnet RPCs, production databases, PayIn Cloud services, or print secrets in logs. In Open runtime, leave `TEST_ORGANIZATION_ID` unset by default so tests omit `X-Organization-Id` and exercise automatic merchant-organization resolution; set it only when verifying explicit-header compatibility. In Cloud/multi-tenant runtime, set `TEST_ORGANIZATION_ID` because explicit organization context is required. Set `TEST_CHAIN` to a funded chain with available address-pool capacity for deterministic Railway verification.

## RPC Defaults

- Open sandbox/testnet defaults use public RPC first for out-of-the-box demos.
- Public RPC is suitable for demos and low-volume testing, not production SLA.
- Add provider keys and change `preferredProviders` when you want a dedicated provider to be primary:

```yaml
rpc:
  chains:
    ethereum-sepolia:
      preferredProviders: [alchemy, publicnode] # Alchemy primary, public fallback
```

Placeholder or redacted values such as `${ALCHEMY_API_KEY}`, `***`, `your_*`, and empty strings are ignored so they do not create broken RPC endpoints.

## Public Docs and Self-hosting Documentation

Public product and concept docs live in the PayIn website repository and site:

- Website repository: https://github.com/payincom/payin-com
- Public docs hub: https://payincom.github.io/payin-com/docs/

This repository keeps the AI-agent skill and self-hosting reference material used to deploy PayIn Open. Start here:

| Document | Best for |
| --- | --- |
| [`apps/docs/`](apps/docs/) | Repository-local docs preview/source; public docs belong in `payin-com` |
| [`docs/self-hosting/README.md`](docs/self-hosting/README.md) | Self-hosting documentation index |
| [`docs/self-hosting/getting-started.md`](docs/self-hosting/getting-started.md) | First-time setup overview |
| [`docs/self-hosting/configuration.md`](docs/self-hosting/configuration.md) | Runtime configuration overview |
| [`docs/self-hosting/database-initialization.md`](docs/self-hosting/database-initialization.md) | Database initialization |
| [`docs/self-hosting/environments.md`](docs/self-hosting/environments.md) | Sandbox/production separation |
| [`docs/reference/processor-configuration.en.md`](docs/reference/processor-configuration.en.md) | Processor configuration reference |
| [`docs/reference/rpc-configuration.en.md`](docs/reference/rpc-configuration.en.md) | RPC provider configuration reference |
| [`docs/self-hosting/troubleshooting.md`](docs/self-hosting/troubleshooting.md) | Common problems and fixes |
| [`docs/architecture/open-vs-cloud.md`](docs/architecture/open-vs-cloud.md) | Open / Cloud boundary and decoupling plan |
| [`skills/payin-open/SKILL.md`](skills/payin-open/SKILL.md) | AI agent deployment and operations skill |

## Documentation Rules

PayIn Open documentation should stay public, reusable, and self-hosting focused.

Use these rules when adding or changing docs:

- Use placeholder domains such as `https://your-payin.example.com`.
- Do not include PayIn Cloud production runbooks or hosted-service-only procedures.
- Do not include private Railway project IDs, customer-specific details, or secrets.
- Do not publish temporary planning notes, one-off debugging logs, or obsolete deployment experiments.
- Put public product/concept docs in `payin-com`; put durable self-hosting material under `docs/self-hosting/`.
- Put low-level configuration references under `docs/reference/`.
- Put developer design notes under `docs/dev/` only when they remain useful.

## Supported Payment Flows

| Flow | Description |
| --- | --- |
| **Order payments** | A customer pays a specific order or invoice. |
| **Deposits** | A merchant/user receives funds through assigned deposit addresses. |

Some chains may support one flow but not another. For example, Solana order monitoring can be enabled independently from Solana deposits.

## Security Model

PayIn Open is non-custodial payment infrastructure. It monitors and verifies payments, but merchants remain responsible for:

- Wallet custody and private keys
- RPC provider accounts and limits
- Database backups
- Webhook endpoint security
- Compliance obligations
- Production deployment risk

Never commit secrets or `.env` files.

## License

PayIn Open is released under the Apache-2.0 license. See [`LICENSE`](LICENSE).
