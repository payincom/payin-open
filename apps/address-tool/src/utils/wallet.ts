/**
 * HD Wallet utilities for address generation
 */

import { ethers, HDNodeWallet, Mnemonic } from 'ethers';
import type { Protocol, GeneratedAddress, WalletInfo } from '../types.js';

// TronWeb uses named export in ESM
import { TronWeb } from 'tronweb';

// Solana dependencies
import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import * as bip39 from 'bip39';

/**
 * Get BIP44 derivation path for protocol
 */
export function getDerivationPath(protocol: Protocol, index: number, customPath?: string): string {
  if (customPath) {
    return customPath.replace('{index}', String(index));
  }

  // Standard BIP44 paths
  switch (protocol) {
    case 'evm':
      return `m/44'/60'/0'/0/${index}`; // Ethereum coin_type: 60
    case 'tron':
      return `m/44'/195'/0'/0/${index}`; // Tron coin_type: 195
    case 'solana':
      return `m/44'/501'/${index}'/0'`; // Solana coin_type: 501
    default:
      throw new Error(`Unsupported protocol: ${protocol}`);
  }
}

/**
 * Generate or import mnemonic
 */
export function createOrImportMnemonic(mnemonicPhrase?: string): Mnemonic {
  if (mnemonicPhrase) {
    // Import existing mnemonic
    return Mnemonic.fromPhrase(mnemonicPhrase.trim());
  } else {
    // Generate new mnemonic
    return Mnemonic.fromEntropy(ethers.randomBytes(16)); // 12 words
  }
}

/**
 * Get master public key (xpub) from mnemonic
 *
 * For EVM/Tron: Returns BIP32 extended public key (xpub) that can derive child addresses
 * For Solana: Returns account-level public key (base58) as wallet identifier only
 *             (Ed25519 uses hardened derivation, cannot derive child addresses from public key)
 */
export function getMasterPublicKey(mnemonic: Mnemonic, protocol: Protocol): string {
  if (protocol === 'solana') {
    // For Solana, return the account-level public key (m/44'/501'/0') as identifier
    const seed = bip39.mnemonicToSeedSync(mnemonic.phrase);
    const accountPath = `m/44'/501'/0'`;
    const derivedSeed = derivePath(accountPath, seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derivedSeed);
    return keypair.publicKey.toBase58();
  }

  // For EVM/Tron: Get the account-level node (m/44'/coin_type'/0')
  const coinType = protocol === 'evm' ? 60 : 195;
  const accountPath = `m/44'/${coinType}'/0'`;

  const hdNode = HDNodeWallet.fromMnemonic(mnemonic, accountPath);
  // Neuter the node to get the public key only (xpub instead of xprv)
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
      privateKey: wallet.privateKey,
      path,
    });
  }

  return addresses;
}

/**
 * Generate Tron addresses
 */
export function generateTronAddresses(
  mnemonic: Mnemonic,
  startIndex: number,
  count: number,
  customPath?: string
): GeneratedAddress[] {
  const addresses: GeneratedAddress[] = [];
  const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io', // Using Nile testnet, doesn't matter for address generation
  });

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    const path = getDerivationPath('tron', index, customPath);

    // Use ethers to derive the private key from mnemonic
    const wallet = HDNodeWallet.fromMnemonic(mnemonic, path);
    const privateKeyHex = wallet.privateKey.slice(2); // Remove '0x' prefix

    // Convert to Tron address format
    const tronAddress = tronWeb.address.fromPrivateKey(privateKeyHex);

    addresses.push({
      address: tronAddress,
      derivationIndex: index,
      privateKey: privateKeyHex,
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

    // Derive keypair using ed25519-hd-key
    const derivedSeed = derivePath(path, seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derivedSeed);

    addresses.push({
      address: keypair.publicKey.toBase58(),
      derivationIndex: index,
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
 * Returns the derivation index if found, or null if not found
 */
export function verifyAddress(
  protocol: Protocol,
  mnemonic: Mnemonic,
  targetAddress: string,
  searchRange: number = 1000
): { found: boolean; index?: number; path?: string } {
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
export function createWalletInfo(
  mnemonic: Mnemonic,
  protocol: Protocol
): WalletInfo {
  return {
    mnemonic: mnemonic.phrase,
    masterPublicKey: getMasterPublicKey(mnemonic, protocol),
    protocol,
  };
}
