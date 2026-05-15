/**
 * Amount Utility Functions
 * Provides consistent amount conversion and validation across the system
 */

export interface TokenDecimalConfig {
  [tokenSymbol: string]: number;
}

/**
 * Default token decimal configurations
 */
export const DEFAULT_TOKEN_DECIMALS: TokenDecimalConfig = {
  'USDC': 6,
  'USDT': 6,
  'DAI': 18,
  'ETH': 18,
  'MATIC': 18,
  'TRX': 6,
  'BTC': 8
};

/**
 * Amount utilities for consistent precision handling
 */
export class AmountUtils {
  /**
   * Convert Wei amount to decimal representation
   * @param weiAmount - Amount in Wei (smallest unit)
   * @param decimals - Number of decimal places for the token
   * @returns Decimal string representation with 6 decimal places
   */
  static convertWeiToDecimal(weiAmount: string, decimals: number): string {
    const divisor = Math.pow(10, decimals);
    const amount = parseFloat(weiAmount) / divisor;
    return amount.toFixed(6);
  }

  /**
   * Convert Wei amount to decimal using token symbol
   * @param weiAmount - Amount in Wei
   * @param tokenSymbol - Token symbol (e.g., 'USDC', 'USDT')
   * @returns Decimal string representation
   */
  static convertWeiToDecimalByToken(weiAmount: string, tokenSymbol: string): string {
    const decimals = DEFAULT_TOKEN_DECIMALS[tokenSymbol] || 6;
    return this.convertWeiToDecimal(weiAmount, decimals);
  }

  /**
   * Convert decimal amount to Wei representation
   * @param decimalAmount - Decimal amount as string
   * @param decimals - Number of decimal places for the token
   * @returns Wei amount as string
   */
  static convertDecimalToWei(decimalAmount: string, decimals: number): string {
    const multiplier = Math.pow(10, decimals);
    const amount = parseFloat(decimalAmount) * multiplier;
    return Math.floor(amount).toString();
  }

  /**
   * Parse amount string to bigint for precise calculations
   * @param amount - Amount as string
   * @returns BigInt representation
   */
  static parseAmount(amount: string): bigint {
    // Remove any decimal points and convert to integer representation
    const parts = amount.split('.');
    if (parts.length === 1) {
      return BigInt(amount);
    }

    const wholePart = parts[0];
    const decimalPart = parts[1].padEnd(18, '0').slice(0, 18); // Pad to 18 decimals
    return BigInt(wholePart + decimalPart);
  }

  /**
   * Format bigint amount to decimal string
   * @param amount - Amount as bigint
   * @param decimals - Number of decimal places
   * @returns Formatted decimal string
   */
  static formatAmount(amount: bigint, decimals: number): string {
    const divisor = BigInt(Math.pow(10, decimals));
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    return `${wholePart}.${fractionalStr}`.replace(/\.?0+$/, '') || '0';
  }

  /**
   * Add two amount strings with precision
   * @param amount1 - First amount
   * @param amount2 - Second amount
   * @returns Sum as string
   */
  static addAmounts(amount1: string, amount2: string): string {
    const a1 = parseFloat(amount1);
    const a2 = parseFloat(amount2);
    return (a1 + a2).toFixed(6);
  }

  /**
   * Compare two amount strings
   * @param amount1 - First amount
   * @param amount2 - Second amount
   * @returns -1 if amount1 < amount2, 0 if equal, 1 if amount1 > amount2
   */
  static compareAmounts(amount1: string, amount2: string): number {
    const a1 = parseFloat(amount1);
    const a2 = parseFloat(amount2);
    if (a1 < a2) return -1;
    if (a1 > a2) return 1;
    return 0;
  }

  /**
   * Check if received amount is sufficient for required amount
   * @param receivedAmount - Amount received
   * @param requiredAmount - Amount required
   * @returns True if received amount is sufficient
   */
  static isAmountSufficient(receivedAmount: string, requiredAmount: string): boolean {
    return parseFloat(receivedAmount) >= parseFloat(requiredAmount);
  }

  /**
   * Validate amount string format
   * @param amount - Amount to validate
   * @returns True if valid amount format
   */
  static isValidAmount(amount: string): boolean {
    if (!amount || typeof amount !== 'string') return false;
    const parsed = parseFloat(amount);
    return !isNaN(parsed) && parsed >= 0;
  }

  /**
   * Round amount to specified decimal places
   * @param amount - Amount to round
   * @param decimals - Number of decimal places
   * @returns Rounded amount string
   */
  static roundAmount(amount: string, decimals: number = 6): string {
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) return '0';
    return parsed.toFixed(decimals);
  }
}