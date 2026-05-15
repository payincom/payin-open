#!/bin/bash

# ============================================================
# PayIn Admin Deployment Script for Railway
# ============================================================
#
# This script deploys the PayIn Admin frontend to Railway.
#
# Usage:
#   ./scripts/deployment/deploy-admin-to-railway.sh [environment]
#
# Arguments:
#   environment - Deployment environment (test or production)
#                 Default: test
#
# Examples:
#   ./scripts/deployment/deploy-admin-to-railway.sh test
#   ./scripts/deployment/deploy-admin-to-railway.sh production
#
# Prerequisites:
#   - Railway CLI installed (https://docs.railway.app/develop/cli)
#   - Railway project linked (run 'railway link' first)
#   - Code committed to git
#
# ============================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
ENVIRONMENT=${1:-test}
SERVICE_NAME="payin-admin"

# Validate environment
if [[ "$ENVIRONMENT" != "test" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}❌ Error: Invalid environment '$ENVIRONMENT'${NC}"
    echo "   Must be 'test' or 'production'"
    exit 1
fi

echo ""
echo "============================================================"
echo "  PayIn Admin Railway Deployment Script"
echo "  Environment: $ENVIRONMENT"
echo "  Service: $SERVICE_NAME"
echo "  Config: railway.admin.$ENVIRONMENT.toml"
echo "============================================================"
echo ""

# 部署到 Railway（Railway 会自动构建）
echo -e "${BLUE}🚀 Deploying to Railway...${NC}"
echo ""
echo "ℹ️  Note: Railway will build the project on their servers"
echo "   Docker build arguments will be injected from railway.admin.$ENVIRONMENT.toml"

# 根据环境选择配置文件
if [ "$ENVIRONMENT" = "production" ]; then
    export RAILWAY_CONFIG_FILE="railway.admin.production.toml"
else
    export RAILWAY_CONFIG_FILE="railway.admin.test.toml"
fi

# 触发部署
: "${RAILWAY_PROJECT_ID:?Set RAILWAY_PROJECT_ID before deploying}"
RAILWAY_ENVIRONMENT="$ENVIRONMENT" \
railway up --service "$SERVICE_NAME" --environment "$ENVIRONMENT"

echo ""
echo "============================================================"
echo -e "  ${GREEN}✅ Deployment initiated successfully!${NC}"
echo "============================================================"
echo ""
echo -e "${YELLOW}💡 Tip: Remember to commit and push your changes manually:${NC}"
echo "   git add ."
echo "   git commit -m \"your commit message\""
echo "   git push private main"
echo ""
echo "Next steps:"
echo "  1. Monitor deployment logs:"
echo "     railway logs --service $SERVICE_NAME --environment $ENVIRONMENT"
echo ""
echo "  2. Check deployment status:"
echo "     railway status --service $SERVICE_NAME --environment $ENVIRONMENT"
echo ""
echo "  3. View service URL:"
echo "     railway domain --service $SERVICE_NAME --environment $ENVIRONMENT"
echo ""
echo "  4. Test the deployed admin:"
echo "     Open the URL in your browser"
echo ""
