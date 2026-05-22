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

## Quick Start: Local Open Sandbox

This path starts PayIn Open in sandbox/testnet mode. The default Open demo monitors Ethereum Sepolia through publicnode, so no RPC provider signup is required for the first smoke test. Add Alchemy/Infura/Ankr/etc. keys later when you want dedicated RPC capacity.

```bash
git clone https://github.com/payincom/payin-open.git
cd payin-open
npm install
cp .env.example .env.local
```

Edit `.env.local` and set at least:

```bash
DB_CONNECTION_STRING="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"
JWT_SECRET="$(openssl rand -base64 32)"
WEBHOOK_SECRET="$(openssl rand -base64 32)"
PAYIN_RUNTIME=open
NODE_ENV=sandbox
```

Then run the Open operator gate:

```bash
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

For a live order smoke test, first run `open:init` (it creates no default login), register the first local Open operator through `/auth/register`, create an API key, add EVM addresses to the address pool, then run. Public registration is locked after the first operator. JWT operator requests should include `X-Organization-Id: 00000000-0000-0000-0000-000000000001` (or your `PAYIN_OPEN_ORGANIZATION_ID`) until you switch to API-key auth; business API-key calls should not send `X-Organization-Id` because API keys auto-scope to the Open merchant:

```bash
npm run open:smoke -- \
  --url http://localhost:3000 \
  --api-key <redacted> \
  --create-order \
  --chain-id ethereum-sepolia \
  --currency USDC
```


## Docker Compose: Self-hosted Open

`docker-compose.yml` starts PostgreSQL plus the API image built from the repository `Dockerfile`. Initialize the database explicitly before starting the API container:

```bash
export JWT_SECRET="$(openssl rand -base64 32)"
export WEBHOOK_SECRET="$(openssl rand -base64 32)"
docker compose up -d postgres
DB_CONNECTION_STRING="postgresql://payin:payin_local_password@localhost:5432/payin_open" PAYIN_RUNTIME=open npm run open:init -- --check
DB_CONNECTION_STRING="postgresql://payin:payin_local_password@localhost:5432/payin_open" PAYIN_RUNTIME=open npm run open:init
docker compose up -d api
```

The compose API service sets `PAYIN_RUNTIME=open` and uses `DB_CONNECTION_STRING`, `JWT_SECRET`, and `WEBHOOK_SECRET`; do not use legacy `INIT_DB` container startup hooks.

PayIn Open is headless by default. It does not require the Cloud multi-tenant admin dashboard. Operate it through API, the PayIn operator CLI, and [`skills/payin-open/SKILL.md`](skills/payin-open/SKILL.md).

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
npm run build          # Build packages and apps
npm run test           # Run tests
npm run lint:check     # Check linting
npm run open:init     # Initialize Open schema and default merchant scope
```

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
