/**
 * Deposit Service Configuration
 * 充值服务配置 - 定义支持的代币在不同链上的合约地址和地址管理配置
 */

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  contracts: {
    [chainId: string]: string;  // chainId -> contract address
  };
}

/**
 * 地址导入验证配置
 */
export interface AddressImportConfig {
  // 格式验证配置
  validation: {
    chainFamilies: {
      evm: {
        addressRegex: RegExp;
        checksumValidation: boolean;  // EIP-55 checksum 验证
        requireLowercase: boolean;
      };
      tron: {
        addressRegex: RegExp;
        base58Validation: boolean;    // Base58 格式验证
        requireSpecificPrefix: string;
      };
    };
    
    // 安全检查
    security: {
      blacklistCheck: boolean;        // 检查黑名单
      duplicateCheck: boolean;        // 重复地址检查
      nullAddressCheck: boolean;      // 空地址检查 (0x000...)
      blacklistedAddresses: string[]; // 黑名单地址列表
    };
  };
  
  // 导入来源管理
  sources: {
    api: {
      batchSizeLimit: number;         // API 一次最多导入地址数
      rateLimitPerHour: number;       // 每小时最多导入数
      requireAuthentication: boolean;  // 需要管理员权限
    };
    
    file: {
      maxFileSizeMB: number;          // 文件大小限制
      supportedFormats: string[];     // 支持的文件格式
      requiredColumns: string[];      // CSV必须包含的列
      optionalColumns: string[];      // 可选列
    };
  };
}

/**
 * 地址池管理配置
 */
export interface AddressPoolManagementConfig {
  // 库存管理
  inventory: {
    minAvailableAddresses: number;    // 最少保持可用地址数
    lowInventoryThreshold: number;    // 低库存警告阈值
    criticalInventoryThreshold: number; // 紧急警告阈值
    preallocationCount: number;       // 预分配地址数量
  };
  
  // 分配策略
  allocation: {
    strategy: 'random' | 'fifo' | 'least_used'; // 分配策略
    reusePolicy: 'never' | 'after_unbind' | 'after_inactive_days';
    reuseWaitMinutes: number;        // 地址释放后等待分钟数才能重用
  };
  
}

/**
 * Token configurations - populated from YAML configuration at runtime
 */
let SUPPORTED_TOKENS: Record<string, TokenConfig> = {};

/**
 * Initialize token configurations from YAML config
 * This should be called by ProcessorCore during initialization
 */
export function initializeTokens(tokensConfig: Record<string, TokenConfig>): void {
  SUPPORTED_TOKENS = { ...tokensConfig };
}

/**
 * Get the current supported tokens registry
 * For testing and debugging purposes
 */
export function getSupportedTokensRegistry(): Record<string, TokenConfig> {
  return { ...SUPPORTED_TOKENS };
}

/**
 * 获取特定代币在指定链上的合约地址
 */
export function getTokenContract(tokenSymbol: string, chainId: string): string | null {
  const token = SUPPORTED_TOKENS[tokenSymbol];
  if (!token) return null;
  
  return token.contracts[chainId] || null;
}

/**
 * 获取特定代币支持的所有链
 */
export function getTokenSupportedChains(tokenSymbol: string): string[] {
  const token = SUPPORTED_TOKENS[tokenSymbol];
  if (!token) return [];
  
  return Object.keys(token.contracts);
}

/**
 * 验证链是否支持指定代币
 */
export function isTokenSupportedOnChain(tokenSymbol: string, chainId: string): boolean {
  const contract = getTokenContract(tokenSymbol, chainId);
  return contract !== null;
}

/**
 * 生成监控目标配置
 */
export function generateMonitoringTargets(userAddress: string, protocol: 'evm' | 'tron') {
  const targets = [];
  
  // 直接根据 chain family 确定支持的链
  const supportedChainIds = protocol === 'evm' 
    ? ['ethereum-sepolia', 'polygon-amoy'] 
    : ['tron-nile'];
  
  for (const chainId of supportedChainIds) {
    for (const [tokenSymbol, tokenConfig] of Object.entries(SUPPORTED_TOKENS)) {
      const contractAddress = tokenConfig.contracts[chainId];
      if (contractAddress) {
        targets.push({
          chain: chainId,
          contract: contractAddress,
          token: tokenSymbol,
          toAddress: userAddress
        });
      }
    }
  }
  
  return targets;
}

/**
 * 默认地址导入验证配置
 */
export const DEFAULT_ADDRESS_IMPORT_CONFIG: AddressImportConfig = {
  validation: {
    chainFamilies: {
      evm: {
        addressRegex: /^0x[a-fA-F0-9]{40}$/,
        checksumValidation: true,
        requireLowercase: false,
      },
      tron: {
        addressRegex: /^T[a-zA-Z0-9]{33}$/,
        base58Validation: true,
        requireSpecificPrefix: 'T',
      },
    },
    security: {
      blacklistCheck: true,
      duplicateCheck: true,
      nullAddressCheck: true,
      blacklistedAddresses: [
        '0x0000000000000000000000000000000000000000', // ETH null address
        'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',          // TRON null address (example)
      ],
    },
  },
  sources: {
    api: {
      batchSizeLimit: 1000,
      rateLimitPerHour: 10000,
      requireAuthentication: true,
    },
    file: {
      maxFileSizeMB: 10,
      supportedFormats: ['csv', 'json'],
      requiredColumns: ['address', 'protocol'],
      optionalColumns: ['metadata'],
    },
  },
};

/**
 * 默认地址池管理配置
 */
export const DEFAULT_ADDRESS_POOL_CONFIG: AddressPoolManagementConfig = {
  inventory: {
    minAvailableAddresses: 100,
    lowInventoryThreshold: 50,
    criticalInventoryThreshold: 20,
    preallocationCount: 200,
  },
  allocation: {
    strategy: 'random',
    reusePolicy: 'after_unbind',
    reuseWaitMinutes: 30,
  },
};
