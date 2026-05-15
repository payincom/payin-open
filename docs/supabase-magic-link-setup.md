# PayIn Supabase Magic Link 邮件模板配置指南

## 模板文件
- **HTML 模板**: `docs/supabase-magic-link-template.html`

## 配置步骤

### 1. 登录 Supabase Dashboard
访问你的 Supabase 项目控制台：https://app.supabase.com

### 2. 导航到邮件模板设置
1. 选择你的项目
2. 点击左侧菜单 **Authentication**
3. 点击 **Email Templates** 标签
4. 选择 **Magic Link** 模板

### 3. 配置邮件模板

#### Subject（邮件主题）
```
Sign in to PayIn Admin
```

#### HTML 内容
将 `docs/supabase-magic-link-template.html` 的完整内容复制粘贴到 HTML 编辑器中。

### 4. 可用变量说明

模板中使用了以下 Supabase 提供的变量：

| 变量 | 说明 | 使用位置 |
|------|------|---------|
| `{{ .ConfirmationURL }}` | Magic Link 确认链接 | 登录按钮和备用链接 |
| `{{ .Email }}` | 用户邮箱地址 | 邮件底部说明 |
| `{{ .Token }}` | 6位数OTP（可选） | 未使用，可扩展 |
| `{{ .SiteURL }}` | 应用URL（可选） | 未使用，可扩展 |

### 5. 测试邮件模板

#### 方法1：通过 Supabase Dashboard 测试
1. 在 Email Templates 页面点击 **Send test email**
2. 输入测试邮箱地址
3. 检查邮件外观和链接是否正常

#### 方法2：通过应用测试
1. 启动 PayIn Admin 开发环境：`npm run dev:admin`
2. 访问登录页面
3. 切换到 **Magic Link** 标签
4. 输入测试邮箱并提交
5. 检查收到的邮件

### 6. 高级配置（可选）

#### 自定义重定向 URL
在发送 Magic Link 时可以指定重定向地址：

```typescript
const { error } = await supabase.auth.signInWithOtp({
  email: magicLinkEmail,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

#### OTP 模式（备选方案）
如果担心邮件服务商预加载链接，可以改用 OTP 模式：

**模板修改**：将 `{{ .ConfirmationURL }}` 替换为 `{{ .Token }}`

**代码修改**：使用 `verifyOtp` 验证：
```typescript
const { error } = await supabase.auth.verifyOtp({
  email,
  token, // 用户输入的6位数字
  type: 'magiclink'
});
```

## 模板特性

### ✨ 设计特点
- **品牌一致性**: 采用 PayIn Website 的极简黑白风格
- **IBM Plex Sans 字体**: 品牌字体，带有特定 letter-spacing (0.025em)
- **干净排版**: 简洁的黑白灰配色，专业易读
- **微妙细节**: 细边框、浅阴影、圆角设计
- **高对比度**: 清晰的视觉层次

### 🎨 配色方案
- **主色**: `#171717` (深黑) - 用于标题和按钮
- **文字**: `#525252` (中灰) - 正文内容
- **辅助文字**: `#737373` (浅灰) - 次要信息
- **背景**: `#fafafa` (极浅灰) - 邮件背景
- **边框**: `#e5e5e5` (浅灰) - 分隔线和边框
- **代码背景**: `#f5f5f5` (浅灰) - 链接展示区域

### 🔒 安全特性
- 清晰的安全警告（灰色边框卡片）
- 过期时间提示（1小时）
- 单次使用说明
- 收件人邮箱确认

### 📱 兼容性
- 支持所有主流邮件客户端
- 使用 table 布局确保兼容性
- 内联样式避免被过滤
- 系统字体回退方案

## 故障排查

### 邮件未收到
1. 检查垃圾邮件文件夹
2. 确认 Supabase SMTP 配置正确
3. 检查邮箱地址是否正确

### 链接无效
1. 确认链接未过期（1小时）
2. 检查 `emailRedirectTo` 配置是否正确
3. 确认 Site URL 在 Supabase 中正确配置

### 字体显示异常
1. IBM Plex Sans 无法加载时会回退到系统字体
2. 核心布局和功能不受影响
3. 所有邮件客户端都能正常显示

## 参考文档
- [Supabase Email Templates 官方文档](https://supabase.com/docs/guides/auth/auth-email-templates)
- [PayIn OAuth 集成文档](./supabase-oauth-integration.md)
