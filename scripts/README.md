# PayIn Scripts

This directory contains utility scripts for PayIn project management and deployment.

## Database Initialization

### init-database.ts

Independent database initialization script that creates all necessary schema without requiring the main application to run.

**Usage**:
```bash
# Basic initialization (schema only)
npm run db:init

# With demo data (development only)
npm run db:init:demo

# Force reset (drops existing tables)
npm run db:init:force

# Full reset with demo data
npm run db:init:full
```

**Features**:
- ✅ Creates Auth module schema (users, sessions, audit_logs)
- ✅ Creates Manager module schema (organizations, api_keys, config_values)
- ✅ Creates Processor module schema (orders, deposits, transfers, address_pool)
- ✅ Optionally generates demo data (non-production only)
- ✅ Safe for production (skips demo data automatically)
- ✅ Idempotent (can be run multiple times safely)

**Environment Variables**:
- `DB_CONNECTION_STRING` - Database connection string (required)
- `NODE_ENV` - Environment (development/test/production)

**Command Line Options**:
- `--demo-data` - Generate demo data after initialization
- `--force` - Drop existing tables before initialization
- `--help` - Show help message

**Examples**:

```bash
# Development setup
DB_CONNECTION_STRING="postgresql://..." npm run db:init:demo

# Production deployment
DB_CONNECTION_STRING="postgresql://..." NODE_ENV=production npm run db:init

# Container provider one-off job/task
# Run with the same image, env, and private network as the API service.
npm run open:doctor
npm run open:init -- --check
npm run open:init
npm run open:init -- --check --strict
```

## Directory Structure

```
scripts/
├── README.md                          # This file
├── init-database.ts                   # Database initialization script
└── deployment/                        # Deployment-related scripts
    ├── setup-railway-project.sh       # Create new Railway project with database
    ├── build-for-railway.sh           # Build packages locally
    ├── deploy-to-railway.sh           # Deploy to Railway
    └── ...
```

## Deployment Scripts

### setup-railway-project.sh

Automates Railway project creation with PostgreSQL database.

**Usage**:
```bash
# Create Test environment
./scripts/deployment/setup-railway-project.sh test

# Create Production environment
./scripts/deployment/setup-railway-project.sh production
```

**What it does**:
- ✅ Creates Railway project and `payin-api` service
- ✅ Adds PostgreSQL database
- ✅ Configures Open sandbox variables with secrets redacted
- ✅ Sets `DB_CONNECTION_STRING` to the Railway Postgres reference
- ✅ Prints safe one-off task initialization, Railway SSH fallback, public-domain, readiness, and bootstrap next steps

**Example Output**:
```
📦 Step 1/5: Creating Railway project...
✅ Project created: your-payin-api

🗄️  Step 3/5: Adding PostgreSQL database...
✅ PostgreSQL database added

⚙️  Step 4/5: Configuring environment variables...
✅ Sandbox environment variables configured (secrets redacted)

📊 Step 5/5: Getting database connection string...
✅ DB_CONNECTION_STRING configured as Railway Postgres reference
```

### build-for-railway.sh

Builds all packages and apps locally for Railway deployment.

**Usage**:
```bash
./scripts/deployment/build-for-railway.sh
```

**What it does**:
- Runs `npm run build:packages`
- Runs `npm run build -w apps/api`
- Generates dist directories

### deploy-to-railway.sh

Deploys to Railway with local build.

**Usage**:
```bash
# Deploy to Test
./scripts/deployment/deploy-to-railway.sh test

# Deploy to Production
./scripts/deployment/deploy-to-railway.sh production
```

**What it does**:
- Builds locally
- Commits and pushes changes
- Deploys to Railway using `railway up`

## Migration from v0.1.x

### Old Way (Deprecated)

```typescript
// In apps/api/src/index.ts
if (process.env.INIT_DB === 'true') {
  await initializeDatabase();
  await generateDemoData();
}
```

```bash
INIT_DB=true DEMO_DATA=true npm run dev
```

### New Way (Recommended)

```bash
# Separate initialization from runtime
npm run open:init
npm run dev:api
```

**Benefits**:
- ✅ Clean separation of concerns
- ✅ Production builds don't depend on test-utils
- ✅ Can run initialization independently
- ✅ Better for CI/CD pipelines
- ✅ No runtime overhead

## Documentation

- [Database Initialization Guide](../docs/self-hosting/database-initialization.md) - Detailed initialization documentation
- [Deployment Guide](../docs/self-hosting/README.md) - Complete deployment guide

## Development

### Adding New Scripts

1. Create your script in this directory
2. Make it executable: `chmod +x your-script.sh`
3. Add npm script in root `package.json`
4. Document it in this README

### Testing Scripts

```bash
# Test with dry-run
tsx scripts/init-database.ts --help

# Test with local database
DB_CONNECTION_STRING="postgresql://localhost/test" tsx scripts/init-database.ts
```

## Best Practices

1. **Use npm scripts**: Always use `npm run db:*` commands instead of direct script execution
2. **Environment variables**: Set `DB_CONNECTION_STRING` before running
3. **Production safety**: Scripts auto-detect production and skip demo data
4. **Idempotency**: All scripts should be safe to run multiple times
5. **Error handling**: Scripts should exit with proper error codes

## Troubleshooting

### Script fails with "DB_CONNECTION_STRING required"

```bash
# Set the environment variable
export DB_CONNECTION_STRING="postgresql://user:pass@host:5432/db"
npm run db:init
```

### Demo data not generated

```bash
# Check NODE_ENV (demo data skipped in production)
echo $NODE_ENV

# Use explicit flag
npm run db:init:demo
```

### Tables already exist error

```bash
# Use force flag to reset
npm run db:init:force
```

## Related Documentation

- [Environment Configuration](../docs/self-hosting/configuration.md)
- [Database Schema](../packages/processor/docs/database-schema-methods.md)
- [Deployment Guide](../docs/self-hosting/README.md)
