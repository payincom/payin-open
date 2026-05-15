#!/bin/bash

# ============================================================
# PayIn Railway 部署脚本（含本地构建）
# ============================================================
# 功能：本地构建 + 部署到 Railway
# 用途：一键完成从构建到部署的流程
# 注意：不包含 Git 提交和推送，需要手动管理代码版本
# ============================================================

set -e  # Exit on error

# 配置
ENVIRONMENT=${1:-test}  # 默认部署到 test 环境
SERVICE_NAME="payin-api"  # 固定的服务名称

echo "============================================================"
echo "  PayIn Railway Deployment Script"
echo "  Environment: ${ENVIRONMENT}"
echo "  Service: ${SERVICE_NAME}"
echo "  Config: railway.$([ "$ENVIRONMENT" = "production" ] && echo "" || echo "test.")toml"
echo "============================================================"
echo ""

# 检查 Railway CLI 是否安装
if ! command -v railway &> /dev/null; then
    echo "❌ Error: Railway CLI not found"
    echo "   Install with: npm i -g @railway/cli"
    exit 1
fi

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# 部署到 Railway（Railway 会自动构建）
echo "🚀 Deploying to Railway..."
echo ""
echo "ℹ️  Note: Railway will build the project on their servers"
echo "   No local build required"
echo ""
echo "   Service: $SERVICE_NAME"
echo "   Environment: $ENVIRONMENT"
echo ""

# 根据环境选择配置文件
if [ "$ENVIRONMENT" = "production" ]; then
    export RAILWAY_CONFIG_FILE="railway.production.toml"
    echo "   Using config: railway.production.toml"
else
    export RAILWAY_CONFIG_FILE="railway.test.toml"
    echo "   Using config: railway.test.toml"
fi
echo ""

# 触发部署
# 使用环境变量指定项目ID和环境
: "${RAILWAY_PROJECT_ID:?Set RAILWAY_PROJECT_ID before deploying}"
RAILWAY_ENVIRONMENT="$ENVIRONMENT" \
railway up --service "$SERVICE_NAME" --environment "$ENVIRONMENT"

echo ""
echo "============================================================"
echo "  ✅ Deployment initiated successfully!"
echo "============================================================"
echo ""
echo "💡 Tip: Remember to commit and push your changes manually:"
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
echo "  4. Test health endpoint:"
echo "     curl https://payin-api-test.up.railway.app/health"
echo ""
