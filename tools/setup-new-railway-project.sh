#!/bin/bash
# ============================================================
# Setup New Railway Project - Complete Automation
# ============================================================
# This script automates the entire process of setting up
# a new Railway project for PayIn deployment
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Step 4: Import environment variables
echo -e "${BLUE}🔧 Step 4: Setting up environment variables...${NC}"
echo ""

if [ -f ".env.production" ]; then
    echo "Found .env.production file"
    read -p "Import variables from .env.production? (y/n): " import_choice

    if [ "$import_choice" = "y" ] || [ "$import_choice" = "Y" ]; then
        ./import-railway-variables.sh .env.production
    else
        echo -e "${YELLOW}Skipped variable import${NC}"
        echo "You can import later with: ./import-railway-variables.sh"
    fi
else
    echo -e "${YELLOW}⚠️  .env.production file not found${NC}"
    echo ""
    echo "Please create .env.production with your production variables:"
    echo ""
    echo "  1. Copy template:"
    echo "     cp .env.example .env.production"
    echo ""
    echo "  2. Edit with your values:"
    echo "     vim .env.production"
    echo ""
    echo "  3. Import variables:"
    echo "     ./import-railway-variables.sh"
    echo ""
    echo "  4. Deploy:"
    echo "     ./deploy-fast.sh"
    echo ""

    read -p "Do you want to manually set key variables now? (y/n): " manual_choice

    if [ "$manual_choice" = "y" ] || [ "$manual_choice" = "Y" ]; then
        echo ""
        echo "Let's set up the essential variables:"
        echo ""

        read -p "Database connection string: " db_conn
        railway variables --set "DB_CONNECTION_STRING=$db_conn" --skip-deploys

        read -p "JWT Secret (press Enter to auto-generate): " jwt_secret
        if [ -z "$jwt_secret" ]; then
            jwt_secret=$(openssl rand -base64 32)
            echo "Generated JWT Secret: $jwt_secret"
        fi
        railway variables --set "JWT_SECRET=$jwt_secret" --skip-deploys

        railway variables --set "NODE_ENV=production" --skip-deploys
        railway variables --set "INIT_DB=true" --skip-deploys
        railway variables --set "DEMO_DATA=false" --skip-deploys

        echo ""
        echo -e "${GREEN}✅ Essential variables set${NC}"
        echo "You can set remaining variables later with:"
        echo "  ./import-railway-variables.sh"
    else
        echo ""
        echo "Please set variables manually:"
        echo "  railway variables --set \"KEY=VALUE\""
        echo ""
        exit 0
    fi
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
    echo "2. Update BASE_URL variable:"
    echo "   railway variables --set \"BASE_URL=https://your-app.up.railway.app\""
    echo ""
    echo "3. After first successful run, disable database init:"
    echo "   railway variables --set \"INIT_DB=false\""
    echo ""
    echo "4. Redeploy to apply changes:"
    echo "   ./deploy-fast.sh"
    echo ""
    echo "5. Verify deployment:"
    echo "   curl https://your-app.up.railway.app/health"
    echo ""
else
    echo ""
    echo "Deployment skipped. You can deploy later with:"
    echo "  ./deploy-fast.sh"
    echo ""
fi
