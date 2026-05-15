# Database Auto-Initialization

## Overview

Processor now supports automatic database initialization based on the environment. This feature is designed to make development easier while keeping production environments safe.

## Behavior

### Development Environment (NODE_ENV=development)

**Default**: Auto-initialize database
- Drops existing tables
- Creates all required tables
- Runs on every Processor startup

**Override**: Set `INIT_DB=false` to skip auto-initialization

### Production Environment (NODE_ENV=production)

**Default**: Skip auto-initialization
- Assumes database is already properly set up
- No automatic schema changes

**Override**: Set `INIT_DB=true` to force auto-initialization (use with caution)

## Environment Variables

### NODE_ENV
- `development` (default): Enable auto-initialization
- `production`: Disable auto-initialization

### INIT_DB
Explicit control over database initialization:
- `true`: Force initialization regardless of NODE_ENV
- `false`: Skip initialization regardless of NODE_ENV
- `undefined`: Use NODE_ENV-based defaults

## Examples

### Development (default behavior)
```bash
# Auto-initializes database on startup
npm run dev
```

### Development (skip initialization)
```bash
# Skip auto-initialization in development
INIT_DB=false npm run dev
```

### Production (default behavior)
```bash
# Does NOT auto-initialize
NODE_ENV=production npm start
```

### Production (force initialization)
```bash
# Force initialization in production (use with caution!)
NODE_ENV=production INIT_DB=true npm start
```

## What Gets Initialized

When auto-initialization runs:

1. **Schema Check**: Checks which tables exist
2. **Drop Tables** (dev only): Drops all existing tables for clean slate
3. **Create Tables**: Creates all required tables:
   - `orders`
   - `transfers`
   - `address_pool`
   - `user_addresses`
   - `chain_blocks`

## Safety Features

- **Production Protection**: Auto-init is OFF by default in production
- **Explicit Override**: Requires `INIT_DB=true` to force in production
- **Transaction Safety**: All schema changes run in database transaction
- **Error Handling**: Startup fails if initialization fails

## Integration with Tests

Integration tests can control initialization behavior:

```typescript
// Force clean database before test
process.env.NODE_ENV = 'development';
process.env.INIT_DB = 'true';
const processor = await Processor.create(config);

// Skip initialization (use existing database)
process.env.INIT_DB = 'false';
const processor = await Processor.create(config);
```

## Manual Database Management

You can still manually manage database initialization:

```typescript
const processor = await Processor.create(config);

// Check schema
const status = await processor.checkDatabaseSchema();
console.log('Missing tables:', status.missingTables);

// Manually initialize
const result = await processor.initializeDatabaseSchema({
  dropExisting: true,
  force: true
});
```

## Logging

Auto-initialization logs its actions:

```
✅ Database initialized
🔧 Auto-initializing database schema (development mode)...
   dropExisting: true
   onlyMissing: true
✅ Database schema auto-initialized
   createdTables: 5
   upgradedTables: 0
```

Or when skipped:

```
⏭️  Skipping database auto-initialization (production mode or INIT_DB=false)
```
