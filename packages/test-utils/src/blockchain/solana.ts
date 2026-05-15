/**
 * Solana blockchain test utilities
 *
 * Provides utilities for sending SPL token transfers on Solana test networks
 */
import { Connection, Keypair, Transaction, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token'

export interface SolanaTransferParams {
  fromSecretKey: string  // Hex format
  toAddress: string
  amount: string
  mintAddress: string
  rpcUrl: string
  decimals?: number  // Default: 6 (for USDC/USDT)
}

export class SolanaTestUtils {
  /**
   * Send SPL token transfer
   *
   * Automatically creates Associated Token Account (ATA) for receiver if it doesn't exist
   *
   * @param params - Transfer parameters
   * @returns Transaction signature
   */
  static async sendToken(params: SolanaTransferParams): Promise<string> {
    const { fromSecretKey, toAddress, amount, mintAddress, rpcUrl, decimals = 6 } = params

    const connection = new Connection(rpcUrl, 'finalized')
    const fromKeypair = Keypair.fromSecretKey(Buffer.from(fromSecretKey, 'hex'))

    // Convert amount to smallest units (default 6 decimals for USDC)
    const amountInSmallestUnits = Math.floor(parseFloat(amount) * Math.pow(10, decimals))

    const usdcMint = new PublicKey(mintAddress)
    const receiverPubkey = new PublicKey(toAddress)

    // Get sender and receiver ATAs
    const senderATA = await getAssociatedTokenAddress(
      usdcMint,
      fromKeypair.publicKey
    )

    const receiverATA = await getAssociatedTokenAddress(
      usdcMint,
      receiverPubkey
    )

    // Build transaction
    const transaction = new Transaction()

    // Check if receiver ATA exists, create if not
    const receiverATAInfo = await connection.getAccountInfo(receiverATA)
    if (!receiverATAInfo) {
      console.log(`   Creating ATA for receiver: ${receiverATA.toBase58()}`)
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromKeypair.publicKey, // payer
          receiverATA,           // associated token account
          receiverPubkey,        // owner
          usdcMint              // mint
        )
      )
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        senderATA,
        receiverATA,
        fromKeypair.publicKey,
        amountInSmallestUnits,
        [],
        TOKEN_PROGRAM_ID
      )
    )

    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [fromKeypair],
      { commitment: 'finalized' }
    )

    console.log(`✅ Solana transfer completed: ${signature}`)
    return signature
  }

  /**
   * Get SPL token balance for an address
   *
   * @param address - Public key of the token account owner
   * @param mintAddress - Token mint address
   * @param rpcUrl - Solana RPC endpoint
   * @returns Token balance as a number
   */
  static async getTokenBalance(
    address: string,
    mintAddress: string,
    rpcUrl: string
  ): Promise<number> {
    const connection = new Connection(rpcUrl, 'finalized')
    const pubkey = new PublicKey(address)
    const mint = new PublicKey(mintAddress)

    const ata = await getAssociatedTokenAddress(mint, pubkey)
    const balance = await connection.getTokenAccountBalance(ata)

    return balance.value.uiAmount || 0
  }
}
