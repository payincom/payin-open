#!/bin/bash
# ============================================================
# Import Environment Variables from .env file to Railway
# ============================================================
# Usage: ./import-railway-variables.sh [env-file]
# Default: .env.production
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Importing Environment Variables to Railway${NC}"
echo "=================================================="

# Default to .env.production, allow custom file
ENV_FILE="${1:-.env.production}"

# Check if file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ File not found: $ENV_FILE${NC}"
    echo ""
    echo "Please create $ENV_FILE with your variables"
    echo "You can copy from .env.example:"
    echo ""
    echo "  cp .env.example $ENV_FILE"
    echo "  vim $ENV_FILE  # Edit with your values"
    echo ""
    exit 1
fi

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not installed${NC}"
    echo "Install: npm install -g @railway/cli"
    exit 1
fi

# Check authentication
if ! railway whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Railway${NC}"
    echo "Run: railway login"
    exit 1
fi

# Check if linked to a project
if ! railway status &> /dev/null 2>&1; then
    echo -e "${RED}❌ Not linked to a Railway project${NC}"
    echo "Run: railway link"
    exit 1
fi

echo ""
echo -e "${BLUE}Reading from: $ENV_FILE${NC}"
echo ""

# Counter for imported variables
COUNT=0
SKIPPED=0

# Read file line by line
while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip comments (lines starting with #)
    if [[ "$key" =~ ^#.* ]]; then
        continue
    fi

    # Skip empty lines
    if [ -z "$key" ]; then
        continue
    fi

    # Skip lines without '='
    if [ -z "$value" ]; then
        echo -e "${YELLOW}⚠️  Skipping (no value): $key${NC}"
        ((SKIPPED++))
        continue
    fi

    # Remove leading/trailing whitespace from key
    key=$(echo "$key" | xargs)

    # Remove quotes from value (both single and double)
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

    # Skip if value is empty after quote removal
    if [ -z "$value" ]; then
        echo -e "${YELLOW}⚠️  Skipping (empty value): $key${NC}"
        ((SKIPPED++))
        continue
    fi

    # Import to Railway (skip automatic deployment)
    echo -e "${GREEN}✓${NC} Setting: $key"

    if railway variables --set "$key=$value" --skip-deploys > /dev/null 2>&1; then
        ((COUNT++))
    else
        echo -e "${RED}✗${NC} Failed to set: $key"
    fi

done < "$ENV_FILE"

echo ""
echo "=================================================="
echo -e "${GREEN}✅ Import Complete!${NC}"
echo ""
echo "📊 Statistics:"
echo "  • Variables imported: $COUNT"
echo "  • Variables skipped:  $SKIPPED"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo ""
echo "1. Verify imported variables:"
echo "   railway variables"
echo ""
echo "2. Deploy to Railway:"
echo "   ./deploy-fast.sh"
echo ""
echo "3. After first deployment, update:"
echo "   railway variables --set \"BASE_URL=https://your-app.up.railway.app\""
echo "   railway variables --set \"INIT_DB=false\""
echo "   ./deploy-fast.sh"
echo ""
