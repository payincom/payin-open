#!/bin/bash

# ============================================================
# PayIn Railway 项目初始化脚本
# ============================================================
# 功能：创建新的 Railway 项目并配置数据库
# 用途：仅首次部署时使用，创建单一项目，通过环境变量区分 test/production
#
# 注意：此脚本只需运行一次！后续部署使用 deploy-to-railway.sh
# ============================================================

set -e  # Exit on error

# 配置
ENVIRONMENT=${1:-test}
PROJECT_NAME="payin-api"
SERVICE_NAME="payin-api"

echo "============================================================"
echo "  PayIn Railway Project Setup (One-time only)"
echo "  Project: ${PROJECT_NAME}"
echo "  Initial Environment: ${ENVIRONMENT}"
echo "============================================================"
echo ""
echo "⚠️  This script creates a new Railway project."
echo "    If you already have a project, use deploy-to-railway.sh instead!"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi
echo ""

# 检查 Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Error: Railway CLI not found"
    echo "   Install with: npm i -g @railway/cli"
    exit 1
fi

# 检查是否已登录
echo "🔍 Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway"
    echo "   Please run: railway login"
    exit 1
fi
echo "✅ Authenticated"
echo ""

# 步骤 1: 创建项目
echo "📦 Step 1/5: Creating Railway project..."
railway init --name "$PROJECT_NAME"
echo "✅ Project created: $PROJECT_NAME"
echo ""

# 步骤 2: 添加应用服务
echo "🚀 Step 2/5: Creating application service..."
railway add --service "$SERVICE_NAME"
echo "✅ Application service created: $SERVICE_NAME"
echo ""

# 步骤 3: 添加 PostgreSQL 数据库
echo "🗄️  Step 3/5: Adding PostgreSQL database..."
railway add --database postgres
echo "✅ PostgreSQL database added"
echo ""

# 等待数据库准备
echo "⏳ Waiting for database to be provisioned (30 seconds)..."
sleep 30
echo ""

# 步骤 4: 设置环境变量
echo "⚙️  Step 4/5: Configuring environment variables..."
echo ""

# 设置初始环境为 test
echo "Setting initial NODE_ENV=test (可在 Dashboard 切换为 production)..."
railway variables --service "$SERVICE_NAME" --set "NODE_ENV=test"

echo ""
echo "Setting test environment API keys from local environment when provided..."
for key in ALCHEMY_API_KEY INFURA_API_KEY TRONGRID_API_KEY ANKR_API_KEY HELIUS_API_KEY TATUM_API_KEY; do
    value="${!key:-}"
    if [ -n "$value" ]; then
        railway variables --service "$SERVICE_NAME" --set "$key=$value"
        echo "  ✅ $key configured"
    else
        echo "  ⏭️  $key not set locally; configure it later in Railway if needed"
    fi
done

# Generate JWT_SECRET
JWT_SECRET=$(openssl rand -base64 32)
railway variables --service "$SERVICE_NAME" --set "JWT_SECRET=$JWT_SECRET"

echo "✅ Test environment variables configured"
echo ""
echo "📝 切换到 Production 环境："
echo "   1. 在 Railway Dashboard 修改 NODE_ENV=production"
echo "   2. 更新为生产级 API Keys："
echo "      - ALCHEMY_API_KEY (production key)"
echo "      - INFURA_API_KEY (production key)"
echo "      - TRONGRID_API_KEY (production key)"
echo "      - HELIUS_API_KEY (production key)"
echo "      - JWT_SECRET (新生成: openssl rand -base64 32)"
echo "      - BASE_URL (production domain)"
echo "   3. 使用 production 配置部署："
echo "      ./scripts/deployment/deploy-to-railway.sh production"
echo ""

# 步骤 5: 获取数据库连接字符串
echo "📊 Step 5/5: Getting database connection string..."
echo ""

# 尝试获取数据库 URL
DB_URL=$(railway variables --service "$SERVICE_NAME" --json 2>/dev/null | grep -o '"DATABASE_URL":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -z "$DB_URL" ]; then
    echo "⚠️  Database URL not available yet"
    echo "   It will be automatically available once the database is fully provisioned"
    echo "   Check with: railway variables --service $SERVICE_NAME | grep DATABASE_URL"
else
    echo "✅ Database URL configured"
    echo ""
    echo "Database connection string (for local initialization):"
    echo "$DB_URL"
fi
echo ""

# 完成提示
echo "============================================================"
echo "  ✅ Railway project setup complete!"
echo "============================================================"
echo ""
echo "Project: $PROJECT_NAME"
echo "Services:"
echo "  - $SERVICE_NAME (application)"
echo "  - postgres (database)"
echo ""
echo "Next steps:"
echo ""
echo "1. Get database connection string:"
echo "   railway variables --service $SERVICE_NAME | grep DATABASE_URL"
echo ""
echo "2. Initialize database schema:"
if [ "$ENVIRONMENT" = "production" ]; then
    echo "   export DB_CONNECTION_STRING=\$(railway variables --service $SERVICE_NAME --json | grep -o '\"DATABASE_URL\":\"[^\"]*\"' | cut -d'\"' -f4)"
    echo "   export NODE_ENV=production"
    echo "   npm run db:init"
else
    echo "   export DB_CONNECTION_STRING=\$(railway variables --service $SERVICE_NAME --json | grep -o '\"DATABASE_URL\":\"[^\"]*\"' | cut -d'\"' -f4)"
    echo "   npm run db:init:demo"
fi
echo ""
echo "3. Deploy your application:"
echo "   ./scripts/deployment/deploy-to-railway.sh $ENVIRONMENT"
echo ""
echo "4. View project in dashboard:"
echo "   railway open"
echo ""
echo "5. Monitor logs:"
echo "   railway logs --service $SERVICE_NAME"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    echo "⚠️  IMPORTANT: Set production API keys in Railway Dashboard before deploying!"
    echo ""
fi
