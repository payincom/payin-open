# PayIn Open Development Notes

PayIn Open is the public upstream repository for PayIn's open-source stablecoin payment gateway.

## Repository model

- Public upstream: `payincom/payin-open`
- Private downstream: private PayIn commercial repository

Put reusable core functionality, public documentation, and general bug fixes in PayIn Open first. Keep managed-cloud operations, enterprise-only modules, customer-specific integrations, production secrets, and private runbooks in the downstream private repository.

See [`docs/open-source-maintenance.md`](docs/open-source-maintenance.md).

## Local development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run the public unit-test slice that does not require external services:

```bash
npm run test:unit
```

Full integration and e2e suites may require a local PostgreSQL database and application services. Do not hard-code real production connection strings or API keys in this repository.

## Configuration rule

Use environment variables and `.env.example` templates. Public examples must use placeholders such as:

```text
DB_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/payin_test
ALCHEMY_API_KEY=your_alchemy_key
INFURA_API_KEY=your_infura_key
TRONGRID_API_KEY=your_trongrid_key
HELIUS_API_KEY=your_helius_key
JWT_SECRET=change-me-in-local-dev
```

Never commit production secrets, customer data, private Railway project IDs, or personal credentials.
