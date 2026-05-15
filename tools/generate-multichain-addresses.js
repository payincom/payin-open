export class MultiChainAddressGenerator {
  constructor(mnemonic) {
    this.mnemonic = mnemonic;
  }

  getMasterPublicKey() {
    return 'xpub-test-stub';
  }

  getAddress(chain, index) {
    const chainTag = chain.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const base = `${chainTag}${index}`.padEnd(40, 'a').slice(0, 40);
    return {
      address: `0x${base}`,
    };
  }
}
