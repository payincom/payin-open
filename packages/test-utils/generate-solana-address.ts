/**
 * Generate Solana addresses from the test mnemonic
 */
import { ethers } from 'ethers'
import { Keypair } from '@solana/web3.js'
import { derivePath } from 'ed25519-hd-key'

const DEFAULT_TEST_MNEMONIC = 'prepare panel behind window cram series basket exhibit topple icon solve gate'

function generateSolanaAddress(mnemonic: string, index: number) {
  // Solana uses ed25519 derivation
  const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic)
  const seed = mnemonicObj.computeSeed()
  const path = `m/44'/501'/${index}'/0'`

  // Convert Uint8Array to hex string
  const seedHex = Buffer.from(seed).toString('hex')
  const derivedSeed = derivePath(path, seedHex).key
  const keypair = Keypair.fromSeed(Uint8Array.from(derivedSeed))

  return {
    address: keypair.publicKey.toBase58(),
    secretKey: Buffer.from(keypair.secretKey).toString('hex'),
    index,
  }
}

// Generate addresses
console.log('📍 从统一助记词生成的 Solana 测试地址:\n')
console.log(`助记词: "${DEFAULT_TEST_MNEMONIC}"\n`)

const sender = generateSolanaAddress(DEFAULT_TEST_MNEMONIC, 0)
console.log('Sender (index 0):')
console.log('  Address:', sender.address)
console.log('')

const receiver = generateSolanaAddress(DEFAULT_TEST_MNEMONIC, 1)
console.log('Receiver (index 1):')
console.log('  Address:', receiver.address)
console.log('')

console.log('💡 请给 Sender 地址转账:')
console.log('  - SOL: 用于支付交易费（至少 0.01 SOL）')
console.log('  - USDC: 用于测试支付/充值（建议 5 USDC）')
console.log('')
console.log('📝 Solana Devnet Faucet:')
console.log('  - SOL: https://faucet.solana.com/')
console.log('  - USDC: 需要从其他钱包转账')
