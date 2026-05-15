# 配置管理系统设计方案

## 问题分析

### 当前问题

1. **配置分散**：
   - RPC Keys → 环境变量（YAML 中引用）
   - 链配置 → `processor_chains` 表
   - 代币配置 → `processor_tokens` 表
   - 业务规则 → `config_values` 表
   - Monitor 配置 → YAML 文件

2. **UI 管理困难**：
   - 没有统一的配置视图
   - 不知道哪些配置可以修改
   - 不知道配置的类型、范围、验证规则

3. **敏感信息处理**：
   - RPC Keys 等敏感信息需要加密存储
   - 当前存储在 YAML/环境变量中，不便于 UI 管理

## 设计方案

### 方案：元数据驱动的配置管理系统

#### 1. 配置分类

将所有配置分为三大类：

##### A. 技术基础配置（Infrastructure）
存储位置：专门表（已存在）
- **Chains** (`processor_chains`) - 链配置
- **Tokens** (`processor_tokens`) - 代币配置
- **Token-Chain Mappings** (`processor_token_chains`) - 代币-链映射
- **RPC Providers** (`processor_rpc_providers`) - RPC 提供商配置

##### B. 系统运营配置（System Settings）
存储位置：`config_values` 表（已存在）

**业务规则** (business_rules):
- `orders.payment_window_minutes` - 订单支付窗口（分钟）
- `orders.grace_period_minutes` - 订单宽限期（分钟）
- `orders.max_total_timeout_minutes` - 订单最大超时（分钟）

**地址管理** (address_management):
- `deposits.pool_management.cooldown_minutes` - 地址冷却时间（分钟）
- `deposits.pool_management.low_threshold` - 地址池告警阈值

**Monitor 配置** (monitor_settings):
- `monitor.scan_interval` - 扫描间隔（毫秒）
- `monitor.block_range_size` - 区块扫描范围
- `monitor.max_retry_attempts` - 最大重试次数
- `monitor.enabled_chains` - 启用监控的链（JSON 数组）

**延迟确认配置** (delayed_confirmation):
- `delayed_confirmation.check_interval` - 检查间隔（毫秒）
- `delayed_confirmation.max_pending_time` - 最大待确认时间（毫秒）
- `delayed_confirmation.max_retries` - 最大重试次数

##### C. 敏感配置（Secrets）
存储位置：新建 `system_secrets` 表（加密存储）

**RPC Keys**:
- `rpc.alchemy.api_key` - Alchemy API Key
- `rpc.infura.api_key` - Infura API Key
- `rpc.trongrid.api_key` - TronGrid API Key
- `rpc.ankr.api_key` - Ankr API Key

**其他密钥**:
- `webhook.secret_key` - Webhook 签名密钥
- `encryption.master_key` - 数据加密主密钥

#### 2. 配置元数据 Schema

创建配置元数据定义，描述每个配置项的特性：

```typescript
interface ConfigItemMetadata {
  key: string;                    // 配置键
  category: ConfigCategory;       // 配置分类
  type: 'string' | 'number' | 'boolean' | 'json' | 'secret';  // 数据类型
  displayName: string;            // 显示名称（UI）
  description: string;            // 详细描述
  defaultValue: any;              // 默认值
  required: boolean;              // 是否必填
  editable: boolean;              // 是否可编辑
  sensitive: boolean;             // 是否敏感（需加密）
  validation?: {                  // 验证规则
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
  uiHints?: {                     // UI 提示
    group?: string;               // 分组
    order?: number;               // 排序
    inputType?: string;           // 输入类型（text/number/select/textarea）
    placeholder?: string;
    helpText?: string;
  };
}
```

#### 3. 数据库表设计

##### system_secrets 表（新增）

```sql
CREATE TABLE system_secrets (
  key VARCHAR(255) PRIMARY KEY,
  encrypted_value TEXT NOT NULL,           -- 加密后的值
  encryption_algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
  category VARCHAR(100) NOT NULL CHECK (category IN (
    'rpc_keys',
    'api_keys',
    'webhook_secrets',
    'encryption_keys'
  )),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(255),
  last_rotated_at TIMESTAMP WITH TIME ZONE
);

-- 审计历史
CREATE TABLE system_secrets_history (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) NOT NULL,
  operation VARCHAR(20) NOT NULL CHECK (operation IN ('create', 'update', 'rotate', 'delete')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(255),
  change_reason TEXT,
  -- 不存储旧值，只记录操作
  metadata JSONB
);
```

##### config_metadata 表（新增）

