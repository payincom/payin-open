/**
 * HD Wallet utilities for address generation
 */

import { ethers, HDNodeWallet, Mnemonic } from 'ethers';
import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';
import type { Protocol, GeneratedAddress, WalletInfo, VerifyResult } from './types.js';
import { base58 } from '@scure/base';
import { sha256 } from '@noble/hashes/sha256';
import { getBytes } from 'ethers';

/**
 * Get BIP44 derivation path for protocol
 */
export function getDerivationPath(protocol: Protocol, index: number, customPath?: string): string {
  if (customPath) {
    return customPath.replace('{index}', String(index));
  }

  switch (protocol) {
    case 'evm':
      return `m/44'/60'/0'/0/${index}`;
    case 'tron':
      return `m/44'/195'/0'/0/${index}`;
    case 'solana':
      return `m/44'/501'/${index}'/0'`;
    default:
      throw new Error(`Unsupported protocol: ${protocol}`);
  }
}

/**
 * Generate or import mnemonic
 */
export function createOrImportMnemonic(mnemonicPhrase?: string): Mnemonic {
  if (mnemonicPhrase) {
    return Mnemonic.fromPhrase(mnemonicPhrase.trim());
  } else {
    return Mnemonic.fromEntropy(ethers.randomBytes(16)); // 12 words
  }
}

/**
 * Get master public key (xpub) from mnemonic
 *
 * For EVM/Tron: Returns BIP32 extended public key (xpub)
 * For Solana: Returns account-level public key (base58) as identifier only
 */
export function getMasterPublicKey(mnemonic: Mnemonic, protocol: Protocol): string {
  if (protocol === 'solana') {
    const seed = bip39.mnemonicToSeedSync(mnemonic.phrase);
    const accountPath = `m/44'/501'/0'`;
    const derivedSeed = derivePath(accountPath, seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derivedSeed);
    return keypair.publicKey.toBase58();
  }

  const coinType = protocol === 'evm' ? 60 : 195;
  const accountPath = `m/44'/${coinType}'/0'`;
  const hdNode = HDNodeWallet.fromMnemonic(mnemonic, accountPath);
  return hdNode.neuter().extendedKey;
}

/**
 * Generate EVM addresses
 */
export function generateEVMAddresses(
  mnemonic: Mnemonic,
  startIndex: number,
  count: number,
  customPath?: string
): GeneratedAddress[] {
  const addresses: GeneratedAddress[] = [];

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    const path = getDerivationPath('evm', index, customPath);
    const wallet = HDNodeWallet.fromMnemonic(mnemonic, path);

    addresses.push({
      address: wallet.address,
      derivationIndex: index,
      index,
      privateKey: wallet.privateKey,
      path,
    });
  }

  return addresses;
}

/**
 * Generate Tron addresses
 */
function convertPrivateKeyToTronAddress(privateKey: string): string {
  const wallet = new ethers.Wallet(privateKey);
  const evmAddress = wallet.address.replace(/^0x/, '');
  const tronHexAddress = `0x41${evmAddress}`;
  const addressBytes = getBytes(tronHexAddress);
  const checksumFull = sha256(sha256(addressBytes));
  const checksum = checksumFull.slice(0, 4);
  const addressWithChecksum = new Uint8Array(addressBytes.length + 4);
  addressWithChecksum.set(addressBytes);
  addressWithChecksum.set(checksum, addressBytes.length);
  return base58.encode(addressWithChecksum);
}

export function generateTronAddresses(
  mnemonic: Mnemonic,
  startIndex: number,
  count: number,
  customPath?: string
): GeneratedAddress[] {
  const addresses: GeneratedAddress[] = [];

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    const path = getDerivationPath('tron', index, customPath);
    const wallet = HDNodeWallet.fromMnemonic(mnemonic, path);
    const tronAddress = convertPrivateKeyToTronAddress(wallet.privateKey);

    addresses.push({
      address: tronAddress,
      derivationIndex: index,
      index,
      privateKey: wallet.privateKey,
      path,
    });
  }

  return addresses;
}

/**
 * Generate Solana addresses
 */
export function generateSolanaAddresses(
  mnemonic: Mnemonic,
  startIndex: number,
  count: number,
  customPath?: string
): GeneratedAddress[] {
  const addresses: GeneratedAddress[] = [];
  const seed = bip39.mnemonicToSeedSync(mnemonic.phrase);

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    const path = getDerivationPath('solana', index, customPath);
    const derivedSeed = derivePath(path, seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derivedSeed);

    addresses.push({
      address: keypair.publicKey.toBase58(),
      derivationIndex: index,
      index,
      privateKey: Buffer.from(keypair.secretKey).toString('hex'),
      path,
    });
  }

  return addresses;
}

/**
 * Generate addresses for given protocol
 */
export function generateAddresses(
  protocol: Protocol,
  mnemonic: Mnemonic,
  startIndex: number,
  count: number,
  customPath?: string
): GeneratedAddress[] {
  switch (protocol) {
    case 'evm':
      return generateEVMAddresses(mnemonic, startIndex, count, customPath);
    case 'tron':
      return generateTronAddresses(mnemonic, startIndex, count, customPath);
    case 'solana':
      return generateSolanaAddresses(mnemonic, startIndex, count, customPath);
    default:
      throw new Error(`Unsupported protocol: ${protocol}`);
  }
}

/**
 * Verify if an address belongs to the given mnemonic
 */
export function verifyAddress(
  protocol: Protocol,
  mnemonic: Mnemonic,
  targetAddress: string,
  searchRange: number = 1000
): VerifyResult {
  const normalizedTarget = targetAddress.toLowerCase();

  for (let i = 0; i < searchRange; i++) {
    const addresses = generateAddresses(protocol, mnemonic, i, 1);
    const generated = addresses[0];
    const normalizedGenerated = generated.address.toLowerCase();

    if (normalizedGenerated === normalizedTarget) {
      return {
        found: true,
        index: i,
        path: generated.path,
      };
    }
  }

  return { found: false };
}

/**
 * Create wallet info object
 */
export function createWalletInfo(mnemonic: Mnemonic, protocol: Protocol): WalletInfo {
  return {
    mnemonic: mnemonic.phrase,
    masterPublicKey: getMasterPublicKey(mnemonic, protocol),
    protocol,
  };
}
