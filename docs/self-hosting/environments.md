# Environment Separation

PayIn Open should be operated with clearly separated environments. At minimum, use one sandbox/testnet environment for integration and one production/mainnet environment for real payments.

## Recommended Environments

| Environment | Purpose | Network type | Data |
| --- | --- | --- | --- |
| Local | Developer testing | Testnet or mock data | Disposable |
| Sandbox | Merchant integration and QA | Testnet | Non-production |
| Production | Real merchant payments | Mainnet | Production |

## Separation Rules

Use separate resources for each environment:

- PostgreSQL database
- API/admin deployment
- RPC provider keys and rate limits
- JWT/API secrets
- Webhook endpoints
- Domains and callback URLs
- Monitoring and alerting

Never point sandbox services at a production database. Never reuse production secrets in local or sandbox.

## Example Environment Variables

Use placeholders in documentation and commits. Store real values only in your hosting provider or secret manager.

```bash
NODE_ENV=production
APP_ENV=production
DB_CONNECTION_STRING=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
JWT_SECRET=<generate-a-long-random-secret>
API_BASE_URL=https://your-payin.example.com
ADMIN_BASE_URL=https://admin.your-payin.example.com
WEBHOOK_BASE_URL=https://merchant.example.com/webhooks/payin

# RPC provider keys, as needed
ALCHEMY_API_KEY=<secret>
INFURA_API_KEY=<secret>
TRONGRID_API_KEY=<secret>
HELIUS_API_KEY=<secret>
```

## Local

Local is for development only.

Suggested defaults:

- Local PostgreSQL or a disposable managed database
- Testnet chains only
- Mock or development webhook endpoints
- Short-lived API keys

## Sandbox

Sandbox is for merchant integration and QA.

Checklist:

- Uses a sandbox database, not production
- Uses testnet chain configuration
- Uses sandbox webhook endpoints
- Has realistic API authentication enabled
- Can create test orders and payment pages
- Can verify monitoring and webhook delivery without real funds

## Production

Production is for real mainnet payments.

Checklist before launch:

- Separate production database
- Strong production secrets generated and stored outside git
- Mainnet RPC providers configured with sufficient rate limits
- Address pools imported and verified
- Webhook signature verification implemented by merchant systems
- Backups and restore procedure tested
- Monitoring and alerting enabled
- Rollback plan documented
- Human approval received for production deployment

## Database Safety

Production database initialization must be treated as destructive until proven otherwise.

Before running migrations or initialization:

1. Confirm the target environment.
2. Confirm the database host/name.
3. Confirm backups exist for production.
4. Confirm no destructive reset flags are enabled.
5. Run read-only status checks first when possible.

## Promotion Flow

Recommended flow:

1. Develop locally.
2. Deploy to sandbox.
3. Run testnet order/deposit flows.
4. Verify webhook delivery.
5. Review configuration differences.
6. Prepare production secrets and database.
7. Deploy production after explicit approval.
8. Run production health checks.
9. Create a small controlled production test before merchant launch.

## What Not to Commit

Do not commit:

- `.env` files
- Database URLs
- API keys
- RPC keys
- Private keys or mnemonics
- Customer data
- Provider-specific production project IDs
