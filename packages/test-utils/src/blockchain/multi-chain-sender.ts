/**
 * Multi-chain payment sender for testing
 *
 * Unified interface for sending test payments across EVM, Tron, and Solana
 */
import { ethers } from 'ethers'
import { TronWeb } from 'tronweb'
import { SolanaTestUtils } from './solana.js'
import { WalletLoader } from '../wallets/loader.js'

// ERC20 token ABI (transfer and balanceOf functions)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
]

// TRC20 token ABI
const TRC20_ABI = [
  {
    "outputs": [{"type": "bool"}],
    "constant": false,
    "inputs": [{"name": "_to", "type": "address"}, {"name": "_value", "type": "uint256"}],
    "name": "transfer",
    "stateMutability": "Nonpayable",
    "type": "Function"
  },
  {
    "outputs": [{"type": "uint256"}],
    "constant": true,
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "stateMutability": "View",
    "type": "Function"
  },
  {
    "outputs": [{"type": "uint8"}],
    "constant": true,
    "name": "decimals",
    "stateMutability": "View",
    "type": "Function"
  }
]

// Chain configurations
const CHAIN_CONFIGS = {
  'ethereum-sepolia': {
    rpcUrl: '${SEPOLIA_RPC_URL:-https://sepolia.infura.io/v3/your_infura_key}',
    tokenContracts: {
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0'
    }
  },
  'polygon-amoy': {
    rpcUrl: '${POLYGON_AMOY_RPC_URL:-https://polygon-amoy.infura.io/v3/your_infura_key}',
    tokenContracts: {
      USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
      USDT: '0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97'
    }
  },
  'tron-nile': {
    rpcUrl: 'https://nile.trongrid.io',
    tokenContracts: {
      USDT: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'
    }
  },
  'solana-devnet': {
    rpcUrl: 'https://api.devnet.solana.com',
    tokenContracts: {
      USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' // Official Devnet USDC
    }
  }
} as const

/**
 * Multi-chain payment sender
 *
 * Sends test payments across EVM, Tron, and Solana networks
 */
export class MultiChainPaymentSender {
  private mnemonic: string

  constructor(mnemonic?: string) {
    // Use provided mnemonic or get from environment variable
    this.mnemonic = mnemonic || process.env.MNEMONIC || ''

    if (!this.mnemonic) {
      throw new Error('Mnemonic is required. Provide it as constructor parameter or set MNEMONIC environment variable.')
    }
  }

  /**
   * Send payment to any chain
   *
   * @param chainId - Chain identifier (e.g., 'ethereum-sepolia', 'tron-nile', 'solana-devnet')
   * @param toAddress - Recipient address
   * @param amount - Amount to send (in token units, e.g., '1.5' for 1.5 USDC)
   * @param token - Token symbol (default: 'USDC')
   * @returns Transaction hash/signature
   */
  async sendPayment(
    chainId: string,
    toAddress: string,
    amount: string,
    token: string = 'USDC'
  ): Promise<string> {
    // Determine chain protocol
    if (chainId.startsWith('ethereum-') || chainId.startsWith('polygon-')) {
      return this.sendEVMPayment(chainId, toAddress, amount, token)
    } else if (chainId.startsWith('tron-')) {
      return this.sendTronPayment(chainId, toAddress, amount, token)
    } else if (chainId.startsWith('solana-')) {
      return this.sendSolanaPayment(chainId, toAddress, amount, token)
    } else {
      throw new Error(`Unsupported chain: ${chainId}`)
    }
  }

  /**
   * Send EVM payment (Ethereum, Polygon, etc.)
   */
  private async sendEVMPayment(
    chainId: string,
    toAddress: string,
    amount: string,
    token: string
  ): Promise<string> {
    const config = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS]
    if (!config) {
      throw new Error(`Chain configuration not found: ${chainId}`)
    }

    const tokenAddress = config.tokenContracts[token as keyof typeof config.tokenContracts]
    if (!tokenAddress) {
      throw new Error(`Token ${token} not supported on ${chainId}`)
    }

    // Create wallet from mnemonic
    const provider = new ethers.JsonRpcProvider(config.rpcUrl)
    const wallet = ethers.Wallet.fromPhrase(this.mnemonic).connect(provider)

    // Get token contract
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet)

    // Get decimals and prepare amount
    const decimals = await tokenContract.decimals()
    const amountInSmallestUnits = ethers.parseUnits(amount, decimals)

    // Send transaction
    const tx = await tokenContract.transfer(toAddress, amountInSmallestUnits)
    console.log(`✅ EVM payment sent on ${chainId}: ${tx.hash}`)

    // Wait for confirmation
    await tx.wait()
    console.log(`✅ EVM payment confirmed on ${chainId}`)

    return tx.hash
  }

  /**
   * Send Tron payment
   */
  private async sendTronPayment(
    chainId: string,
    toAddress: string,
    amount: string,
    token: string
  ): Promise<string> {
    const config = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS]
    if (!config) {
      throw new Error(`Chain configuration not found: ${chainId}`)
    }

    const tokenAddress = config.tokenContracts[token as keyof typeof config.tokenContracts]
    if (!tokenAddress) {
      throw new Error(`Token ${token} not supported on ${chainId}`)
    }

    // Derive Tron private key from mnemonic
    // Tron uses the same derivation path as Ethereum (m/44'/60'/0'/0/0)
    const evmWallet = ethers.Wallet.fromPhrase(this.mnemonic)
    const privateKey = evmWallet.privateKey.slice(2) // Remove '0x' prefix

    // Create TronWeb instance
    const tronWeb = new TronWeb({
      fullHost: config.rpcUrl,
      privateKey
    })

    // Get contract
    const contract = await tronWeb.contract(TRC20_ABI, tokenAddress)

    // Get decimals and prepare amount
    const decimals = await contract.decimals().call()
    const amountInSmallestUnits = parseFloat(amount) * Math.pow(10, parseInt(decimals.toString()))

    // Send transaction
    const result = await contract.transfer(toAddress, amountInSmallestUnits.toString()).send()
    console.log(`✅ Tron payment sent on ${chainId}: ${result}`)

    return result
  }

  /**
   * Send Solana payment
   */
  private async sendSolanaPayment(
    chainId: string,
    toAddress: string,
    amount: string,
    token: string
  ): Promise<string> {
    const config = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS]
    if (!config) {
      throw new Error(`Chain configuration not found: ${chainId}`)
    }

    const mintAddress = config.tokenContracts[token as keyof typeof config.tokenContracts]
    if (!mintAddress) {
      throw new Error(`Token ${token} not supported on ${chainId}`)
    }

    // Load Solana sender wallet
    const senderWallet = WalletLoader.loadSolana('sender')

    // Use SolanaTestUtils to send token
    const signature = await SolanaTestUtils.sendToken({
      fromSecretKey: senderWallet.secretKey,
      toAddress,
      amount,
      mintAddress,
      rpcUrl: config.rpcUrl,
      decimals: 6 // USDC uses 6 decimals
    })

    console.log(`✅ Solana payment sent on ${chainId}: ${signature}`)
    return signature
  }
}
