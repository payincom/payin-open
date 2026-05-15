# PayIn MCP Server 部署指南

## 本地开发

### 1. 安装依赖

```bash
cd apps/mcp-server
npm install
```

### 2. 配置环境变量

创建 `.dev.vars` 文件（开发环境变量）：

```bash
DEFAULT_PAYIN_API_URL=http://localhost:3000
LOG_LEVEL=debug
```

### 3. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:8787` 启动。

### 4. 测试 MCP Server

#### 健康检查

```bash
curl http://localhost:8787/health
```

#### 测试 MCP 端点

```bash
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "X-PayIn-API-URL: http://localhost:3000" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }'
```

#### 测试 Tools 列表

```bash
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "X-PayIn-API-URL: http://localhost:3000" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

## 配置 MCP Client

### Claude Desktop

编辑 Claude Desktop 配置文件：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

添加配置：

```json
{
  "mcpServers": {
    "payin-local": {
      "url": "http://localhost:8787/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "your-payin-api-key",
        "X-PayIn-API-URL": "http://localhost:3000"
      }
    }
  }
}
```

重启 Claude Desktop，即可开始使用 PayIn MCP Server。

## 部署到 Cloudflare Workers

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 配置生产环境

编辑 `wrangler.toml`：

```toml
[env.production]
name = "payin-mcp-server-prod"
vars = { DEFAULT_PAYIN_API_URL = "https://your-payin-api.com" }
```

### 4. 部署

```bash
# 部署到开发环境
wrangler deploy

# 部署到生产环境
wrangler deploy --env production
```

### 5. 查看部署信息

```bash
wrangler deployments list
```

部署成功后，您会得到一个 Cloudflare Workers URL，例如：
```
https://payin-mcp-server.your-subdomain.workers.dev
```

### 6. 配置生产环境的 MCP Client

```json
{
  "mcpServers": {
    "payin": {
      "url": "https://payin-mcp-server.your-subdomain.workers.dev/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "your-production-api-key",
        "X-PayIn-API-URL": "https://api.payin.com"
      }
    }
  }
}
```

## 监控和日志

### 查看实时日志

```bash
wrangler tail
```

### 查看日志（生产环境）

```bash
wrangler tail --env production
```

### 查看指标

```bash
wrangler metrics
```

## 环境变量管理

### 开发环境

使用 `.dev.vars` 文件（不要提交到 Git）：

```
DEFAULT_PAYIN_API_URL=http://localhost:3000
LOG_LEVEL=debug
```

### 生产环境

使用 `wrangler.toml` 的 `[env.production.vars]` 或 Cloudflare Dashboard 设置：

```bash
wrangler secret put API_SECRET --env production
```

## 自定义域名（可选）

### 1. 在 Cloudflare Dashboard 添加 Workers Route

1. 登录 Cloudflare Dashboard
2. 选择您的域名
3. 进入 Workers Routes
4. 添加 Route：`mcp.your-domain.com/*` → `payin-mcp-server-prod`

### 2. 更新 MCP Client 配置

```json
{
  "mcpServers": {
    "payin": {
      "url": "https://mcp.your-domain.com/mcp",
      "transport": "streamable-http",
      ...
    }
  }
}
```

## 故障排查

### 问题：部署失败

**检查**：
- Wrangler CLI 版本是否最新
- 是否已登录 Cloudflare
- `wrangler.toml` 配置是否正确

**解决**：
```bash
npm install -g wrangler@latest
wrangler login
wrangler whoami
```

### 问题：MCP Client 无法连接

**检查**：
- URL 是否正确
- API Key 是否有效
- 网络是否可达

**测试**：
```bash
curl https://your-worker-url/health
```

### 问题：CORS 错误

MCP Server 已配置 CORS，如果仍有问题：

1. 检查 Cloudflare Workers 设置
2. 确认请求 headers 正确
3. 查看浏览器开发者工具的网络日志

## 性能优化

### 1. 启用 Cloudflare Cache

在 `wrangler.toml` 中配置：

```toml
[env.production]
kv_namespaces = [
  { binding = "CACHE", id = "your-kv-namespace-id" }
]
```

### 2. 设置 Worker 限制

```toml
[limits]
cpu_ms = 50000  # 最大 CPU 时间（毫秒）
```

### 3. 监控性能

使用 Cloudflare Analytics 监控：
- 请求数
- 错误率
- P50/P95/P99 延迟

## 安全建议

### 1. API Key 保护

- ✅ 使用 Cloudflare Workers Secrets
- ✅ 定期轮换 API Key
- ❌ 不要在代码中硬编码 API Key

### 2. 访问控制

考虑添加 IP 白名单或认证层：

```typescript
// 在 index.ts 中添加
const ALLOWED_IPS = ['1.2.3.4', '5.6.7.8'];

if (!ALLOWED_IPS.includes(request.headers.get('CF-Connecting-IP') || '')) {
  return new Response('Forbidden', { status: 403 });
}
```

### 3. 速率限制

使用 Cloudflare Rate Limiting 或实现自定义限制。

## 成本估算

Cloudflare Workers 定价（2025）：

- **Free Plan**: 100,000 requests/day
- **Paid Plan**: $5/month + $0.50 per million requests

对于大多数场景，Free Plan 足够使用。

## 更新部署

```bash
# 1. 更新代码
git pull

# 2. 安装依赖
npm install

# 3. 类型检查
npm run typecheck

# 4. 部署
wrangler deploy --env production
```

## 回滚

```bash
# 查看历史部署
wrangler deployments list

# 回滚到特定版本
wrangler rollback <deployment-id>
```

## 获取帮助

- 📖 [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)
- 📖 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- 💬 [Cloudflare Discord](https://discord.gg/cloudflaredev)
