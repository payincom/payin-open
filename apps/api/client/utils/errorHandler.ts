/**
 * Error Handler Utility
 * Converts technical blockchain errors into user-friendly messages
 */

/**
 * Parse blockchain error and return user-friendly message
 */
export function parseBlockchainError(error: Error): string {
  const errorMessage = error.message || String(error);

  // User rejected transaction
  if (
    errorMessage.includes('User denied') ||
    errorMessage.includes('User rejected') ||
    errorMessage.includes('user rejected') ||
    errorMessage.includes('rejected the request')
  ) {
    return 'Transaction was cancelled. Please try again when you\'re ready.';
  }

  // Insufficient funds
  if (
    errorMessage.includes('insufficient funds') ||
    errorMessage.includes('Insufficient funds') ||
    errorMessage.includes('exceeds balance')
  ) {
    return 'Insufficient funds in your wallet to complete this transaction.';
  }

  // Gas estimation failed
  if (
    errorMessage.includes('gas required exceeds') ||
    errorMessage.includes('cannot estimate gas') ||
    errorMessage.includes('gas estimation failed')
  ) {
    return 'Unable to estimate gas fees. Please check your wallet balance and try again.';
  }

  // Network issues
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('Network') ||
    errorMessage.includes('connection')
  ) {
    return 'Network connection issue. Please check your internet and try again.';
  }

  // Wrong network
  if (
    errorMessage.includes('chain') ||
    errorMessage.includes('Chain') ||
    errorMessage.includes('network mismatch')
  ) {
    return 'Please switch to the correct network in your wallet.';
  }

  // Token approval issues
  if (
    errorMessage.includes('allowance') ||
    errorMessage.includes('approve') ||
    errorMessage.includes('Approve')
  ) {
    return 'Token approval failed. Please try again.';
  }

  // Contract execution failed
  if (
    errorMessage.includes('execution reverted') ||
    errorMessage.includes('revert') ||
    errorMessage.includes('transaction failed')
  ) {
    return 'Transaction failed. This could be due to slippage or contract conditions. Please try again.';
  }

  // Timeout
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'Transaction timed out. Please check your wallet and try again.';
  }

  // Wallet connection issues
  if (
    errorMessage.includes('wallet') ||
    errorMessage.includes('Wallet') ||
    errorMessage.includes('provider')
  ) {
    return 'Wallet connection issue. Please reconnect your wallet and try again.';
  }

  // Generic fallback
  console.error('[ErrorHandler] Unhandled error:', error);
  return 'Transaction failed. Please try again or contact support if the issue persists.';
}

/**
 * Get error severity level for UI styling
 */
export function getErrorSeverity(error: Error): 'warning' | 'error' {
  const errorMessage = error.message || String(error);

  // User actions are warnings (not critical errors)
  if (
    errorMessage.includes('User denied') ||
    errorMessage.includes('User rejected') ||
    errorMessage.includes('user rejected') ||
    errorMessage.includes('rejected the request') ||
    errorMessage.includes('cancelled')
  ) {
    return 'warning';
  }

  // Everything else is an error
  return 'error';
}