```sql
CREATE TABLE config_metadata (
  key VARCHAR(255) PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  default_value JSONB,
  required BOOLEAN NOT NULL DEFAULT false,
  editable BOOLEAN NOT NULL DEFAULT true,
  sensitive BOOLEAN NOT NULL DEFAULT false,
  validation_rules JSONB,
  ui_hints JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### 4. Manager API 设计

##### 统一配置管理接口

```typescript
class ConfigurationManager {

  // ========== 配置元数据 ==========

  /**
   * 获取所有配置项的元数据
   */
  async getConfigMetadata(filters?: {
    category?: string;
    editable?: boolean;
  }): Promise<ConfigItemMetadata[]>;

  /**
   * 获取配置项分组（用于 UI 展示）
   */
  async getConfigGroups(): Promise<{
    name: string;
    displayName: string;
    items: ConfigItemMetadata[];
  }[]>;

  // ========== 配置值读取 ==========

  /**
   * 获取所有配置值（脱敏）
   * 敏感配置只返回是否已设置，不返回实际值
   */
  async getAllConfigs(options?: {
    includeSecrets?: boolean;  // 是否包含敏感配置（需要权限）
    category?: string;
  }): Promise<Record<string, any>>;

  /**
   * 获取单个配置值
   */
  async getConfig(key: string): Promise<any>;

  // ========== 配置值更新 ==========

  /**
   * 更新配置值
   */
  async setConfig(
    key: string,
    value: any,
    context?: {
      updatedBy?: string;
      reason?: string;
    }
  ): Promise<void>;

  /**
   * 批量更新配置
   */
  async setConfigs(
    configs: Record<string, any>,
    context?: {
      updatedBy?: string;
      reason?: string;
    }
  ): Promise<{
    success: string[];
    failed: { key: string; error: string }[];
  }>;

  // ========== 敏感配置管理 ==========

  /**
   * 设置敏感配置（自动加密）
   */
  async setSecret(
    key: string,
    value: string,
    context?: {
      updatedBy?: string;
      reason?: string;
    }
  ): Promise<void>;

  /**
   * 获取敏感配置（自动解密，需要权限）
   */
  async getSecret(key: string): Promise<string>;

  /**
   * 轮换密钥
   */
  async rotateSecret(
    key: string,
    newValue: string,
    context?: {
      updatedBy?: string;
      reason?: string;
    }
  ): Promise<void>;

