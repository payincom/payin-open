# Self-hosting PayIn Open

This directory contains public self-hosting notes for PayIn Open operators.

PayIn Open is intended for merchants and teams who want to deploy and operate their own stablecoin payment gateway. These docs should stay provider-neutral where possible and should avoid private PayIn Cloud operational details.

## Start Here

1. [Getting started](./getting-started.md)
2. [Configuration](./configuration.md)
3. [Database initialization](./database-initialization.md)
4. [Environment separation](./environments.md)
5. [Chain configuration](./chains.md)
6. [Troubleshooting](./troubleshooting.md)

## Documentation Rules

- Use placeholders for domains, secrets, database URLs, and RPC keys.
- Prefer general Docker/Node/PostgreSQL guidance over provider-specific production runbooks.
- If a provider example is useful, mark it clearly as an example, not as the only supported path.
- Do not include PayIn Cloud production procedures, Railway project IDs, or customer-specific steps.
