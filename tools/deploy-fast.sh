#!/bin/bash
# ============================================================
# PayIn Fast Deployment to Railway
# ============================================================
# Strategy: Local build + Railway Nixpacks (no Docker)
# This is the fastest deployment method
# ============================================================

set -e

echo "🚀 PayIn Fast Deployment"
echo "================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check Railway CLI
echo ""
echo -e "${BLUE}📦 Checking Railway CLI...${NC}"
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not installed${NC}"
    echo "Install: npm install -g @railway/cli"
    exit 1
fi
echo -e "${GREEN}✅ Railway CLI found${NC}"

# Step 2: Check authentication
echo ""
echo -e "${BLUE}🔐 Checking authentication...${NC}"
if ! railway whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged in${NC}"
    echo "Run: railway login"
    exit 1
fi
WHOAMI=$(railway whoami 2>&1 | head -1)
echo -e "${GREEN}✅ Logged in as: $WHOAMI${NC}"

# Step 3: Build locally
echo ""
echo -e "${BLUE}🔨 Building project locally...${NC}"
echo "This will take ~30-60 seconds..."

npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build completed${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Step 4: Deploy to Railway
echo ""
echo -e "${BLUE}🚢 Deploying to Railway...${NC}"
echo "Uploading and starting deployment..."

# Remove Dockerfile to use Nixpacks (faster)
if [ -f "Dockerfile" ]; then
    echo -e "${YELLOW}⚠️  Temporarily renaming Dockerfile to use Nixpacks${NC}"
    mv Dockerfile Dockerfile.disabled
    RESTORE_DOCKERFILE=true
fi

railway up

DEPLOY_EXIT=$?

# Restore Dockerfile if it was renamed
if [ "$RESTORE_DOCKERFILE" = true ]; then
    mv Dockerfile.disabled Dockerfile
fi

if [ $DEPLOY_EXIT -eq 0 ]; then
    echo ""
    echo -e "${GREEN}================================"
    echo "✅ Deployment successful!"
    echo "================================${NC}"
    echo ""
    echo -e "${BLUE}📊 Next steps:${NC}"
    echo "  • View logs: railway logs"
    echo "  • Check status: railway status"
    echo "  • Open app: railway open"
    echo ""

    # Try to get the URL
    STATUS=$(railway status 2>&1 || echo "")
    if echo "$STATUS" | grep -q "https://"; then
        URL=$(echo "$STATUS" | grep -o 'https://[^ ]*' | head -1)
        echo -e "${GREEN}🌐 Your app: $URL${NC}"
        echo ""
    fi
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi
