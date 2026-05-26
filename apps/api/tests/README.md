# API Business E2E Tests

These tests exercise PayIn Open through the Web Server API. They create real Order and Deposit business flows and send real blockchain transactions on public testnets only.

## Safety Scope

- Run these tests only against a local or Railway-hosted self-hosted PayIn Open sandbox/testnet deployment.
- Do not point these tests at mainnet RPCs, production databases, or PayIn Cloud services.
- The bundled test mnemonic is intended for testnet funds only. Never fund it with mainnet assets.
- The tests use testnet chains selected by `E2ETestUtils`: `ethereum-sepolia`, `polygon-amoy`, and `tron-nile`.

## Prerequisites

1. Install dependencies from the repository root with `npm install`.
2. Configure a local sandbox environment for PayIn Open, including `DB_CONNECTION_STRING`, `JWT_SECRET`, `WEBHOOK_SECRET`, `PAYIN_RUNTIME=open`, and `NODE_ENV=sandbox`.
3. Initialize the Open database explicitly with `npm run open:init` or the appropriate documented database initialization command for your local setup.
4. Start the local API, processor, and monitor from the repository root with `npm run dev:api`.
5. Ensure the test account can authenticate and belongs to an organization.
6. Ensure the bundled testnet wallet has enough testnet token balance and gas for the selected chains.

## Authentication Environment

The tests log in through the API before running business flows.

```bash
# Optional; defaults are admin/admin123 when unset
export TEST_USERNAME=admin
export TEST_PASSWORD=admin123

# Recommended for PayIn Open; when unset, tests try the hosted/Cloud organizations route
export TEST_ORGANIZATION_ID=00000000-0000-0000-0000-000000000001

# Optional; fixes the chain for deterministic deployment verification
export TEST_CHAIN=ethereum-sepolia
```

Use credentials from your Open sandbox. Do not use production or Cloud credentials. Do not print secrets in logs or shell history. For PayIn Open deployments, set `TEST_ORGANIZATION_ID` explicitly because the hosted multi-tenant `/organizations` route is disabled.

## Start Local Services

Run this in one terminal from the repository root:

```bash
npm run dev:api
```

`npm run dev:api` starts the API plus the processor and monitor packages required for transfer detection. `npm run dev` is also available for the full concurrent local development stack.

The API must answer `http://localhost:3000/health` before running the E2E tests. Set `E2E_BASE_URL` to target a non-local sandbox API.

## Run Focused E2E Tests

Run these commands from another terminal at the repository root:

```bash
# Order payment business flow
npm run test:e2e:order

# Deposit business flow
npm run test:e2e:deposit
```

The root scripts resolve to the exact API test files:

```bash
vitest run apps/api/tests/e2e-order-payment.test.ts
vitest run apps/api/tests/e2e-deposit-flow.test.ts
```

## Railway-Hosted Reproduction

Use this only for a Railway-hosted PayIn Open sandbox/testnet deployment that you control. Do not use mainnet RPCs, production databases, PayIn Cloud services, or commands that print secrets.

```bash
export E2E_BASE_URL=https://your-payin-open.up.railway.app
export TEST_USERNAME=admin
export TEST_PASSWORD='use-your-sandbox-password'
export TEST_ORGANIZATION_ID=00000000-0000-0000-0000-000000000001
export TEST_CHAIN=ethereum-sepolia

curl "$E2E_BASE_URL/health"
npm run test:e2e:order
npm run test:e2e:deposit
```

`TEST_ORGANIZATION_ID` should be explicit for PayIn Open because the hosted multi-tenant `/organizations` route is disabled. Set `TEST_CHAIN` to a chain with funded sender wallet and available address-pool capacity; otherwise the tests choose randomly from `ethereum-sepolia`, `polygon-amoy`, and `tron-nile`.

## What Each Test Covers

### `e2e-order-payment.test.ts`

1. Logs in and selects an organization.
2. Initializes address-pool capacity through the API when needed.
3. Creates an order through the API.
4. Sends a real testnet payment to the order address.
5. Polls the API until the order completes.
6. Verifies transfer confirmation and order state.

### `e2e-deposit-flow.test.ts`

1. Logs in and selects an organization.
2. Binds a deposit address through the API.
3. Sends real testnet deposit payments.
4. Polls the API for transfer detection.
5. Verifies transfer records and deposit behavior.
6. Exercises deposit address unbinding/reuse behavior.

## Troubleshooting

### Web Server is not running

Start PayIn Open from the repository root:

```bash
npm run dev:api
```

Then verify:

```bash
curl http://localhost:3000/health
```

### Login fails

Confirm `TEST_USERNAME`, `TEST_PASSWORD`, and `TEST_ORGANIZATION_ID` match your local initialized Open database. For PayIn Open, prefer setting `TEST_ORGANIZATION_ID` explicitly; when it is unset the tests try the hosted/Cloud `/organizations` lookup, which is disabled in Open deployments.

### Address pool is empty

The tests attempt to add test addresses through the API. If this fails, check the API logs and confirm your local Open database is initialized.

### Transaction or timeout failures

These flows depend on public testnets and local monitor polling. Check testnet token/gas balances, RPC connectivity, monitor logs, and current testnet congestion before retrying. Use `TEST_CHAIN` to avoid randomly selecting a chain without funded sender wallet, RPC access, or address-pool capacity. Override `SEPOLIA_RPC_URL`, `POLYGON_AMOY_RPC_URL`, or `TRON_NILE_API_URL` when public RPC defaults are slow or unavailable.

## CI Guidance

These tests are not hermetic unit tests. Only run them in CI jobs that provision an isolated sandbox database, start the local PayIn Open API stack, and use testnet-only funds and RPCs. Do not include them in default unit-test jobs.
