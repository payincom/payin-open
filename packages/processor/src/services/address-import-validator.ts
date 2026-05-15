/**
 * 地址导入验证服务
 * 负责验证导入地址的格式、安全性和完整性
 */

import { AddressImportConfig } from '../config/token-config.js';

export interface AddressValidationResult {
  isValid: boolean;
  address: string;
  protocol: 'evm' | 'tron';
  errors: string[];
  warnings: string[];
  normalizedAddress?: string;
}

export interface BatchValidationResult {
  validAddresses: AddressValidationResult[];
  invalidAddresses: AddressValidationResult[];
  duplicates: string[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicateCount: number;
  };
}

export interface AddressImportRequest {
  address: string;
  protocol: 'evm' | 'tron';
  metadata?: Record<string, any>;
}

/**
 * 地址导入验证服务
 */
export class AddressImportValidator {
  private config: AddressImportConfig;
  private rateLimitTracker = new Map<string, { count: number; lastReset: number }>();

  constructor(config: AddressImportConfig) {
    this.config = config;
  }

  /**
   * 验证单个地址
   */
  async validateAddress(
    address: string, 
    protocol: 'evm' | 'tron'
  ): Promise<AddressValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let normalizedAddress: string | undefined;

    // 1. 基本格式验证
    const formatResult = this.validateAddressFormat(address, protocol);
    if (!formatResult.isValid) {
      errors.push(...formatResult.errors);
    } else {
      normalizedAddress = formatResult.normalizedAddress;
    }

    // 2. 安全检查
    if (this.config.validation.security.blacklistCheck) {
      const blacklistResult = this.checkBlacklist(address);
      if (!blacklistResult.isValid) {
        errors.push(...blacklistResult.errors);
      }
    }

    // 3. 空地址检查
    if (this.config.validation.security.nullAddressCheck) {
      const nullResult = this.checkNullAddress(address, protocol);
      if (!nullResult.isValid) {
        errors.push(...nullResult.errors);
      }
    }

    // 4. 校验和验证 (EVM)
    if (protocol === 'evm' && this.config.validation.chainFamilies.evm.checksumValidation) {
      const checksumResult = this.validateEVMChecksum(address);
      if (!checksumResult.isValid) {
        warnings.push(...checksumResult.warnings || []);
      }
    }

