/**
 * Unified wallet generation for all supported chains
 */
import { Keypair } from '@solana/web3.js'
import { ethers } from 'ethers'
import * as fs from 'fs'
import * as path from 'path'

export interface TestWallet {
  chain: 'evm' | 'solana' | 'tron'
  address: string
  privateKey?: string
  secretKey?: string
  mnemonic?: string
}

export class WalletGenerator {
  /**
   * Generate EVM wallet (Ethereum, Polygon, etc.)
   */
  static generateEVM(): TestWallet {
    const wallet = ethers.Wallet.createRandom()
    return {
      chain: 'evm',
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase
    }
  }

  /**
   * Generate Solana wallet
   */
  static generateSolana(): TestWallet {
    const keypair = Keypair.generate()
    return {
      chain: 'solana',
      address: keypair.publicKey.toBase58(),
      secretKey: Buffer.from(keypair.secretKey).toString('hex')
    }
  }

  /**
   * Generate Tron wallet
   */
  static generateTron(): TestWallet {
    // Dynamic require to avoid bundling TronWeb if not needed
    const TronWeb = require('tronweb')
    const account = TronWeb.utils.accounts.generateAccount()
    return {
      chain: 'tron',
      address: account.address.base58,
      privateKey: account.privateKey
    }
  }

  /**
   * Save wallet to file
   */
  static save(wallet: TestWallet, name: string, dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const filename = path.join(dir, `${name}.json`)
    fs.writeFileSync(filename, JSON.stringify(wallet, null, 2))
  }

  /**
   * Load wallet from file
   */
  static load(name: string, dir: string): TestWallet {
    const filename = path.join(dir, `${name}.json`)
    if (!fs.existsSync(filename)) {
      throw new Error(
        `Test wallet not found: ${filename}\n` +
        `Please generate test wallets first or check the wallet directory.`
      )
    }
    return JSON.parse(fs.readFileSync(filename, 'utf-8'))
  }
}
