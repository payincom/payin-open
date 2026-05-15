/**
 * Type definitions for address-tool
 */

export type Protocol = 'evm' | 'tron' | 'solana';

export interface GeneratedAddress {
  address: string;
  derivationIndex: number;
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
  input: string; // mnemonic or xpub
  address: string;
  searchRange: number;
}

export interface ExportFormat {
  type: 'full' | 'simple';
  addresses: AddressData[];
}
