/**
 * Unified Address Generator for Multi-Chain Testing
 *
 * Generates addresses for all protocols (EVM/Solana/Tron) from the same mnemonic
 */

import { ethers } from 'ethers'
import { Keypair } from '@solana/web3.js'
import { derivePath } from 'ed25519-hd-key'
import { TronWeb } from 'tronweb'
import { ChainTokenConfig } from './chain-config.js'

export interface GeneratedAddress {
  address: string
  protocol: 'evm' | 'solana' | 'tron'
  derivationIndex: number
  publicKey?: string
  secretKey?: string  // For Solana
}

/**
 * Unified address generator using a single mnemonic
 */
export class UnifiedAddressGenerator {
  private mnemonic: string
  private solanaMasterPublicKey: string | null = null

  constructor(mnemonic: string) {
    this.mnemonic = mnemonic
  }

  /**
   * Generate address for a specific protocol
   *
   * @param protocol Protocol type
   * @param index Derivation index
   * @returns Generated address info
   */
  generateAddress(protocol: 'evm' | 'solana' | 'tron', index: number): GeneratedAddress {
    switch (protocol) {
      case 'evm':
        return this.generateEVMAddress(index)
      case 'solana':
        return this.generateSolanaAddress(index)
      case 'tron':
        return this.generateTronAddress(index)
      default:
        throw new Error(`Unsupported protocol: ${protocol}`)
    }
  }

  /**
   * Generate EVM address (Ethereum/Polygon)
   * Uses BIP44 path: m/44'/60'/0'/0/{index}
   */
  private generateEVMAddress(index: number): GeneratedAddress {
    // Create root HD node from mnemonic, then derive using relative path
    const hdNode = ethers.HDNodeWallet.fromPhrase(this.mnemonic)
    const path = `44'/60'/0'/0/${index}` // Relative path (no "m/" prefix)
    const wallet = hdNode.derivePath(path)

    return {
      address: wallet.address,
      protocol: 'evm',
      derivationIndex: index,
      publicKey: wallet.publicKey,
    }
  }

  /**
   * Generate Solana address
   * Uses BIP44 path: m/44'/501'/0'/0'
   * Note: Solana uses a different derivation scheme
   */
  private generateSolanaAddress(index: number): GeneratedAddress {
    // Solana uses ed25519 derivation
    const mnemonic = ethers.Mnemonic.fromPhrase(this.mnemonic)
    const seed = mnemonic.computeSeed()
    const path = `m/44'/501'/${index}'/0'`

    // Convert Uint8Array to hex string
    const seedHex = Buffer.from(seed).toString('hex')
    const derivedSeed = derivePath(path, seedHex).key
    const keypair = Keypair.fromSeed(Uint8Array.from(derivedSeed))

    return {
      address: keypair.publicKey.toBase58(),
      protocol: 'solana',
      derivationIndex: index,
      publicKey: keypair.publicKey.toBase58(),
      secretKey: Buffer.from(keypair.secretKey).toString('hex'),
    }
  }

  /**
   * Generate Tron address
   * Uses same private key as EVM but with Tron's base58check encoding
   * Tron uses BIP44 path: m/44'/195'/0'/0/{index} (coin type 195 for TRX)
   */
  private generateTronAddress(index: number): GeneratedAddress {
    // Create root HD node from mnemonic, then derive using Tron's BIP44 path
    // Tron coin type is 195, not 60 (which is for Ethereum)
    const hdNode = ethers.HDNodeWallet.fromPhrase(this.mnemonic)
    const path = `44'/195'/0'/0/${index}` // Tron BIP44 path
    const wallet = hdNode.derivePath(path)

    // Remove '0x' prefix from private key for TronWeb
    const privateKeyHex = wallet.privateKey.slice(2)

    // Use TronWeb to convert the private key to a proper Tron address
    // TronWeb.address.fromPrivateKey returns a base58check encoded address
    const tronAddress = TronWeb.address.fromPrivateKey(privateKeyHex)
    if (!tronAddress) {
      throw new Error(`Failed to generate Tron address for index ${index}`)
    }

    return {
      address: tronAddress,
      protocol: 'tron',
      derivationIndex: index,
      publicKey: wallet.publicKey,
    }
  }

  /**
   * Generate multiple addresses for a protocol
   *
   * @param protocol Protocol type
   * @param count Number of addresses to generate
   * @param startIndex Starting derivation index
   * @returns Array of generated addresses
   */
  generateAddresses(
    protocol: 'evm' | 'solana' | 'tron',
    count: number,
    startIndex: number = 0
  ): GeneratedAddress[] {
    const addresses: GeneratedAddress[] = []
    for (let i = 0; i < count; i++) {
      addresses.push(this.generateAddress(protocol, startIndex + i))
    }
    return addresses
  }

  /**
   * Generate addresses for specific chain configuration
   *
   * @param chainConfig Chain configuration
   * @param count Number of addresses to generate
   * @returns Array of generated addresses
   */
  generateForChain(chainConfig: ChainTokenConfig, count: number = 10): GeneratedAddress[] {
    return this.generateAddresses(chainConfig.protocol, count)
  }

  /**
   * Get master public key (xpub) for EVM/Tron
   *
   * @returns Master public key (extended public key or deterministic Solana root)
   */
  getMasterPublicKey(protocol: 'evm' | 'solana' | 'tron' = 'evm'): string {
    if (protocol === 'solana') {
      if (!this.solanaMasterPublicKey) {
        // Derive a stable identifier so we can link pool rows to the source mnemonic.
        const mnemonic = ethers.Mnemonic.fromPhrase(this.mnemonic)
        const seedHex = Buffer.from(mnemonic.computeSeed()).toString('hex')
        const { key } = derivePath(`m/44'/501'/0'`, seedHex)
        const rootKeypair = Keypair.fromSeed(Uint8Array.from(key))
        this.solanaMasterPublicKey = rootKeypair.publicKey.toBase58()
      }
      return this.solanaMasterPublicKey
    }

    const hdNode = ethers.HDNodeWallet.fromPhrase(this.mnemonic)
    const derivationPath = "44'/60'/0'/0"
    const masterNode = hdNode.derivePath(derivationPath)
    return masterNode.extendedKey
  }
}

/**
 * Default test mnemonic (unified across all tests - has testnet funds)
 *
 * This is the same mnemonic used in fixtures.ts to ensure all protocols
 * (EVM, Solana, Tron) use the same wallet addresses for testing.
 */
export const DEFAULT_TEST_MNEMONIC =
  'prepare panel behind window cram series basket exhibit topple icon solve gate'

/**
 * Create default address generator with test mnemonic
 */
export function createDefaultAddressGenerator(): UnifiedAddressGenerator {
  return new UnifiedAddressGenerator(DEFAULT_TEST_MNEMONIC)
}
