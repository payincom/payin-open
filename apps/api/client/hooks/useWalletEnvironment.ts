/**
 * Wallet Environment Detection Hook
 * Detects wallet availability and platform type
 */

import { useState, useEffect } from 'react';

export interface WalletEnvironment {
  hasInjectedWallet: boolean;
  isMobile: boolean;
  isInWalletBrowser: boolean;
  platform: 'desktop' | 'mobile';
  connectionMode: 'injected' | 'walletconnect' | 'dapp-browser' | 'manual';
}

/**
 * Hook to detect wallet environment and suggest connection mode
 */
export function useWalletEnvironment(): WalletEnvironment {
  const [env, setEnv] = useState<WalletEnvironment>({
    hasInjectedWallet: false,
    isMobile: false,
    isInWalletBrowser: false,
    platform: 'desktop',
    connectionMode: 'manual',
  });

  useEffect(() => {
    // Detect mobile platform
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Detect injected wallet (browser extension or wallet browser)
    const hasInjectedWallet = typeof window !== 'undefined' && !!window.ethereum;

    // If mobile + has injected wallet = in wallet's DApp browser
    const isInWalletBrowser = hasInjectedWallet && isMobile;

    // Determine connection mode
    let connectionMode: 'injected' | 'walletconnect' | 'dapp-browser' | 'manual';

    if (isInWalletBrowser) {
      // Mobile wallet browser - use injected provider
      connectionMode = 'dapp-browser';
    } else if (hasInjectedWallet && !isMobile) {
      // Desktop browser extension - use injected provider
      connectionMode = 'injected';
    } else if (isMobile) {
      // Mobile without wallet browser - use WalletConnect deep links
      connectionMode = 'walletconnect';
    } else {
      // Desktop without extension - show manual transfer
      connectionMode = 'manual';
    }

    setEnv({
      hasInjectedWallet,
      isMobile,
      isInWalletBrowser,
      platform: isMobile ? 'mobile' : 'desktop',
      connectionMode,
    });
  }, []);

  return env;
}
