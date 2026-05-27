#!/bin/bash
# ============================================================
# Setup New Railway Project - Complete Automation
# ============================================================
# This script automates the entire process of setting up
# a new Railway project for PayIn deployment
# ============================================================

set -e

SERVICE_NAME=${SERVICE_NAME:-payin-api}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${YELLOW}Note: PayIn Open no longer uses INIT_DB or DEMO_DATA startup flags.${NC}"
echo "Database initialization is an explicit one-off task using the service image + env; Railway SSH is fallback."
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║         🚀 PayIn - New Railway Project Setup             ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Check Railway CLI
echo -e "${BLUE}📦 Step 1: Checking Railway CLI...${NC}"
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not installed${NC}"
    echo ""
    echo "Install it with:"
    echo "  npm install -g @railway/cli"
    echo "  or"
    echo "  brew install railway"
    exit 1
fi
echo -e "${GREEN}✅ Railway CLI found${NC}"
echo ""

# Step 2: Check authentication
echo -e "${BLUE}🔐 Step 2: Checking authentication...${NC}"
if ! railway whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Railway${NC}"
    echo ""
    echo "Please run: railway login"
    exit 1
fi
WHOAMI=$(railway whoami 2>&1 | head -1)
echo -e "${GREEN}✅ $WHOAMI${NC}"
echo ""

# Step 3: Link to Railway project
echo -e "${BLUE}📡 Step 3: Linking to Railway project...${NC}"
if ! railway status &> /dev/null 2>&1; then
    echo ""
    echo "You are not linked to a Railway project."
    echo ""
    echo "What would you like to do?"
    echo "  1) Create a new project"
    echo "  2) Link to an existing project"
    echo ""
    read -p "Enter choice (1 or 2): " choice

    case $choice in
        1)
            echo ""
            read -p "Enter project name (e.g., payin-api-production): " project_name
            echo ""
            echo "Creating new Railway project: $project_name"
            railway init
            ;;
        2)
            echo ""
            echo "Linking to existing project..."
            railway link
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
    echo ""
else
    echo -e "${GREEN}✅ Already linked to Railway project${NC}"
    railway status
fi
echo ""

# Step 4: Configure required Railway variables
echo -e "${BLUE}🔧 Step 4: Setting up required Open sandbox variables...${NC}"
echo ""
echo "This helper does not import .env files. Keep secrets in Railway and redacted in logs."
echo ""
read -p "Configure required variables now? (y/n): " manual_choice

if [ "$manual_choice" = "y" ] || [ "$manual_choice" = "Y" ]; then
    echo ""
    echo "Setting required PayIn Open variables:"
    echo "  - PAYIN_RUNTIME=open"
    echo "  - NODE_ENV=sandbox"
    echo "  - DB_CONNECTION_STRING=Railway Postgres reference"
    echo "  - JWT_SECRET=<generated/redacted>"
    echo "  - WEBHOOK_SECRET=<generated/redacted>"
    echo ""

    railway variables --set 'DB_CONNECTION_STRING=${{Postgres.DATABASE_URL}}' --skip-deploys

    read -p "JWT Secret (press Enter to auto-generate): " jwt_secret
    if [ -z "$jwt_secret" ]; then
        jwt_secret=$(openssl rand -base64 32)
        echo "Generated JWT Secret: <redacted>"
    fi
    railway variables --set "JWT_SECRET=$jwt_secret" --skip-deploys

    webhook_secret=$(openssl rand -base64 32)
    railway variables --set "WEBHOOK_SECRET=$webhook_secret" --skip-deploys

    railway variables --set "PAYIN_RUNTIME=open" --skip-deploys
    railway variables --set "NODE_ENV=sandbox" --skip-deploys

    echo ""
    echo -e "${GREEN}✅ Required variables set (secrets redacted)${NC}"
    echo "Set optional sandbox/testnet RPC provider keys later with:"
    echo "  railway variables --set 'ALCHEMY_API_KEY=<redacted>' --skip-deploys"
else
    echo ""
    echo "Please set required variables manually before deploy:"
    echo "  railway variables --set 'PAYIN_RUNTIME=open' --skip-deploys"
    echo "  railway variables --set 'NODE_ENV=sandbox' --skip-deploys"
    echo "  railway variables --set 'DB_CONNECTION_STRING=${{Postgres.DATABASE_URL}}' --skip-deploys"
    echo "  railway variables --set 'JWT_SECRET=<redacted>' --skip-deploys"
    echo "  railway variables --set 'WEBHOOK_SECRET=<redacted>' --skip-deploys"
    echo ""
    exit 0
fi
echo ""

# Step 5: Build project
echo -e "${BLUE}🔨 Step 5: Building project...${NC}"
echo "This may take 30-60 seconds..."
echo ""

if npm run build; then
    echo ""
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo ""
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

# Step 6: Deploy
echo -e "${BLUE}🚢 Step 6: Deploying to Railway...${NC}"
echo ""

read -p "Ready to deploy? (y/n): " deploy_choice

if [ "$deploy_choice" = "y" ] || [ "$deploy_choice" = "Y" ]; then
    ./deploy-fast.sh

    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                                                          ║"
    echo "║              ✅ Setup Complete!                           ║"
    echo "║                                                          ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    echo -e "${BLUE}📋 Post-deployment tasks:${NC}"
    echo ""
    echo "1. Get your app URL:"
    echo "   railway status"
    echo ""
    echo "2. Generate a public Railway domain and update BASE_URL:"
    echo "   railway domain --service $SERVICE_NAME"
    echo "   railway variables --set \"BASE_URL=https://your-app.up.railway.app\""
    echo ""
    echo "3. Initialize database schema as a one-off task inside Railway private networking:"
    echo "   Prefer Railway Dashboard one-off/scheduled execution support for the $SERVICE_NAME image"
    echo "   with the same variables, private network, and custom start command. Docs:"
    echo "   https://docs.railway.com/builds/build-and-start-commands"
    echo "   https://docs.railway.com/cron-jobs"
    echo "   Then run this command sequence in that task:"
    echo "   npm run open:doctor"
    echo "   npm run open:init -- --check"
    echo "   npm run open:init"
    echo "   npm run open:init -- --check --strict"
    echo "   If a one-off task is unavailable, configure an SSH key and use:"
    echo "   railway ssh --service $SERVICE_NAME"
    echo "   # run the same four npm commands inside the Railway shell, then exit"
    echo ""
    echo "4. Redeploy to apply BASE_URL and any other variable changes:"
    echo "   ./deploy-fast.sh"
    echo ""
    echo "5. Verify deployment after open:init:"
    echo "   curl https://your-app.up.railway.app/health"
    echo "   curl https://your-app.up.railway.app/api/chains"
    echo "   curl https://your-app.up.railway.app/api/tokens"
    echo "   npm run open:smoke -- --url https://your-app.up.railway.app"
    echo ""
else
    echo ""
    echo "Deployment skipped. You can deploy later with:"
    echo "  ./deploy-fast.sh"
    echo ""
fi
