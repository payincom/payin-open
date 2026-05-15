export class MultiChainPaymentSender {
  async sendPayment() {
    return {
      transactionHash: `0x${Date.now().toString(16).padStart(64, '0')}`,
      status: 'sent',
    };
  }
}
