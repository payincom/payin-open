/**
 * Load test wallets - generates from TEST_MNEMONIC
 */
import { Keypair } from '@solana/web3.js'
import { ethers } from 'ethers'
import { derivePath } from 'ed25519-hd-key'

// Unified test mnemonic (same as in fixtures.ts)
const TEST_MNEMONIC = 'prepare panel behind window cram series basket exhibit topple icon solve gate'

export interface SolanaWalletInfo {
  address: string
  secretKey: string  // Hex format
  keypair: Keypair
}

export interface EVMWalletInfo {
  address: string
  privateKey: string
  wallet: ethers.Wallet
}

export class WalletLoader {
  /**
   * Generate Solana wallet from TEST_MNEMONIC
   * @param walletName - 'sender' (index 0) or 'receiver' (index 1)
   * @returns Solana wallet information with Keypair instance
   */
  static loadSolana(walletName: string): SolanaWalletInfo {
    // Map wallet name to derivation index
    const indexMap: Record<string, number> = {
      'sender': 0,
      'receiver': 1
    }

    const index = indexMap[walletName]
    if (index === undefined) {
      throw new Error(`Unknown wallet name: ${walletName}. Use 'sender' or 'receiver'.`)
    }

    // Generate Solana wallet from TEST_MNEMONIC
    const mnemonic = ethers.Mnemonic.fromPhrase(TEST_MNEMONIC)
    const hexSeed = mnemonic.computeSeed()  // Already returns hex string
    const path = `m/44'/501'/${index}'/0'`
    const { key } = derivePath(path, hexSeed)
    const keypair = Keypair.fromSeed(key)

    return {
      address: keypair.publicKey.toBase58(),
      secretKey: Buffer.from(keypair.secretKey).toString('hex'),
      keypair
    }
  }

}
