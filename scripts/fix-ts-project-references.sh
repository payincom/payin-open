#!/bin/bash

# ============================================================
# TypeScript Project References 批量修复脚本
# ============================================================

set -e

echo "🔧 Fixing TypeScript project references for all packages..."
echo ""

# 修复函数
fix_package_json() {
    local pkg=$1
    local pkg_json="packages/$pkg/package.json"

    echo "📝 Fixing $pkg_json build script..."

    # 使用 node 脚本修改 package.json
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$pkg_json', 'utf8'));
    if (pkg.scripts && pkg.scripts.build && !pkg.scripts.build.includes('--build')) {
        pkg.scripts.build = pkg.scripts.build.replace('tsc', 'tsc --build');
        if (!pkg.scripts.dev) {
            pkg.scripts.dev = 'tsc --build --watch';
        }
        fs.writeFileSync('$pkg_json', JSON.stringify(pkg, null, 2) + '\n');
        console.log('✅ Updated $pkg_json');
    }
    "
}

# 修复所有依赖 shared 的包
for pkg in monitor processor auth manager notification email test-utils; do
    if [ -d "packages/$pkg" ]; then
        fix_package_json $pkg
    fi
done

echo ""
echo "✅ All package.json files updated!"
echo ""
echo "Next steps:"
echo "1. Clean all build artifacts: rm -rf packages/*/dist packages/*/tsconfig.tsbuildinfo"
echo "2. Rebuild: npx tsc --build --force"
echo "3. Test deploy: ./scripts/deployment/deploy-to-railway.sh test"
