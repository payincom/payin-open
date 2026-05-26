import { ethers } from 'ethers';
import { TronWeb } from 'tronweb';

export class MultiChainAddressGenerator {
  constructor(mnemonic) {
    this.mnemonic = mnemonic;
  }

  getMasterPublicKey() {
    return 'xpub-test-stub';
  }

  getAddress(chain, index) {
    if (!this.mnemonic) {
      throw new Error('Mnemonic is required to generate test addresses');
    }

    const wallet = ethers.HDNodeWallet.fromPhrase(
      this.mnemonic,
      undefined,
      `m/44'/60'/0'/0/${index}`
    );

    if (chain.startsWith('tron-')) {
      const privateKey = wallet.privateKey.slice(2);
      return {
        address: TronWeb.address.fromPrivateKey(privateKey),
      };
    }

    return {
      address: wallet.address,
    };
  }
}
