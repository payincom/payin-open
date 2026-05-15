# 绑定 docs.payin.com 到 Cloudflare Pages

本指南将帮助您将 `docs.payin.com` 绑定到 PayIn 文档站点。

## 前提条件

确认以下条件：
- ✅ `payin.com` 域名已在 Cloudflare 管理（DNS 由 Cloudflare 托管）
- ✅ PayIn 文档已部署到 Cloudflare Pages（项目名：payin-docs）
- ✅ 当前可以通过 https://payin-docs.pages.dev 访问

## 步骤 1: 通过 Cloudflare Dashboard 添加自定义域名

### 1.1 登录 Cloudflare Dashboard

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 登录您的账户

### 1.2 进入 Pages 项目

1. 在左侧菜单中，点击 **Workers & Pages**
2. 找到并点击 **payin-docs** 项目

### 1.3 添加自定义域名

1. 点击顶部的 **Custom domains** 标签
2. 点击 **Set up a custom domain** 按钮
3. 在输入框中输入：`docs.payin.com`
4. 点击 **Continue**

### 1.4 DNS 配置

Cloudflare 会自动检测您的域名是否在 Cloudflare 上管理。

#### 情况 A：域名已在 Cloudflare（推荐）

如果 `payin.com` 已经在 Cloudflare 管理：

1. Cloudflare 会显示：**"We detected that this hostname is on Cloudflare"**
2. 点击 **Activate domain** 按钮
3. ✅ **完成！** Cloudflare 会自动：
   - 创建 DNS 记录（CNAME 记录指向 payin-docs.pages.dev）
   - 配置 SSL/TLS 证书
   - 启用 CDN 和安全功能

#### 情况 B：域名不在 Cloudflare

如果域名在其他服务商（如阿里云、GoDaddy 等）：

1. Cloudflare 会提示您添加 DNS 记录
2. 记下提供的 CNAME 记录信息：
   ```
   类型: CNAME
   名称: docs
   内容: payin-docs.pages.dev
   ```
3. 去您的域名服务商后台添加此 CNAME 记录
4. 返回 Cloudflare，点击 **Verify** 验证

## 步骤 2: 等待 DNS 传播

### 2.1 验证状态

在 Cloudflare Pages 项目的 **Custom domains** 页面，您会看到：

- **Active** - 域名已激活，可以访问 ✅
- **Pending** - 等待 DNS 传播或验证 ⏳
- **Failed** - 配置失败，需要检查 ❌

### 2.2 等待时间

- **域名在 Cloudflare**: 通常 1-3 分钟生效
- **域名在其他服务商**: 可能需要 5-30 分钟

### 2.3 检查 DNS 传播

使用以下命令检查 DNS 是否生效：

```bash
# macOS/Linux
dig docs.payin.com

# 或使用 nslookup
nslookup docs.payin.com

# 预期结果：应该看到 CNAME 记录指向 payin-docs.pages.dev
```

或访问在线工具：
- https://dnschecker.org
- 输入 `docs.payin.com`，检查全球 DNS 传播状态

## 步骤 3: 验证访问

DNS 生效后，您应该可以通过以下 URL 访问文档：

- **主域名**: https://docs.payin.com
- **英文文档**: https://docs.payin.com/en/
- **中文文档**: https://docs.payin.com/zh/
- **英文快速开始**: https://docs.payin.com/en/guide/quick-start-mcp
- **中文快速开始**: https://docs.payin.com/zh/guide/quick-start-mcp

## 步骤 4: SSL/TLS 证书

### 自动配置（推荐）

如果域名在 Cloudflare 上：
- ✅ SSL 证书自动配置
- ✅ 强制 HTTPS 自动启用
- ✅ HTTP/2 和 HTTP/3 自动启用

### 验证 SSL

访问 https://docs.payin.com，浏览器地址栏应显示 🔒 锁图标。

## 故障排除

### 问题 1: "域名无法添加"

**原因**: 域名可能已被其他 Cloudflare Pages 项目使用

**解决方案**:
1. 检查是否在其他项目中使用了此域名
2. 从其他项目中移除该域名
3. 重新添加到 payin-docs 项目

### 问题 2: "DNS 验证失败"

**原因**: DNS 记录配置不正确

**解决方案**:
1. 确认 CNAME 记录的名称是 `docs`（不是 `docs.payin.com`）
2. 确认 CNAME 记录的值是 `payin-docs.pages.dev`
3. 删除任何冲突的 A 记录或其他 CNAME 记录
4. 等待 5-10 分钟后重试

### 问题 3: "SSL 证书错误"

**原因**: SSL 证书还在配置中

**解决方案**:
1. 等待 5-15 分钟让 Cloudflare 配置证书
2. 清除浏览器缓存
3. 使用无痕模式访问
4. 如果仍然失败，在 Cloudflare Dashboard 检查 SSL/TLS 设置

### 问题 4: "网站显示 404"

**原因**: DNS 正确但页面未找到

**解决方案**:
1. 确认在 Pages 项目中正确配置了自定义域名
2. 检查 Pages 项目的最新部署是否成功
3. 尝试重新部署：
   ```bash
   cd /Users/qiujianheng/Documents/dev/payin/apps/docs
   npm run build
   wrangler pages deploy .vitepress/dist --project-name=payin-docs --commit-dirty=true
   ```

## 快速参考

### 当前 URL

- **临时域名**: https://payin-docs.pages.dev ✅
- **自定义域名**: https://docs.payin.com ⏳（配置中）

### DNS 记录配置（如果域名不在 Cloudflare）

```
类型: CNAME
名称: docs
目标: payin-docs.pages.dev
TTL: 自动或 3600
代理状态: 是（橙色云朵）
```

### 后续更新文档

每次更新后，自定义域名会自动同步，无需额外配置：

```bash
cd /Users/qiujianheng/Documents/dev/payin/apps/docs
npm run build
wrangler pages deploy .vitepress/dist --project-name=payin-docs --commit-dirty=true
```

## 性能优化（可选）

在 Cloudflare Dashboard → Pages → payin-docs 中，可以启用：

- ✅ **Auto Minify**: 自动压缩 HTML/CSS/JS
- ✅ **Brotli**: 更好的压缩算法
- ✅ **HTTP/3**: 最新的网络协议
- ✅ **Early Hints**: 提前加载资源提示

## 完成检查清单

配置完成后，请验证：

- [ ] 可以访问 https://docs.payin.com
- [ ] 浏览器显示 SSL 证书有效（绿色锁图标）
- [ ] 英文文档可以正常访问
- [ ] 中文文档可以正常访问
- [ ] 导航和搜索功能正常
- [ ] 深色模式切换正常
- [ ] 页面加载速度快（全球 CDN）

## 支持

如有问题，请检查：
- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare 社区](https://community.cloudflare.com/)

---

配置完成后，您的文档将通过 `https://docs.payin.com` 全球访问！🎉
