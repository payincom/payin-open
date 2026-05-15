#!/bin/bash

# ============================================================
# PayIn Railway 本地构建脚本
# ============================================================
# 功能：在本地构建所有 packages 和 apps/api，准备部署到 Railway
# 用途：由于 Railway 构建较慢，建议本地构建后再部署
# ============================================================

set -e  # Exit on error

echo "============================================================"
echo "  PayIn Railway Local Build Script"
echo "============================================================"
echo ""

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# 清理之前的构建产物（使用 TypeScript 的 clean）
echo "📦 Cleaning previous build artifacts..."
npx tsc --build --clean
rm -rf apps/api/dist
echo "✅ Clean completed"
echo ""

# 安装依赖（确保最新）
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# 构建所有 packages（按依赖顺序）
echo "🔨 Building packages in dependency order..."

# Layer 1: No dependencies
echo "  Building shared..."
npx tsc --build packages/shared --force

# Layer 2: Depends only on shared
echo "  Building monitor, notification, email..."
npx tsc --build packages/monitor packages/notification packages/email --force

# Layer 3: Depends on layer 1+2
echo "  Building processor..."
npx tsc --build packages/processor --force

# Layer 4: Depends on layer 1+2+3
echo "  Building auth, manager..."
npx tsc --build packages/auth packages/manager --force

# Layer 5: Depends on everything
echo "  Building test-utils..."
npx tsc --build packages/test-utils --force

echo "✅ Packages built successfully"
echo ""

# 构建 apps/api
echo "🔨 Building apps/api..."
npm run build -w apps/api
echo "✅ apps/api built successfully"
echo ""

# 验证构建产物
echo "🔍 Verifying build artifacts..."
MISSING_ARTIFACTS=0

# 检查关键 packages 的 dist 目录
for pkg in shared monitor processor notification auth manager; do
    if [ ! -d "packages/$pkg/dist" ]; then
        echo "❌ Missing: packages/$pkg/dist"
        MISSING_ARTIFACTS=1
    else
        echo "✅ Found: packages/$pkg/dist"
    fi
done

# 检查 apps/api 的 dist 目录
if [ ! -d "apps/api/dist" ]; then
    echo "❌ Missing: apps/api/dist"
    MISSING_ARTIFACTS=1
else
    echo "✅ Found: apps/api/dist"
fi

echo ""

if [ $MISSING_ARTIFACTS -eq 1 ]; then
    echo "❌ Build verification failed - some artifacts are missing"
    exit 1
fi

echo "============================================================"
echo "  ✅ Build completed successfully!"
echo "============================================================"
echo ""
echo "Next steps:"
echo "  1. Commit all dist/ directories to Git (if not already in .gitignore)"
echo "  2. Push to your repository: git push"
echo "  3. Deploy to Railway:"
echo "     - Using CLI: railway up --service payin-api-test"
echo "     - Or trigger via Railway Dashboard"
echo ""
echo "💡 Tip: Make sure Railway environment variables are configured"
echo "    See: docs/self-hosting/configuration.md"
echo ""
