# PayIn Open — Run Your Own Stablecoin Payment System

PayIn Open is an open-source stablecoin payment gateway for merchants who want to run their own payment system.

It helps a merchant accept stablecoin payments, monitor blockchain transactions, update payment status automatically, and connect payment events back to their own business system.

PayIn Open is part of the PayIn product family:

| Product | Status | Positioning |
| --- | --- | --- |
| **PayIn Open** | Open source | Stablecoin payment gateway for merchants, platforms, and self-hosted payment infrastructure. |
| **PayInGo** | Private for now | Face-to-face payment product for small merchants, powered by X402. |

PayIn Open is not only a developer library. It is designed so merchants can deploy and operate it with help from technical teammates or AI agents.

---

## Who PayIn Open Is For

PayIn Open is for:

- **Merchants** who want their own stablecoin payment system instead of depending entirely on a third-party processor.
- **Operators** who need sandbox and production environments for payment acceptance.
- **AI-assisted deployers** who use tools like Claude, ChatGPT, Cursor, OpenClaw, or other agents to set up and maintain infrastructure.
- **Developers** who want to customize, self-host, integrate, or contribute to the gateway.

The primary user is the merchant. Developers and AI agents are part of the deployment and integration path.

---

## What PayIn Open Does

PayIn Open helps a merchant:

1. **Create payment orders** for customers.
2. **Show a payment page** where the customer can pay with supported stablecoins.
3. **Monitor blockchains** for incoming payments.
4. **Update order status automatically** after payment confirmation.
5. **Notify merchant systems** through APIs and webhooks.
6. **Run separate sandbox and production environments**.

Typical use cases:

- Online store checkout
- SaaS invoice payment
- Cross-border B2B payment
- Merchant deposit address management
- Internal stablecoin payment infrastructure

---

## Start Here

Choose the path that matches your role:

| I want to... | Start with |
| --- | --- |
| Deploy a test environment | `apps/docs` → Merchant Quick Start / sandbox deployment docs |
| Use an AI agent to deploy PayIn Open | `skills/payin-open/SKILL.md` and the AI-assisted deployment docs |
| Integrate PayIn Open with my store or app | API integration and webhook docs |
| Understand the codebase | Developer section below |
| Contribute to the project | Contributing section below |

Suggested AI prompt:

```text
I want to deploy PayIn Open, the open-source stablecoin payment gateway.
Repository: https://github.com/payincom/payin-open
Please help me deploy a sandbox/testnet environment first, explain each required environment variable, and do not enable production/mainnet payments until I explicitly approve it.
Never print or commit secrets.
```

---

## Hosted Cloud vs Self-Hosted

PayIn Open can be used in two ways.

### 1. Managed / Hosted Deployment

A merchant can use a hosted PayIn service operated by the PayIn team.

The hosted service normally has two environments:

| Environment | Purpose | Network Type |
| --- | --- | --- |
| **Sandbox** | Merchant integration, development, testing, debugging | Testnet |
| **Production** | Real merchant payments | Mainnet |

Use this if you want PayIn to run infrastructure for you and you only need to integrate your business system.

### 2. Open-Source Self-Hosted Deployment

You can also deploy PayIn Open yourself using this repository.

Use this if you want:

- Full control over infrastructure
- Custom business logic
- Your own database and RPC providers
- Lower operating cost at small scale
- An internal payment gateway for your company

Self-hosting may still require operational knowledge. If you are not a developer, use an AI assistant or technical teammate to help you deploy and maintain it.

---

## For Non-Developer Merchants

You do not need to understand every file in this repository.

A practical path is:

1. Decide whether you want a managed deployment or self-hosting.
2. If self-hosting, choose a platform such as Railway, Docker, or another Node.js hosting environment.
3. Prepare required accounts and keys:
   - PostgreSQL database
   - Blockchain RPC providers, if needed
   - Domain name, if exposing a public payment page
   - Webhook endpoint in your own business system
4. Ask an AI assistant or technical teammate to follow the deployment docs and PayIn Open skill.
5. Start with **sandbox/testnet** before accepting production payments.

---

## Repository Layout

```text
payin-open/
├── apps/
│   ├── api/              # Payment API and payment pages
│   ├── admin/            # Admin dashboard
│   ├── docs/             # Public VitePress docs site
│   └── mcp-server/       # MCP server for AI-assisted workflows
├── packages/
│   ├── monitor/          # Blockchain scanning and RPC management
│   ├── processor/        # Order/deposit processing engine
│   ├── notification/     # Webhook and notification delivery
│   ├── auth/             # Authentication
│   ├── manager/          # Runtime configuration and orchestration
│   └── shared/           # Shared utilities and types
├── docs/                 # Architecture, deployment, and internal development notes
├── skills/               # Agent-facing skills and playbooks
├── scripts/              # Deployment and maintenance scripts
├── tools/                # Operational tools
├── Dockerfile            # API/processor production image
└── docker-compose.yml    # Local/container deployment example
```

---

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

---

## Deployment Options

