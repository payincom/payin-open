# Railway Sandbox Example

This page is a provider-specific example for a self-hosted PayIn Open sandbox/testnet deployment on Railway. PayIn Open does not require Railway; any Docker/container provider with PostgreSQL, private networking, secrets, and one-off jobs/tasks can use the same deployment model. Keep production/mainnet runbooks separate, keep secrets redacted, and do not publish Railway project IDs or private service IDs.

## 1. Create Railway resources

Install and authenticate the Railway CLI, then create a new sandbox project with an API service and Postgres database:

```bash
railway login
railway init --name payin-open-sandbox
railway add --service payin-api
railway add --database postgres
```

If you are already linked to another project, run `railway link` or work from a clean checkout before creating the sandbox.

## 2. Configure required variables

Set variables on the `payin-api` service. Use Railway references for database connectivity and generated values for secrets. Do not paste full secret values into logs, docs, tickets, or AI transcripts.

| Variable | Required | Scope | Value guidance |
| --- | ---: | --- | --- |
| `PAYIN_RUNTIME` | Yes | `payin-api` | `open` |
| `NODE_ENV` | Yes | `payin-api` | `sandbox` for testnet verification |
| `DB_CONNECTION_STRING` | Yes | `payin-api` | `${{Postgres.DATABASE_URL}}`; avoid copying the raw database URL |
| `JWT_SECRET` | Yes | `payin-api` | Generate with `openssl rand -base64 32`; keep redacted |
| `WEBHOOK_SECRET` | Yes | `payin-api` | Generate with `openssl rand -base64 32`; keep redacted |
| `BASE_URL` | After domain | `payin-api` | Public Railway domain, for example `https://your-payin-open.up.railway.app` |
| RPC provider keys | Optional | `payin-api` | Add sandbox/testnet keys only when public defaults are insufficient |

```bash
railway variables --service payin-api --set 'PAYIN_RUNTIME=open' --skip-deploys
railway variables --service payin-api --set 'NODE_ENV=sandbox' --skip-deploys
railway variables --service payin-api --set 'DB_CONNECTION_STRING=${{Postgres.DATABASE_URL}}' --skip-deploys
railway variables --service payin-api --set "JWT_SECRET=$(openssl rand -base64 32)" --skip-deploys
railway variables --service payin-api --set "WEBHOOK_SECRET=$(openssl rand -base64 32)" --skip-deploys
```

Do not set `INIT_DB` or `DEMO_DATA`. PayIn Open initializes schema through a one-off `npm run open:init` task, not through API container startup hooks.

## 3. Deploy the API service

Use the repository `Dockerfile`. The image includes the built API plus operator scripts so the same image can run one-off init and smoke commands. A cold Railway build can take 10 minutes or longer. Poll status and inspect build logs before restarting or creating another deployment.

```bash
railway up --service payin-api --detach
railway status
railway logs --service payin-api --deployment
```

If the deployment remains in `BUILDING`, check the build log tail, wait for completion, and avoid printing variables. If runtime starts but `/api/chains` or `/api/tokens` returns 500, verify that `open:init` has completed against the Railway Postgres database.

## 4. Initialize with a one-off task

Run initialization after variables are set and the service image has deployed. Prefer Railway's provider-supported one-off or scheduled-execution mechanism on the deployed `payin-api` image with the same variables and private network as the service. Use the Railway Dashboard flow for your workspace: run a temporary/scheduled execution or task-like service with the `payin-api` image, service variables, and a custom start command, then inspect its logs and disable/remove the temporary execution after it succeeds. Railway references: [Build and start commands](https://docs.railway.com/builds/build-and-start-commands), [Cron jobs](https://docs.railway.com/cron-jobs), and [Railway SSH](https://docs.railway.com/cli/ssh).

Use this command sequence as the one-off task command:

```bash
npm run open:doctor
npm run open:init -- --check
npm run open:init
npm run open:init -- --check --strict
```

This pattern is intentionally the same as other container providers: same image, same env, same private network, explicit one-off command. It avoids running database initialization from a laptop that cannot resolve Railway private Postgres hosts.

Do not use local `railway run ... open:init` when `DB_CONNECTION_STRING` points at Railway private Postgres through a reference such as `${{Postgres.DATABASE_URL}}`; local commands may not resolve hosts like `postgres.railway.internal`.

If a one-off Railway task/job is not available in your workspace or CLI version, use Railway SSH as the fallback. Railway SSH requires an SSH key configured on your Railway account:

```bash
railway ssh --service payin-api
# inside the Railway shell:
npm run open:doctor
npm run open:init -- --check
npm run open:init
npm run open:init -- --check --strict
exit
```

`open:init` prepares schemas and the Open merchant organization. It does not create a default login or password.

## 5. Add a public domain

Create a public domain, then set `BASE_URL` to that domain:

```bash
railway domain --service payin-api
railway variables --service payin-api --set 'BASE_URL=https://your-payin-open.up.railway.app' --skip-deploys
```

Use placeholder domains in documentation and replace them locally with the actual Railway-generated URL.

## 6. Verify process health and readiness

```bash
curl https://your-payin-open.up.railway.app/health
curl https://your-payin-open.up.railway.app/api/chains
curl https://your-payin-open.up.railway.app/api/tokens
npm run open:smoke -- --url https://your-payin-open.up.railway.app
```

`/health` can be 200 before database bootstrap is complete; it only proves the API process is responding. `/api/chains`, `/api/tokens`, and `open:smoke -- --url` are the readiness/config checks to run after `open:init` succeeds.

## 7. Bootstrap operator access

PayIn Open is headless and local-first. After database initialization:

1. Register the first local operator through `/auth/register`; public registration locks after the first operator.
2. Use the operator session to create a scoped merchant API key.
3. Add sandbox/testnet address-pool capacity for the chains you plan to verify.
4. Run live smoke checks with the API key redacted in logs.

The external operator CLI can assist after the API URL exists:

```bash
npm exec --yes --package github:payincom/payin-cli -- payin profile add sandbox https://your-payin-open.up.railway.app
npm exec --yes --package github:payincom/payin-cli -- payin doctor --profile sandbox --json
npm exec --yes --package github:payincom/payin-cli -- payin api-key create --profile sandbox --name backend-orders-service --json
npm exec --yes --package github:payincom/payin-cli -- payin address-pool status --profile sandbox --json
npm run open:smoke -- --url https://your-payin-open.up.railway.app --api-key <redacted> --create-order --chain-id ethereum-sepolia --currency USDC
```

Business API-key requests in Open runtime should not send `X-Organization-Id`; API keys auto-scope to the Open merchant organization.

## Troubleshooting

- `relation "config_values" does not exist`: run the one-off `npm run open:init` sequence on the deployed `payin-api` image with Railway variables and private networking; use Railway SSH only as fallback.
- `/health` passes but `/api/chains` or `/api/tokens` returns 500: check schema initialization, DB connectivity, and runtime logs.
- Deployment appears stuck in `BUILDING`: wait at least 10 minutes on cold builds, then inspect `railway logs --service payin-api --deployment`.
- Variable updates are flaky: retry `railway variables --service payin-api --set ... --skip-deploys`, then confirm with a one-off `npm run open:doctor -- --strict` task or provider shell without dumping variables.
- Never paste `DATABASE_URL`, JWT secrets, webhook secrets, API keys, or private Railway IDs into public docs or reports.
