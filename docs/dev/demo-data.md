# Demo Data Guide

This guide explains how to seed demo data for local or sandbox development.

Demo data is useful for trying the admin UI, API examples, payment links, and webhook flows without touching production data.

## Safety Rules

- Never run demo-data scripts against production.
- Always inspect `DB_CONNECTION_STRING` before running a seed command.
- Use a disposable local or sandbox database.
- Do not commit real database URLs or credentials.

## Basic Usage

```bash
export DB_CONNECTION_STRING="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"
npm run db:init:demo
```

If you need to force reinitialization in a disposable environment only:

```bash
export DB_CONNECTION_STRING="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"
npm run db:init:full
```

## Verify Target Database

Before seeding, print only a redacted connection summary in your terminal or deployment logs.

Example checklist:

- Host is local or sandbox
- Database name is not production
- User is not a production admin user
- Backup is not required because data is disposable

## Suggested Demo Flow

1. Initialize schema and demo data.
2. Start API and admin services.
3. Log in to the admin UI.
4. Confirm demo organization and API key exist.
5. Import a small test address pool.
6. Create a test order or payment link.
7. Verify the payment page renders.
8. Verify webhook test delivery using a local or sandbox endpoint.

## Cleanup

For local databases, drop and recreate the database when done.

For managed sandbox databases, use provider-native reset tools only after confirming the target environment is not production.
