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
│   ├── api/              # Payment API and payment pages
│   ├── admin/            # Admin dashboard
│   ├── docs/             # Public VitePress docs site
│   └── mcp-server/       # MCP server for AI-assisted workflows
├── packages/             # Shared libraries, monitor, processor, auth, manager
├── docs/
│   ├── self-hosting/     # Public self-hosting notes
│   ├── reference/        # Technical configuration references
│   └── dev/              # Developer-facing design notes and examples
├── skills/payin-open/    # Agent-facing playbook
├── scripts/              # Maintenance and deployment helpers
└── tools/                # Operational tools
```

## Local Development

```bash
git clone https://github.com/payincom/payin-open.git
cd payin-open
npm install
cp .env.example .env
npm run dev
```

Useful commands:

```bash
npm run build          # Build packages and apps
npm run test           # Run tests
npm run lint:check     # Check linting
npm run db:migrate:up  # Run database migrations
```

## Self-hosting Documentation

Start here:

| Document | Best for |
| --- | --- |
| [`apps/docs/`](apps/docs/) | Public documentation website source |
| [`docs/self-hosting/README.md`](docs/self-hosting/README.md) | Self-hosting documentation index |
| [`docs/self-hosting/getting-started.md`](docs/self-hosting/getting-started.md) | First-time setup overview |
| [`docs/self-hosting/configuration.md`](docs/self-hosting/configuration.md) | Runtime configuration overview |
| [`docs/self-hosting/database-initialization.md`](docs/self-hosting/database-initialization.md) | Database initialization |
| [`docs/self-hosting/environments.md`](docs/self-hosting/environments.md) | Sandbox/production separation |
| [`docs/reference/processor-configuration.en.md`](docs/reference/processor-configuration.en.md) | Processor configuration reference |
| [`docs/reference/rpc-configuration.en.md`](docs/reference/rpc-configuration.en.md) | RPC provider configuration reference |
| [`docs/self-hosting/troubleshooting.md`](docs/self-hosting/troubleshooting.md) | Common problems and fixes |
| [`skills/payin-open/SKILL.md`](skills/payin-open/SKILL.md) | AI agent deployment and operations skill |

## Documentation Rules

PayIn Open documentation should stay public, reusable, and self-hosting focused.

Use these rules when adding or changing docs:

- Use placeholder domains such as `https://your-payin.example.com`.
- Do not include PayIn Cloud production runbooks or hosted-service-only procedures.
- Do not include private Railway project IDs, customer-specific details, or secrets.
- Do not publish temporary planning notes, one-off debugging logs, or obsolete deployment experiments.
- Put durable self-hosting material under `docs/self-hosting/`.
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
