/**
 * Quick test to verify Solana RPC connectivity
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com';
const USDC_MINT = 'DKwMf2LRT5ntXHrAK3nXCfzN7C5Qttrff2TEQJ5GN3Hy';
const RECEIVER_ADDRESS = '3oELRpUgR5ZraRTrW3ypkFbZ6xnqxWjBEw98LtaDoRrk';

async function testRPC() {
  console.log('Testing Solana RPC connection...\n');

  const connection = new Connection(SOLANA_DEVNET_RPC, 'finalized');

  try {
    // Test 1: Get current slot
    console.log('Test 1: Getting current slot...');
    const slot = await connection.getSlot();
    console.log(`✅ Current slot: ${slot}\n`);

    // Test 2: Check receiver SOL balance
    console.log('Test 2: Checking receiver SOL balance...');
    const receiverPubkey = new PublicKey(RECEIVER_ADDRESS);
    const solBalance = await connection.getBalance(receiverPubkey);
    console.log(`✅ Receiver SOL balance: ${solBalance / 1e9} SOL\n`);

    // Test 3: Get receiver ATA address
    console.log('Test 3: Getting receiver ATA address...');
    const usdcMint = new PublicKey(USDC_MINT);
    const receiverATA = await getAssociatedTokenAddress(usdcMint, receiverPubkey);
    console.log(`✅ Receiver ATA: ${receiverATA.toBase58()}\n`);

    // Test 4: Check if ATA exists
    console.log('Test 4: Checking if ATA exists...');
    const ataInfo = await connection.getAccountInfo(receiverATA);
    if (ataInfo) {
      console.log(`✅ ATA exists! Data length: ${ataInfo.data.length}\n`);

      // Test 5: Get token balance
      console.log('Test 5: Getting token balance...');
      const tokenBalance = await connection.getTokenAccountBalance(receiverATA);
      console.log(`✅ USDC Balance: ${tokenBalance.value.uiAmount} USDC\n`);
    } else {
      console.log(`⚠️  ATA does not exist yet\n`);
    }

    console.log('🎉 All RPC tests passed!');

  } catch (error: any) {
    console.error('❌ RPC test failed:', error.message);
    console.error('Error details:', error);
  }
}

testRPC();