    // 5. Base58 验证 (Tron)
    if (protocol === 'tron' && this.config.validation.chainFamilies.tron.base58Validation) {
      const base58Result = this.validateTronBase58(address);
      if (!base58Result.isValid) {
        errors.push(...base58Result.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      address,
      protocol,
      errors,
      warnings,
      normalizedAddress: normalizedAddress || address,
    };
  }

  /**
   * 批量验证地址
   */
  async validateBatch(addresses: AddressImportRequest[]): Promise<BatchValidationResult> {
    const validAddresses: AddressValidationResult[] = [];
    const invalidAddresses: AddressValidationResult[] = [];
    const seenAddresses = new Set<string>();
    const duplicates: string[] = [];

    // 检查重复地址
    if (this.config.validation.security.duplicateCheck) {
      for (const request of addresses) {
        const normalizedAddr = request.address.toLowerCase();
        if (seenAddresses.has(normalizedAddr)) {
          duplicates.push(request.address);
        } else {
          seenAddresses.add(normalizedAddr);
        }
      }
    }

    // 逐一验证地址
    for (const request of addresses) {
      const result = await this.validateAddress(request.address, request.protocol);
      
      // 添加重复地址错误
      if (duplicates.includes(request.address)) {
        result.errors.push('Duplicate address in batch');
        result.isValid = false;
      }

      if (result.isValid) {
        validAddresses.push(result);
      } else {
        invalidAddresses.push(result);
      }
    }

    return {
      validAddresses,
      invalidAddresses,
      duplicates,
      summary: {
        total: addresses.length,
        valid: validAddresses.length,
        invalid: invalidAddresses.length,
        duplicateCount: duplicates.length,
      },
    };
  }

  /**
   * 检查API调用速率限制
   */
  checkRateLimit(source: 'api' | 'file', requestCount: number): { allowed: boolean; message?: string } {
    if (source !== 'api') {
      return { allowed: true };
    }

    const now = Date.now();
    const hourKey = Math.floor(now / (1000 * 60 * 60)); // 每小时的键
    const key = `api_${hourKey}`;
    
    const current = this.rateLimitTracker.get(key) || { count: 0, lastReset: now };
    
    // 重置计数器（如果超过1小时）
    if (now - current.lastReset > 60 * 60 * 1000) {
      current.count = 0;
      current.lastReset = now;
    }

    const newCount = current.count + requestCount;
    const limit = this.config.sources.api.rateLimitPerHour;

    if (newCount > limit) {
      return {
        allowed: false,
        message: `Rate limit exceeded. Current: ${current.count}, Requested: ${requestCount}, Limit: ${limit}/hour`
      };
    }

    // 更新计数器
    current.count = newCount;
    this.rateLimitTracker.set(key, current);

    return { allowed: true };
  }

  /**
   * 验证批次大小
   */
  validateBatchSize(source: 'api' | 'file', count: number): { valid: boolean; message?: string } {
    const limit = source === 'api' 
      ? this.config.sources.api.batchSizeLimit 
      : this.config.sources.api.batchSizeLimit; // 可以为文件设置不同限制

    if (count > limit) {
      return {
        valid: false,
        message: `Batch size ${count} exceeds limit of ${limit} for ${source} import`
      };
    }

    return { valid: true };
  }

  // 私有方法：地址格式验证
  private validateAddressFormat(
    address: string, 
    protocol: 'evm' | 'tron'
  ): { isValid: boolean; errors: string[]; normalizedAddress?: string } {
    const familyConfig = this.config.validation.chainFamilies[protocol];
    const errors: string[] = [];

    if (!familyConfig.addressRegex.test(address)) {
      errors.push(`Invalid ${protocol.toUpperCase()} address format: ${address}`);
      return { isValid: false, errors };
    }

    // 格式化地址
    let normalizedAddress = address;
    if (protocol === 'evm' && 'requireLowercase' in familyConfig && familyConfig.requireLowercase) {
      normalizedAddress = address.toLowerCase();
    }

    return { isValid: true, errors: [], normalizedAddress };
  }

  // 私有方法：黑名单检查
  private checkBlacklist(address: string): { isValid: boolean; errors: string[] } {
    const blacklist = this.config.validation.security.blacklistedAddresses;
    const normalizedAddress = address.toLowerCase();
    
    if (blacklist.some(addr => addr.toLowerCase() === normalizedAddress)) {
      return {
        isValid: false,
        errors: [`Address ${address} is in blacklist`]
      };
    }

    return { isValid: true, errors: [] };
  }

  // 私有方法：空地址检查
  private checkNullAddress(
    address: string, 
    protocol: 'evm' | 'tron'
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (protocol === 'evm' && address === '0x0000000000000000000000000000000000000000') {
      errors.push('Cannot use null address (0x000...)');
    }

    // Tron null address check can be added here if needed
    
    return { isValid: errors.length === 0, errors };
  }

  // 私有方法：EVM校验和验证
  private validateEVMChecksum(address: string): { isValid: boolean; warnings?: string[] } {
    // 简化的校验和验证 (实际应使用完整的EIP-55算法)
    const hasUpperCase = /[A-F]/.test(address);
    const hasLowerCase = /[a-f]/.test(address.slice(2)); // 跳过0x前缀
    
    if (hasUpperCase && hasLowerCase) {
      // 假设已经是校验和格式，这里可以添加真正的校验和验证逻辑
      return { isValid: true };
    }

    return {
      isValid: true,
      warnings: ['Address is not in checksum format, but still valid']
    };
  }

  // 私有方法：Tron Base58验证
  private validateTronBase58(address: string): { isValid: boolean; errors: string[] } {
    // 简化的Base58验证 (实际应使用专门的Base58库)
    const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
    
    if (!base58Regex.test(address)) {
      return {
        isValid: false,
        errors: ['Invalid Base58 encoding for TRON address']
      };
    }

    return { isValid: true, errors: [] };
  }
}