  /**
   * 测试 RPC 连接
   */
  async testRpcConnection(provider: string, apiKey: string): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }>;

  // ========== 配置验证 ==========

  /**
   * 验证配置值
   */
  async validateConfig(key: string, value: any): Promise<{
    valid: boolean;
    errors: string[];
  }>;

  /**
   * 验证完整配置
   */
  async validateAllConfigs(): Promise<{
    valid: boolean;
    errors: { key: string; error: string }[];
  }>;

  // ========== 配置导出/导入 ==========

  /**
   * 导出配置（脱敏）
   */
  async exportConfig(options?: {
    includeSecrets?: boolean;
    format?: 'json' | 'yaml';
  }): Promise<string>;

  /**
   * 导入配置
   */
  async importConfig(
    data: string,
    options?: {
      overwrite?: boolean;
      dryRun?: boolean;
    }
  ): Promise<{
    imported: string[];
    skipped: string[];
    errors: { key: string; error: string }[];
  }>;
}
```

#### 5. 加密实现

```typescript
class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private masterKey: Buffer;

  constructor(masterKeyHex: string) {
    this.masterKey = Buffer.from(masterKeyHex, 'hex');
  }

  /**
   * 加密敏感数据
   */
  encrypt(plaintext: string): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag
    };
  }

  /**
   * 解密敏感数据
   */
  decrypt(encrypted: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.masterKey,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

#### 6. UI 集成示例

##### 配置管理页面结构

```typescript
// 1. 获取配置分组
const groups = await manager.getConfigGroups();

// 返回示例：
[
  {
    name: 'business_rules',
    displayName: '业务规则',
    items: [
      {
        key: 'orders.payment_window_minutes',
        type: 'number',
        displayName: '订单支付窗口',
        description: '订单默认支付窗口时间（分钟）',
        defaultValue: 10,
        validation: { min: 1, max: 60 },
        uiHints: {
          inputType: 'number',
          helpText: '超过此时间未支付的订单将进入宽限期'
        }
      },
      // ...
    ]
  },
  {
    name: 'rpc_keys',
    displayName: 'RPC 密钥',
    items: [
      {
        key: 'rpc.alchemy.api_key',
        type: 'secret',
        displayName: 'Alchemy API Key',
        description: 'Alchemy RPC 服务 API 密钥',
        sensitive: true,
        uiHints: {
          inputType: 'password',
          placeholder: '输入 Alchemy API Key'
        }
      },
      // ...
    ]
  }
]

// 2. 获取当前配置值
const configs = await manager.getAllConfigs({
  includeSecrets: false  // 敏感配置不返回实际值
});

// 3. 更新配置
await manager.setConfig(
  'orders.payment_window_minutes',
  15,
  {
    updatedBy: 'admin@example.com',
    reason: 'Business requirement change'
  }
);

// 4. 更新敏感配置
await manager.setSecret(
  'rpc.alchemy.api_key',
  'new-api-key',
  {
    updatedBy: 'admin@example.com',
    reason: 'Key rotation'
  }
);
```

## 实施计划

### Phase 1: 基础设施（1-2天）

1. ✅ 创建 `system_secrets` 表
2. ✅ 创建 `config_metadata` 表
3. ✅ 实现 `EncryptionService`
4. ✅ 填充配置元数据

### Phase 2: Manager API（2-3天）

1. ✅ 实现配置元数据读取
2. ✅ 实现敏感配置加密存储
3. ✅ 实现统一配置读取/更新接口
4. ✅ 实现配置验证
5. ✅ 实现配置导出/导入

### Phase 3: 配置迁移（1天）

1. ✅ 将现有配置迁移到新系统
2. ✅ 将 RPC Keys 迁移到加密存储
3. ✅ 更新 Processor 配置读取逻辑

### Phase 4: UI 集成（2-3天）

1. ✅ 创建配置管理 UI 组件
2. ✅ 实现配置编辑表单
3. ✅ 实现配置验证提示
4. ✅ 实现敏感配置安全输入

## 配置清单

### 完整的可配置项列表

#### 业务规则 (business_rules)
- `orders.payment_window_minutes` - 订单支付窗口（分钟）
- `orders.grace_period_minutes` - 订单宽限期（分钟）
- `orders.max_total_timeout_minutes` - 订单最大超时（分钟）

#### 地址管理 (address_management)
- `deposits.pool_management.cooldown_minutes` - 地址冷却时间（分钟）
- `deposits.pool_management.low_threshold` - 地址池告警阈值
- `deposits.pool_management.max_pool_size` - 地址池最大容量

#### Monitor 配置 (monitor_settings)
- `monitor.scan_interval` - 扫描间隔（毫秒）
- `monitor.block_range_size` - 区块扫描范围
- `monitor.max_retry_attempts` - 最大重试次数
- `monitor.enabled_chains` - 启用监控的链（JSON 数组）
- `monitor.recovery_mode.enabled` - 是否启用恢复模式
- `monitor.recovery_mode.lookback_blocks` - 恢复模式回溯区块数

#### 延迟确认 (delayed_confirmation)
- `delayed_confirmation.enabled` - 是否启用延迟确认
- `delayed_confirmation.check_interval` - 检查间隔（毫秒）
- `delayed_confirmation.max_pending_time` - 最大待确认时间（毫秒）
- `delayed_confirmation.max_retries` - 最大重试次数

#### RPC 密钥 (rpc_keys) - 敏感配置
- `rpc.alchemy.api_key` - Alchemy API Key
- `rpc.infura.api_key` - Infura API Key
- `rpc.trongrid.api_key` - TronGrid API Key
- `rpc.ankr.api_key` - Ankr API Key

#### 链确认要求 (chain_confirmations)
- `confirmations.ethereum-sepolia` - Ethereum Sepolia 确认数
- `confirmations.ethereum-mainnet` - Ethereum Mainnet 确认数
- `confirmations.polygon-amoy` - Polygon Amoy 确认数
- `confirmations.polygon-mainnet` - Polygon Mainnet 确认数
- `confirmations.tron-nile` - Tron Nile 确认数
- `confirmations.tron-mainnet` - Tron Mainnet 确认数

## 安全考虑

1. **加密存储**
   - 所有敏感配置必须加密存储
   - 使用 AES-256-GCM 加密算法
   - Master Key 存储在环境变量中，不入库

2. **访问控制**
   - 敏感配置的读取需要管理员权限
   - 配置修改需要审计日志
   - 密钥轮换需要双人确认

3. **审计日志**
   - 记录所有配置变更
   - 记录操作人和变更原因
   - 敏感配置不记录实际值

4. **配置验证**
   - 更新前验证配置值
   - 防止无效配置导致系统故障
   - 提供配置回滚机制

## 优势

1. **统一管理**：所有配置集中管理，UI 可完整展示和编辑
2. **类型安全**：配置元数据定义类型和验证规则
3. **安全性**：敏感配置加密存储，访问控制
4. **可维护性**：配置变更有审计日志，可追溯
5. **灵活性**：支持配置导出/导入，便于环境迁移
6. **用户友好**：UI 提示完善，配置说明清晰
