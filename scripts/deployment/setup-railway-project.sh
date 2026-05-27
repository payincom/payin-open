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

# 设置 Open sandbox runtime variables
echo "Setting Open sandbox runtime variables..."
railway variables --service "$SERVICE_NAME" --set "PAYIN_RUNTIME=open" --skip-deploys
railway variables --service "$SERVICE_NAME" --set "NODE_ENV=sandbox" --skip-deploys
railway variables --service "$SERVICE_NAME" --set 'DB_CONNECTION_STRING=${{Postgres.DATABASE_URL}}' --skip-deploys

echo ""
echo "Setting test environment API keys from local environment when provided..."
for key in ALCHEMY_API_KEY INFURA_API_KEY TRONGRID_API_KEY ANKR_API_KEY HELIUS_API_KEY TATUM_API_KEY; do
    value="${!key:-}"
    if [ -n "$value" ]; then
        railway variables --service "$SERVICE_NAME" --set "$key=$value" --skip-deploys
        echo "  ✅ $key configured"
    else
        echo "  ⏭️  $key not set locally; configure it later in Railway if needed"
    fi
done

# Generate JWT_SECRET
JWT_SECRET=$(openssl rand -base64 32)
railway variables --service "$SERVICE_NAME" --set "JWT_SECRET=$JWT_SECRET" --skip-deploys

# Generate WEBHOOK_SECRET
WEBHOOK_SECRET=$(openssl rand -base64 32)
railway variables --service "$SERVICE_NAME" --set "WEBHOOK_SECRET=$WEBHOOK_SECRET" --skip-deploys

echo "✅ Sandbox environment variables configured (secrets redacted)"
echo ""
echo "📝 切换到 Production 环境："
echo "   1. 在 Railway Dashboard 修改 NODE_ENV=production"
echo "   2. 更新为生产级 API Keys："
echo "      - ALCHEMY_API_KEY (production key)"
echo "      - INFURA_API_KEY (production key)"
echo "      - TRONGRID_API_KEY (production key)"
echo "      - HELIUS_API_KEY (production key)"
echo "      - JWT_SECRET (新生成: openssl rand -base64 32)"
echo "      - WEBHOOK_SECRET (新生成: openssl rand -base64 32)"
echo "      - BASE_URL (production domain)"
echo "   3. 使用 production 配置部署："
echo "      ./scripts/deployment/deploy-to-railway.sh production"
echo ""

# 步骤 5: 获取数据库连接字符串
echo "📊 Step 5/5: Getting database connection string..."
echo ""

echo "✅ DB_CONNECTION_STRING configured as Railway Postgres reference"
echo "   Do not print or copy the raw DATABASE_URL."
echo "   Run initialization as a provider one-off/scheduled task on the service image; use SSH only as fallback."
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
echo "1. Deploy your application:"
echo "   ./scripts/deployment/deploy-to-railway.sh $ENVIRONMENT"
echo ""
echo "2. Initialize database schema as a one-off task inside Railway private networking:"
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
echo "3. Generate a public domain and set BASE_URL:"
echo "   railway domain --service $SERVICE_NAME --environment $ENVIRONMENT"
echo "   railway variables --service $SERVICE_NAME --set 'BASE_URL=https://your-payin-open.up.railway.app' --skip-deploys"
echo ""
echo "4. View project in dashboard:"
echo "   railway open"
echo ""
echo "5. Monitor logs:"
echo "   railway logs --service $SERVICE_NAME"
echo ""
echo "6. Bootstrap first operator/API key/address pool:"
echo "   Register the first operator through /auth/register, create a scoped API key,"
echo "   add sandbox/testnet address-pool capacity, then verify /api/chains, /api/tokens,"
echo "   and run open:smoke with --api-key <redacted>."
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    echo "⚠️  IMPORTANT: Set production API keys in Railway Dashboard before deploying!"
    echo ""
fi
