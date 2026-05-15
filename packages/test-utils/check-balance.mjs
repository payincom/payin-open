import { WalletLoader } from './dist/wallets/loader.js';
import { SolanaTestUtils } from './dist/blockchain/solana.js';

const senderWallet = WalletLoader.loadSolana('sender');
console.log('Sender address:', senderWallet.address);

const balance = await SolanaTestUtils.getTokenBalance({
  walletAddress: senderWallet.address,
  mintAddress: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  rpcUrl: 'https://api.devnet.solana.com',
  decimals: 6
});

console.log('USDC balance:', balance, 'USDC');