### Railway

Railway is a good option for merchants or AI-assisted deployments because it provides app hosting, logs, environment variables, and PostgreSQL in one place.

Relevant files:

- `railway.test.api.toml`
- `railway.test.admin.toml`
- `railway.production.api.toml`
- `railway.production.admin.toml`
- `docs/deployment/railway.md`
- `docs/deployment/railway-quickstart.md`

Deployment scripts:

```bash
npm run deploy:railway:test
npm run deploy:railway:prod
```

> Always deploy and validate sandbox/testnet before production/mainnet.

### Docker

For self-hosting on your own server:

```bash
docker compose up -d
```

See:

- `Dockerfile`
- `Dockerfile.admin`
- `docker-compose.yml`
- `docs/deployment/DEPLOYMENT.md`

---

## Supported Payment Flows

PayIn Open separates payment use cases so operators can enable them carefully.

| Flow | Description |
| --- | --- |
| **Order payments** | A customer pays a specific order or invoice. |
| **Deposits** | A merchant/user receives funds through assigned deposit addresses. |

Some chains may support one flow but not another. For example, Solana order monitoring can be enabled independently from Solana deposits.

---

## Supported Networks and Tokens

Current mainnet configuration includes support for networks such as:

- Ethereum
- Polygon
- TRON
- Arbitrum
- X Layer
- Solana, depending on payment flow configuration

Supported tokens depend on chain configuration and may include stablecoins such as:

- USDT
- USDC
- DAI
- PYUSD

Always check the environment-specific configuration before enabling a token or chain in production.

---

## Security Model

PayIn Open is built around a simple principle:

> The online payment system should monitor and verify payments, but private key operations should be handled with extreme care.

Security considerations:

- Do not commit secrets or private keys to the repository.
- Use separate sandbox and production environments.
- Use separate databases for sandbox and production.
- Use least-privilege API keys and RPC keys.
- Protect webhook signing secrets.
- Review every production environment variable before deployment.
- Prefer sandbox testing before mainnet changes.

PayIn Open helps with payment monitoring and operational workflows, but merchants remain responsible for custody, key management, compliance, and production risk management.

---

## Documentation

PayIn Open has two kinds of documentation:

| Type | Location | Purpose |
| --- | --- | --- |
| **Public docs** | `apps/docs/` | Merchant guides, deployment help, API usage, AI-assisted setup. |
| **Development/internal notes** | `docs/` | Architecture, deployment notes, implementation details, and operational references. |
| **Agent skills** | `skills/payin-open/` | Agent-facing playbooks for deployment, integration, and troubleshooting. |

Start here:

| Document | Best for |
| --- | --- |
| [`apps/docs/`](apps/docs/) | Public documentation website source |
| [`skills/payin-open/SKILL.md`](skills/payin-open/SKILL.md) | AI agent deployment and operations skill |
| [`docs/getting-started.md`](docs/getting-started.md) | First-time setup overview |
| [`docs/deployment/README.md`](docs/deployment/README.md) | Deployment documentation index |
| [`docs/deployment/railway-quickstart.md`](docs/deployment/railway-quickstart.md) | Railway deployment |
| [`docs/deployment/database-environments.md`](docs/deployment/database-environments.md) | Sandbox/production database separation |
| [`docs/processor/configuration.en.md`](docs/processor/configuration.en.md) | Processor configuration |
| [`docs/monitor/rpc-configuration.en.md`](docs/monitor/rpc-configuration.en.md) | RPC provider configuration |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | Common problems and fixes |

---

## AI-Assisted Operations Guidelines

If you use an AI assistant to deploy or maintain PayIn Open, give it clear boundaries:

```text
You are helping me operate PayIn Open.
Before making changes, classify the task as one of:
1. Open-source repository change
2. Public documentation change
3. Sandbox environment maintenance
4. Production environment maintenance
5. Merchant integration
6. Internal operation

For production or sandbox writes, show me the exact target environment and command before executing.
Never print or commit secrets.
Start with sandbox before production.
```

Recommended rule:

- **Repository changes** should be committed and reviewed through GitHub.
- **Sandbox operations** should be tested and reversible.
- **Production operations** should be explicit, logged, and approved.

---

## Contributing

Contributions are welcome.

Good first contributions include:

- Improving merchant deployment docs
- Adding AI agent playbooks
- Adding examples for merchant integrations
- Improving sandbox setup
- Adding tests
- Improving error messages
- Adding support for more RPC providers
- Translating documentation

Before opening a pull request, please run:

```bash
npm run build
npm run test
npm run lint:check
```

---

## License

PayIn Open is released under the Apache-2.0 license. See `package.json` for the current license declaration.

---

## Links

- Repository: https://github.com/payincom/payin-open
- Issues: https://github.com/payincom/payin-open/issues
- Public docs source: [`apps/docs/`](apps/docs/)
- Agent skill: [`skills/payin-open/SKILL.md`](skills/payin-open/SKILL.md)

---

**Start with sandbox. Understand the payment flow. Then go production.**
