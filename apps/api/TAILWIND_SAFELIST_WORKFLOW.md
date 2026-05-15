# ✅ Tailwind Safelist 工作流（已解决 - React SSR）

**状态**: 问题已通过 React SSR 重构永久解决（2025-10-26）

## ✅ 最终解决方案（已实施）

Checkout 页面已成功重构为 React 组件（`packages/shared/src/checkout/CheckoutPage.tsx`），使用 React SSR 渲染：

- **API 服务端**: `react-dom/server` (Node.js)
- **Admin 预览**: `react-dom/server.browser` (浏览器)
- **Tailwind 扫描**: 100% 可靠，无需 safelist
- **CSS 大小**: 从 64KB 减少到 61KB
- **维护性**: ✅ 类型安全 + 组件化 + 易于测试

## 问题说明（历史）

当使用**字符串模板**生成 HTML 时（如 `payment-link-checkout-template.ts`），Tailwind 的内容扫描器可能无法可靠地提取所有类名，导致某些样式不生效。

## 根本原因

Tailwind v4 使用正则表达式扫描源代码提取类名：

| 代码格式 | 扫描可靠性 | 示例 |
|---------|-----------|------|
| JSX/TSX | ✅ 100% | `<div className="mt-6">` |
| 简单字符串 | ⚠️ ~70% | `const html = '<div class="mt-6">'` |
| 字符串拼接 | ❌ <50% | `['<div class="mt-6">'].join('')` |

## 解决方案

### 方案 1：React SSR（推荐 - 长期）

**适用场景**：新项目或可以重构的项目

**实施步骤**：

1. 安装依赖：
```bash
npm install react-dom
```

2. 重构为 React 组件：
```tsx
// packages/shared/src/PaymentLinkCheckoutPage.tsx
import { renderToString } from 'react-dom/server';

function CheckoutPage({ data, options }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background">
        <div className="mt-6 space-y-4">
          {/* ✅ 所有类名自动被扫描 */}
        </div>
      </body>
    </html>
  );
}

export const renderCheckout = (data, options) => {
  return '<!DOCTYPE html>' + renderToString(<CheckoutPage {...} />);
};
```

**优点**：
- ✅ 零配置，自动扫描所有类
- ✅ TypeScript 类型安全
- ✅ 组件可复用和测试
- ✅ 无需维护 safelist

---

### 方案 2：自动化 Safelist（推荐 - 当前）

**适用场景**：无法立即重构为 React 时

**工作流程**：

#### 步骤 1：修改模板后，提取类名

```bash
# 运行提取脚本
npm run extract-classes
```

输出示例：
```javascript
safelist: [
  'mt-6',
  'space-y-4',
  'flex',
  // ... 123 个类
],
```

#### 步骤 2：复制输出到 `tailwind.config.ts`

```typescript
// apps/api/tailwind.config.ts
export default {
  content: ['...'],
  safelist: [
    // 粘贴从 extract-classes 脚本的输出
    'mt-6',
    'space-y-4',
    // ...
  ],
};
```

#### 步骤 3：重新构建

```bash
npm run build:client
```

#### 步骤 4：验证（可选）

```bash
# 检查类是否生成
grep "\.mt-6{" public/dist/assets/style.css
```

---

## 开发规范

### ✅ 推荐做法

1. **优先使用 React 组件**（如 order-payment.tsx, deposit-payment.tsx）
2. **字符串模板仅用于简单场景**（如邮件模板）
3. **修改模板后立即运行** `npm run extract-classes`
4. **提交前检查** CSS 文件大小变化（应该增加，不应该减少）

### ❌ 避免做法

1. **不要手动维护 safelist**（容易遗漏）
2. **不要依赖"猜测"**哪些类会被扫描到
3. **不要在字符串模板中使用动态类名**（如 `class="${someVar}-mt-6"`）

---

## 故障排查

### 问题：样式不生效

**症状**：页面上某些间距、布局不正确

**检查步骤**：

1. **检查 HTML 源代码**：
```bash
curl http://localhost:3000/checkout/xxx | grep 'class='
```

2. **检查 CSS 文件**：
```bash
grep "\.mt-6{" public/dist/assets/style.css
```

3. **如果类不存在**：
```bash
# 重新提取并更新 safelist
npm run extract-classes
# 手动复制输出到 tailwind.config.ts
npm run build:client
```

### 问题：CSS 文件过大

**症状**：`style.css` 超过 100KB

**原因**：safelist 包含太多未使用的类

**解决**：
- 方案 1：迁移到 React SSR（移除 safelist）
- 方案 2：定期清理 safelist（仅保留实际使用的类）

---

## 自动化改进（TODO）

未来可以考虑：

1. **Pre-commit Hook**：
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run extract-classes && git add tailwind.config.ts"
    }
  }
}
```

2. **CI 检查**：
```yaml
# .github/workflows/ci.yml
- name: Verify Tailwind classes
  run: |
    npm run extract-classes
    git diff --exit-code tailwind.config.ts || {
      echo "❌ tailwind.config.ts safelist outdated"
      exit 1
    }
```

3. **Watch 模式**：
```bash
# 监听模板文件变化，自动更新 safelist
nodemon --watch packages/shared/src --exec "npm run extract-classes"
```

---

## 参考

- [Tailwind Content Configuration](https://tailwindcss.com/docs/content-configuration)
- [Tailwind Safelisting](https://tailwindcss.com/docs/content-configuration#safelisting-classes)
- [React SSR with renderToString](https://react.dev/reference/react-dom/server/renderToString)
