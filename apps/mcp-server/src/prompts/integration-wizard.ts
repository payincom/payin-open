/**
 * Integration Wizard Prompt
 * Guides users through PayIn integration step-by-step
 */

export const integrationWizardPrompt = {
  name: 'integration_wizard',
  description: 'Step-by-step guide to integrate PayIn into your application',
  arguments: [
    {
      name: 'use_case',
      description: 'Your integration use case: "order-payment" for one-time payments, "user-deposit" for recurring deposits, or "both"',
      required: true
    },
    {
      name: 'language',
      description: 'Your programming language (optional): typescript, javascript, python, go, etc.',
      required: false
    }
  ],
  handler: async (args: any) => {
    const { use_case, language } = args;

    let promptText = `# PayIn 集成向导\n\n`;

    // Determine use case
    if (use_case === 'order-payment' || use_case === 'both') {
      promptText += `## 订单支付集成 (Order Payment)\n\n`;
      promptText += `这个场景适用于一次性支付，如电商订单、票务支付等。\n\n`;
      promptText += `### 步骤 1: 创建订单\n`;
      promptText += `使用 \`create_order\` 工具创建支付订单：\n\n`;
      promptText += `参数说明：\n`;
      promptText += `- orderReference: 您系统的订单号\n`;
      promptText += `- amount: 支付金额\n`;
      promptText += `- currency: 代币符号（如 USDT）\n`;
      promptText += `- chainId: 区块链 ID（使用 list_chains 查看支持的链）\n\n`;
      promptText += `### 步骤 2: 展示支付信息\n`;
      promptText += `将返回的 address 展示给用户，并提示：\n`;
      promptText += `- 支付金额\n`;
      promptText += `- 支付地址\n`;
      promptText += `- 选择的链\n`;
      promptText += `- 倒计时（基于 expiresAt）\n\n`;
      promptText += `### 步骤 3: 监听支付状态\n`;
      promptText += `两种方式：\n`;
      promptText += `1. 配置 callbackUrl 接收 Webhook 通知（推荐）\n`;
      promptText += `2. 使用 get_order 工具轮询订单状态\n\n`;
    }

    if (use_case === 'user-deposit' || use_case === 'both') {
      if (use_case === 'both') {
        promptText += `\n---\n\n`;
      }
      promptText += `## 用户充值集成 (User Deposit)\n\n`;
      promptText += `这个场景适用于多次充值，如游戏充值、钱包充值、平台余额等。\n\n`;
      promptText += `### 步骤 1: 绑定充值地址\n`;
      promptText += `使用 \`bind_deposit_address\` 工具为用户绑定永久充值地址：\n\n`;
      promptText += `参数说明：\n`;
      promptText += `- depositReference: 您系统的用户标识\n`;
      promptText += `- protocol: 协议族（evm 或 tron）\n\n`;
      promptText += `### 步骤 2: 保存并展示地址\n`;
      promptText += `将返回的 address 保存到数据库，并展示给用户作为充值地址。\n\n`;
      promptText += `### 步骤 3: 监听充值\n`;
      promptText += `用户每次充值后，系统会自动检测并记录。\n`;
      promptText += `使用 \`list_transfers\` 工具查询该地址的充值记录。\n\n`;
    }

    // Add language-specific notes
    if (language) {
      promptText += `\n---\n\n`;
      promptText += `## ${language.toUpperCase()} 实现建议\n\n`;
      promptText += `PayIn 提供标准的 HTTP API，您可以使用任何 HTTP 客户端库：\n\n`;

      switch (language.toLowerCase()) {
        case 'typescript':
        case 'javascript':
          promptText += `\`\`\`typescript\n`;
          promptText += `const response = await fetch('https://api.payin.com/api/v1/orders', {\n`;
          promptText += `  method: 'POST',\n`;
          promptText += `  headers: {\n`;
          promptText += `    'X-API-Key': 'your-api-key',\n`;
          promptText += `    'Content-Type': 'application/json'\n`;
          promptText += `  },\n`;
          promptText += `  body: JSON.stringify({\n`;
          promptText += `    orderReference: 'order_001',\n`;
          promptText += `    amount: '10.50',\n`;
          promptText += `    currency: 'USDT',\n`;
          promptText += `    chainId: 'ethereum-sepolia'\n`;
          promptText += `  })\n`;
          promptText += `});\n`;
          promptText += `const data = await response.json();\n`;
          promptText += `\`\`\`\n`;
          break;
        case 'python':
          promptText += `\`\`\`python\n`;
          promptText += `import requests\n\n`;
          promptText += `response = requests.post(\n`;
          promptText += `    'https://api.payin.com/api/v1/orders',\n`;
          promptText += `    headers={'X-API-Key': 'your-api-key'},\n`;
          promptText += `    json={\n`;
          promptText += `        'orderReference': 'order_001',\n`;
          promptText += `        'amount': '10.50',\n`;
          promptText += `        'currency': 'USDT',\n`;
          promptText += `        'chainId': 'ethereum-sepolia'\n`;
          promptText += `    }\n`;
          promptText += `)\n`;
          promptText += `data = response.json()\n`;
          promptText += `\`\`\`\n`;
          break;
      }
    }

    promptText += `\n---\n\n`;
    promptText += `## 下一步\n\n`;
    promptText += `1. 使用 \`list_chains\` 工具查看支持的区块链\n`;
    promptText += `2. 使用 \`list_tokens\` 工具查看支持的代币\n`;
    promptText += `3. 使用 \`check_address_pool_availability\` 工具检查地址池状态\n`;
    promptText += `4. 查看文档资源 \`docs://payin/integration-guide\` 了解更多细节\n\n`;
    promptText += `如遇到问题，请查看 \`docs://payin/troubleshooting\` 故障排查指南。\n`;

    return {
      messages: [{
        role: 'assistant',
        content: {
          type: 'text',
          text: promptText
        }
      }]
    };
  }
};
