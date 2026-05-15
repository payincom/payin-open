/**
 * Type definitions for wallet-core
 */

export type Protocol = 'evm' | 'tron' | 'solana';

export type Environment = 'cli' | 'web' | 'extension' | 'web-private' | 'web-normal';

export interface GeneratedAddress {
  address: string;
  derivationIndex: number;
  index: number;
  privateKey: string;
  path: string;
}

export interface AddressData {
  address: string;
  derivationIndex: number;
  protocol: Protocol;
  masterPublicKey: string;
}

export interface WalletInfo {
  mnemonic: string;
  masterPublicKey: string;
  protocol: Protocol;
}

export interface GenerateOptions {
  protocol: Protocol;
  mnemonic?: string;
  startIndex: number;
  count: number;
  customPath?: string;
}

export interface VerifyOptions {
  protocol: Protocol;
  mnemonic: string;
  address: string;
  searchRange: number;
}

export interface VerifyResult {
  found: boolean;
  index?: number;
  path?: string;
}

export interface ExportFormat {
  type: 'full' | 'simple';
  addresses: AddressData[];
}
