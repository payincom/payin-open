/**
 * Troubleshooting Prompt
 * Helps diagnose and fix PayIn integration issues
 */

export const troubleshootingPrompt = {
  name: 'troubleshoot',
  description: 'Diagnose and fix PayIn integration issues',
  arguments: [
    {
      name: 'issue_description',
      description: 'Description of the problem you are encountering',
      required: true
    },
    {
      name: 'error_message',
      description: 'Error message if any',
      required: false
    }
  ],
  handler: async (args: any) => {
    const { issue_description, error_message } = args;

    let diagnosticText = `# PayIn 故障诊断\n\n`;
    diagnosticText += `## 问题描述\n${issue_description}\n\n`;

    if (error_message) {
      diagnosticText += `## 错误信息\n\`\`\`\n${error_message}\n\`\`\`\n\n`;

      // Provide specific guidance based on error patterns
      if (error_message.includes('AUTHENTICATION_FAILED')) {
        diagnosticText += `## 诊断：认证失败\n\n`;
        diagnosticText += `这个错误通常由以下原因引起：\n\n`;
        diagnosticText += `1. **API Key 错误或过期**\n`;
        diagnosticText += `   - 检查 X-API-Key header 是否正确设置\n`;
        diagnosticText += `   - 在 PayIn Admin 中验证 API Key 状态\n\n`;
        diagnosticText += `2. **Header 格式错误**\n`;
        diagnosticText += `   - Header 名称必须是 "X-API-Key"（大小写敏感）\n`;
        diagnosticText += `   - 确保没有额外的空格或特殊字符\n\n`;
        diagnosticText += `### 解决步骤：\n`;
        diagnosticText += `1. 使用 \`get_system_health\` 工具测试连接\n`;
        diagnosticText += `2. 如果仍然失败，在 PayIn Admin 中重新生成 API Key\n`;
      } else if (error_message.includes('PERMISSION_DENIED')) {
        diagnosticText += `## 诊断：权限不足\n\n`;
        diagnosticText += `当前 API Key 缺少执行该操作所需的权限。\n\n`;
        diagnosticText += `### 常见权限要求：\n`;
        diagnosticText += `- 创建订单: \`orders:write\`\n`;
        diagnosticText += `- 查询订单: \`orders:read\`\n`;
        diagnosticText += `- 绑定充值地址: \`deposits:write\`\n`;
        diagnosticText += `- 查询充值: \`deposits:read\`\n`;
        diagnosticText += `- 查询地址池: \`address-pool:read\`\n\n`;
        diagnosticText += `### 解决步骤：\n`;
        diagnosticText += `1. 登录 PayIn Admin\n`;
        diagnosticText += `2. 进入"API Keys"页面\n`;
        diagnosticText += `3. 编辑您的 API Key\n`;
        diagnosticText += `4. 勾选所需权限并保存\n`;
      } else if (error_message.includes('ADDRESS_POOL_EXHAUSTED')) {
        diagnosticText += `## 诊断：地址池不足\n\n`;
        diagnosticText += `当前没有可用的地址分配。\n\n`;
        diagnosticText += `### 检查步骤：\n`;
        diagnosticText += `1. 使用 \`check_address_pool_availability\` 工具查看地址池状态\n`;
        diagnosticText += `2. 查看可用地址数量\n\n`;
        diagnosticText += `### 解决方案：\n`;
        diagnosticText += `- 需要通过 PayIn Admin 或地址生成工具补充地址\n`;
        diagnosticText += `- **注意**: 无法通过 MCP 或 API 导入地址\n`;
        diagnosticText += `- 考虑解绑长时间未使用的充值地址释放资源\n`;
      } else if (error_message.includes('INVALID_PARAMETERS')) {
        diagnosticText += `## 诊断：参数错误\n\n`;
        diagnosticText += `请求参数格式或内容不正确。\n\n`;
        diagnosticText += `### 常见错误：\n`;
        diagnosticText += `1. **缺少必填参数**\n`;
        diagnosticText += `   - 检查是否提供了所有必填字段\n\n`;
        diagnosticText += `2. **参数格式错误**\n`;
        diagnosticText += `   - amount 必须是字符串格式，如 "10.50"\n`;
        diagnosticText += `   - chainId 必须是有效的链标识符\n\n`;
        diagnosticText += `3. **链或代币不存在**\n`;
        diagnosticText += `   - 使用 \`list_chains\` 查看支持的链\n`;
        diagnosticText += `   - 使用 \`list_tokens\` 查看支持的代币\n\n`;
        diagnosticText += `### 解决步骤：\n`;
        diagnosticText += `1. 查看 \`docs://payin/api-reference\` 确认参数要求\n`;
        diagnosticText += `2. 验证您的参数格式和值\n`;
      }
    }

    // General diagnostic steps
    diagnosticText += `\n## 通用诊断步骤\n\n`;
    diagnosticText += `### 1. 检查系统健康\n`;
    diagnosticText += `使用 \`get_system_health\` 工具检查 PayIn 系统状态。\n\n`;

    diagnosticText += `### 2. 检查 API 连接\n`;
    diagnosticText += `确认您的应用可以正常访问 PayIn API URL。\n\n`;

    diagnosticText += `### 3. 检查地址池状态\n`;
    diagnosticText += `使用 \`check_address_pool_availability\` 工具检查是否有足够的可用地址。\n\n`;

    // Provide context-specific suggestions
    if (issue_description.toLowerCase().includes('订单') || issue_description.toLowerCase().includes('order')) {
      diagnosticText += `\n## 订单相关问题排查\n\n`;
      diagnosticText += `1. **订单未创建成功**:\n`;
      diagnosticText += `   - 检查所有必填参数是否提供\n`;
      diagnosticText += `   - 验证 chainId 和 currency 是否有效\n`;
      diagnosticText += `   - 使用 \`list_chains\` 和 \`list_tokens\` 确认配置\n\n`;
      diagnosticText += `2. **订单状态一直是 pending**:\n`;
      diagnosticText += `   - 确认用户是否已支付\n`;
      diagnosticText += `   - 使用 \`get_order\` 工具查看订单详情\n`;
      diagnosticText += `   - 使用 \`list_transfers\` 工具查看是否检测到转账\n`;
      diagnosticText += `   - 检查支付金额是否完全匹配\n\n`;
      diagnosticText += `3. **订单已过期**:\n`;
      diagnosticText += `   - 订单有 10 分钟支付窗口 + 5 分钟宽限期\n`;
      diagnosticText += `   - 需要创建新订单\n`;
    }

    if (issue_description.toLowerCase().includes('充值') || issue_description.toLowerCase().includes('deposit')) {
      diagnosticText += `\n## 充值相关问题排查\n\n`;
      diagnosticText += `1. **无法绑定地址**:\n`;
      diagnosticText += `   - 检查地址池是否有可用地址\n`;
      diagnosticText += `   - 使用 \`check_address_pool_availability\` 工具确认\n\n`;
      diagnosticText += `2. **充值未到账**:\n`;
      diagnosticText += `   - 使用 \`get_user_deposit_address\` 确认充值地址\n`;
      diagnosticText += `   - 使用 \`list_transfers\` 查询该地址的转账记录\n`;
      diagnosticText += `   - 检查用户是否转账到正确的链\n`;
      diagnosticText += `   - 在区块链浏览器中验证交易状态\n\n`;
    }

    diagnosticText += `\n## 获取更多帮助\n\n`;
    diagnosticText += `如果以上步骤无法解决问题：\n\n`;
    diagnosticText += `1. 查看完整的故障排查指南：\`docs://payin/troubleshooting\`\n`;
    diagnosticText += `2. 查看 API 参考文档：\`docs://payin/api-reference\`\n`;
    diagnosticText += `3. 查看集成指南：\`docs://payin/integration-guide\`\n`;
    diagnosticText += `4. 联系技术支持并提供：\n`;
    diagnosticText += `   - 完整的错误信息\n`;
    diagnosticText += `   - 相关的订单 ID 或交易哈希\n`;
    diagnosticText += `   - 问题发生时间\n`;
    diagnosticText += `   - 复现步骤\n`;

    return {
      messages: [{
        role: 'assistant',
        content: {
          type: 'text',
          text: diagnosticText
        }
      }]
    };
  }
};
