# 通过 MCP 服务器快速开始

通过我们的 **MCP（模型上下文协议）服务器** 快速开始使用 PayIn。这使您可以使用 Claude Desktop、Cline 或任何兼容 MCP 的客户端，通过 AI 助手将 PayIn 集成到您的业务中。

## 什么是 MCP 服务器？

PayIn MCP 服务器为 PayIn 的支付基础设施提供了 AI 驱动的接口。无需手动阅读文档和编写代码，您只需与 AI 助手对话即可：

- 创建支付订单和充值地址
- 查询交易状态和支付历史
- 配置 Webhook 和系统设置
- 获取集成指导和故障排除帮助

## 前提条件

开始之前，您需要：

1. **PayIn 账户** - 在 [testnet.payin.com](https://testnet.payin.com)（测试环境）或 [app.payin.com](https://app.payin.com)（生产环境）注册
2. **API 密钥** - 从管理后台生成

::: tip 测试网 vs 主网
我们强烈建议先使用**测试网**熟悉 PayIn，然后再处理真实交易。详见 [测试网 vs 主网](/zh/guide/testnet-vs-mainnet)。
:::

## 步骤 1：注册并获取 API 密钥

### 1.1 注册账户

访问 [testnet.payin.com](https://testnet.payin.com) 并创建账户：

- **选项 1**：使用邮箱和密码注册
- **选项 2**：使用 GitHub 或 Google 登录

注册后，PayIn 会自动为您创建一个个人组织。

### 1.2 生成 API 密钥

1. 登录 PayIn 管理后台
2. 导航到 **设置** → **API 密钥**
3. 点击 **创建 API 密钥**
4. 输入名称（例如 "MCP 服务器密钥"）
5. 复制生成的 API 密钥（只会显示一次！）

::: warning 保存您的 API 密钥
API 密钥在创建时只显示一次。请安全保存 - 配置 MCP 时需要使用。
:::

## 步骤 2：配置 MCP 客户端

### Claude Desktop 配置

编辑您的 Claude Desktop 配置文件：

**macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`

添加以下配置：

```json
{
  "mcpServers": {
    "payin": {
      "url": "https://mcp.payin.com/sse",
      "transport": "sse",
      "headers": {
        "X-API-Key": "your-payin-api-key-here",
        "X-PayIn-API-URL": "https://testnet.payin.com"
      }
    }
  }
}
```

::: details 配置参数说明
- **url**: MCP 服务器端点
  - 测试网：`https://mcp.payin.com/sse`
  - 主网：`https://mcp.payin.com/sse`（相同端点，不同 API URL）
- **transport**: 连接协议 - 使用 `"sse"`（服务器发送事件）
- **X-API-Key**: 您在步骤 1.2 获取的 PayIn API 密钥
- **X-PayIn-API-URL**: PayIn API 基础 URL
  - 测试网：`https://testnet.payin.com`
  - 主网：`https://app.payin.com`
:::

### Cline 配置

对于 Cline（VS Code 扩展），添加到您的 MCP 设置：

```json
{
  "payin": {
    "command": "node",
    "args": ["/path/to/mcp-client.js"],
    "env": {
      "PAYIN_API_KEY": "your-payin-api-key-here",
      "PAYIN_API_URL": "https://testnet.payin.com"
    }
  }
}
```

### 重启客户端

保存配置后，重启 Claude Desktop 或重新加载 VS Code 窗口以激活 MCP 连接。

## 步骤 3：验证连接

打开与 AI 助手的新对话并尝试：

```
你能检查一下 PayIn MCP 服务器是否已连接吗？
```

如果成功，您的 AI 助手将确认连接并显示可用功能。

## 步骤 4：设置地址池

在创建订单或充值之前，您需要在池中准备支付地址。

::: warning 创建支付前必须完成
如果您在没有地址的情况下尝试创建订单，您会收到错误："地址池中没有可用地址"。请在继续之前完成此步骤。
:::

**快速设置：**
1. 安装地址工具：`npm install -g @payin/address-tool`
2. 生成地址：`payin-address-tool generate --mnemonic "..." --protocol evm --count 1000`
3. 通过管理界面导入：**地址池** → **导入地址**

**详细指南：**
- [地址池设置 →](/zh/guide/address-pool-setup) - 完整的分步说明

## 步骤 5：开始使用 PayIn

### 示例 1：创建支付订单

```
创建一个支付订单：
- 订单编号：ORDER-2025-001
- 金额：10 USDT
- 链：ethereum-sepolia
```

AI 将调用 `create_order` 工具并返回支付详情，包括：
- 支付地址
- 金额和币种
- 订单状态
- 支付二维码

### 示例 2：查询订单状态

```
订单 ORDER-2025-001 的状态是什么？
```

### 示例 3：集成协助

```
我如何将 PayIn 支付集成到我的 Node.js 电商后端？
```

AI 将通过代码示例指导您完成集成过程。

### 示例 4：创建充值地址

```
为用户 ID: user_123456 创建充值地址
- 币种：USDT
- 链：polygon-amoy
```

## 只读模式（无 API 密钥）

您可以在没有 API 密钥的情况下使用 MCP 服务器进行**只读**访问：

```json
{
  "mcpServers": {
    "payin": {
      "url": "https://mcp.payin.com/sse",
      "transport": "sse",
      "headers": {
        "X-PayIn-API-URL": "https://testnet.payin.com"
      }
    }
  }
}
```

在只读模式下，您可以：
- ✅ 通过 AI 访问 PayIn 文档
- ✅ 获取集成指导和代码示例
- ✅ 询问操作方法问题
- ❌ 无法创建订单或执行操作

::: tip 何时使用只读模式
当您只是探索 PayIn 或需要集成帮助而无需访问您的账户数据时，请使用只读模式。
:::

## 可用的 MCP 功能

连接后，您的 AI 助手可以使用这些 PayIn 功能：

### 🔧 工具（操作）

- **订单**：`create_order`、`get_order`、`list_orders`
- **充值**：`create_deposit_reference`、`get_deposit_reference`、`list_deposits`
- **转账**：`list_transfers`、`get_transfer`
- **地址池**：`get_pool_status`
- **配置**：`get_config`、`update_config`
- **监控**：`get_system_status`

### 📚 资源（文档）

- 访问所有 PayIn 技术文档
- API 参考和模式
- 集成示例

### 💡 提示（向导）

- **集成向导**：分步集成指导
- **故障排除助手**：诊断和修复问题

## 故障排除

### "MCP 服务器无响应"

1. 检查您的互联网连接
2. 验证 API 密钥是否正确
3. 确保 `X-PayIn-API-URL` 与您的环境（测试网/主网）匹配
4. 检查 Claude Desktop/客户端日志以获取详细错误

### "身份验证失败"

1. 验证 API 密钥是否活跃（检查管理后台）
2. 确保 API 密钥未过期
3. 检查 API 密钥字符串中是否有额外空格

### "操作不允许"

您的 API 密钥可能缺少必要权限。检查您的组织角色：
- **所有者/管理员**：对所有操作的完全访问权限
- **成员**：可以创建订单和充值，无法管理设置
- **查看者**：只读访问

## 下一步

### 基本设置
- [地址池设置](/zh/guide/address-pool-setup) - 设置支付地址（如果尚未完成）

### 了解更多
- [测试网 vs 主网](/zh/guide/testnet-vs-mainnet) - 了解环境
- [支持的网络](/zh/guide/supported-networks) - 区块链网络
- [支持的代币](/zh/guide/supported-tokens) - 稳定币详情
- [API 集成](/zh/guide/api-integration) - 直接使用 API

## 获取帮助

- 询问您的 AI 助手："如何使用 PayIn 执行 [任务]？"
- 访问 [PayIn 文档](/)
- 加入我们的 [Discord 社区](https://discord.gg/payin)
