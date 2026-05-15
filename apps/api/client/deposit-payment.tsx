/**
 * Deposit Payment Page (New shadcn UI version)
 * React entry point for deposit functionality with modern UI
 */

import './styles/globals.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { AdaptivePayment } from './components/AdaptivePayment';
import { createWagmiConfig } from './config/wagmi';
import type { ChainInfo } from './types';
import QRCode from 'qrcode';
import { ThemeProvider, useTheme } from './components/theme-provider';
import { ThemeToggle } from './components/theme-toggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Progress } from './components/ui/progress';
import { Alert, AlertDescription } from './components/ui/alert';
import { Button } from './components/ui/button';
import { Separator } from './components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import {
  Shield,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Coins,
  Network,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

// Import RainbowKit styles
import '@rainbow-me/rainbowkit/styles.css';

// Create React Query client
const queryClient = new QueryClient();

interface DepositAddresses {
  evm: { address: string; protocol: 'evm' } | null;
  tron: { address: string; protocol: 'tron' } | null;
}

interface DepositMetadata {
  title: string;
  description: string;
}

interface DepositPaymentAppProps {
  depositReference: string;
  depositAddresses: DepositAddresses;
  metadata: DepositMetadata;
}

interface TokenWithChains {
  symbol: string;
  name: string;
  decimals: number;
  chains: {
    chainId: string;
    contractAddress: string;
  }[];
}

interface TransferStatusData {
  txHash: string;
  found: boolean;
  transferId?: string;
  status?: string;
  amount?: string;
  tokenSymbol?: string;
  chain?: string;
  requiredConfirmations?: number;
  currentConfirmations?: number;
  isConfirmed?: boolean;
  confirmedAt?: string | null;
}

function DepositPaymentApp({ depositReference, depositAddresses, metadata }: DepositPaymentAppProps) {
  const [availableTokens, setAvailableTokens] = React.useState<TokenWithChains[]>([]);

  const getStateFromUrl = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return { token: null, chain: null, txHash: null };
    }
    const urlParams = new URLSearchParams(window.location.search);
    return {
      token: urlParams.get('token'),
      chain: urlParams.get('chain'),
      txHash: urlParams.get('txHash'),
    };
  }, []);

  const [userSelectedToken, setUserSelectedToken] = React.useState<string | null>(() => getStateFromUrl().token);
  const [userSelectedChainId, setUserSelectedChainId] = React.useState<string | null>(() => getStateFromUrl().chain);
  const [txHash, setTxHash] = React.useState<string | null>(() => getStateFromUrl().txHash);

  const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = React.useState(false);
  const [copiedTxHash, setCopiedTxHash] = React.useState(false);

  // Transfer confirmation tracking (only for wallet payments)
  const [transferStatus, setTransferStatus] = React.useState<TransferStatusData | null>(null);
  const [isPolling, setIsPolling] = React.useState<boolean>(() => !!getStateFromUrl().txHash);

  // Track payment mode (wallet vs QR)
  const [isWalletMode, setIsWalletMode] = React.useState<boolean>(false);

  // Get chain info by ID
  const [allChains, setAllChains] = React.useState<ChainInfo[]>([]);

  // Derive selected token
  const selectedToken =
    userSelectedToken ?? (!loading && availableTokens.length === 1 ? availableTokens[0].symbol : null);

  // Get supported chains for selected token
  const supportedChainsInfo = React.useMemo(() => {
    if (!selectedToken) return [];
    const token = availableTokens.find(t => t.symbol === selectedToken);
    if (!token) return [];
    const supportedChainIds = new Set(token.chains.map(c => c.chainId));
    return allChains.filter(chain => supportedChainIds.has(chain.chainId));
  }, [selectedToken, availableTokens, allChains]);

  // Derive selected chain - Don't auto-select even if only one chain
  const selectedChainId = userSelectedChainId;

  // Update URL when state changes
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    const currentToken = urlParams.get('token');
    const currentChain = urlParams.get('chain');
    const currentTxHash = urlParams.get('txHash');

    let changed = false;

    if (selectedToken) {
      if (currentToken !== selectedToken) {
        urlParams.set('token', selectedToken);
        changed = true;
      }
    } else if (currentToken) {
      urlParams.delete('token');
      changed = true;
    }

    if (selectedChainId) {
      if (currentChain !== selectedChainId) {
        urlParams.set('chain', selectedChainId);
        changed = true;
      }
    } else if (currentChain) {
      urlParams.delete('chain');
      changed = true;
    }

    if (txHash) {
      if (currentTxHash !== txHash) {
        urlParams.set('txHash', txHash);
        changed = true;
      }
    } else if (currentTxHash) {
      urlParams.delete('txHash');
      changed = true;
    }

    if (changed) {
      const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
      window.history.replaceState({ selectedToken, selectedChainId, txHash }, '', newUrl);
    }
  }, [selectedToken, selectedChainId, txHash]);

  // Handle browser back button
  React.useEffect(() => {
    const handlePopState = () => {
      const { token, chain, txHash: txHashFromUrl } = getStateFromUrl();
      setUserSelectedToken(token);
      setUserSelectedChainId(chain);
      setTxHash(txHashFromUrl);
      setIsPolling(!!txHashFromUrl);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getStateFromUrl]);

  // Fetch chains
  React.useEffect(() => {
    async function fetchChains() {
      try {
        const chains: ChainInfo[] = [];

        if (depositAddresses.evm) {
          const evmResponse = await fetch('/api/chains?protocol=evm');
          const evmData = await evmResponse.json();
          if (evmData.success) {
            chains.push(...evmData.chains);
          }
        }

        if (depositAddresses.tron) {
          const tronResponse = await fetch('/api/chains?protocol=tron');
          const tronData = await tronResponse.json();
          if (tronData.success) {
            chains.push(...tronData.chains);
          }
        }

        setAllChains(chains);
      } catch (err) {
        console.error('Failed to fetch chains:', err);
      }
    }

    fetchChains();
  }, [depositAddresses]);

  // Fetch available tokens
  React.useEffect(() => {
    async function fetchAvailableTokens() {
      setLoading(true);
      try {
        const response = await fetch(`/api/tokens/deposit/${depositReference}/available`);
        const data = await response.json();

        if (data.success) {
          setAvailableTokens(data.tokens);
        } else {
          setError(data.message || 'Failed to load available tokens');
        }
      } catch (err) {
        console.error('Failed to fetch available tokens:', err);
        setError('Failed to load available tokens');
      } finally {
        setLoading(false);
      }
    }

    fetchAvailableTokens();
  }, [depositReference]);

  // Get deposit address based on selected chain
  const depositAddress = React.useMemo(() => {
    if (!selectedChainId) return null;

    const selectedChain = allChains.find(c => c.chainId === selectedChainId);
    if (!selectedChain) return null;

    const protocol = selectedChain.protocol as 'evm' | 'tron';
    const addressInfo = depositAddresses[protocol];

    return addressInfo ? addressInfo.address : null;
  }, [selectedChainId, allChains, depositAddresses]);

  // Generate QR code
  React.useEffect(() => {
    if (!depositAddress) {
      setQrCodeDataUrl('');
      return;
    }

    QRCode.toDataURL(depositAddress, {
      width: 280,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => {
        setQrCodeDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
        setQrCodeDataUrl('');
      });
  }, [depositAddress]);

  // Create Wagmi config - use useMemo to avoid recreating on every render
  const wagmiConfig = React.useMemo(() => {
    return createWagmiConfig(allChains);
  }, [allChains]);

  const selectedChain = allChains.find(c => c.chainId === selectedChainId);

  // Poll transfer status
  const pollTransferStatus = React.useCallback(async () => {
    if (!txHash) return;

    try {
      const response = await fetch(`/api/transfer-status/${txHash}`);
      const data = await response.json();

      if (data.success && data.data) {
        setTransferStatus(data.data);

        if (data.data.isConfirmed) {
          setIsPolling(false);
        }
      } else {
        setTransferStatus({
          txHash,
          found: false,
        });
      }
    } catch (err) {
      console.error('Failed to poll transfer status:', err);
    }
  }, [txHash]);

  // Start polling when txHash is set
  React.useEffect(() => {
    if (!isPolling || !txHash) return;

    pollTransferStatus();
    const interval = setInterval(pollTransferStatus, 3000);

    return () => clearInterval(interval);
  }, [isPolling, txHash, pollTransferStatus]);

  // Handle successful wallet payment
  const handlePaymentSuccess = (hash: string) => {
    setTxHash(hash);
    setIsPolling(true);
    setError(null);
  };

  // Handle payment error
  const handlePaymentError = (err: Error) => {
    setError(err.message);
  };

  // Get token contract
  const tokenContract = React.useMemo(() => {
    if (!selectedChainId || !selectedToken) return null;

    const token = availableTokens.find(t => t.symbol === selectedToken);
    if (!token) return null;

    const chainContract = token.chains.find(c => c.chainId === selectedChainId);
    if (!chainContract) return null;

    return {
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      address: chainContract.contractAddress,
    };
  }, [selectedChainId, selectedToken, availableTokens]);

  // Copy address to clipboard
  const handleCopyAddress = React.useCallback(() => {
    if (!depositAddress) return;

    navigator.clipboard.writeText(depositAddress).then(() => {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    });
  }, [depositAddress]);

  const handleCopyTxHash = React.useCallback(() => {
    if (!txHash) return;

    navigator.clipboard.writeText(txHash).then(() => {
      setCopiedTxHash(true);
      setTimeout(() => setCopiedTxHash(false), 2000);
    });
  }, [txHash]);

  if (loading) {
    return (
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-foreground" />
              <p className="text-muted-foreground">Loading deposit information...</p>
            </CardContent>
          </Card>
        </div>
      </ThemeProvider>
    );
  }


  // Determine what navigation should be shown
  const showBackButton = (selectedToken && !selectedChainId && supportedChainsInfo.length > 0) ||
                         (selectedToken && selectedChainId);

  const handleBackClick = () => {
    if (selectedToken && selectedChainId) {
      // If we're on the payment page, go back to chain selection
      setUserSelectedChainId(null);
      setTxHash(null);
    } else if (selectedToken && !selectedChainId) {
      // If we're on chain selection, go back to token selection
      setUserSelectedToken(null);
      setTxHash(null);
    }
  };

  const content = (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex-shrink-0 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-2xl flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {showBackButton ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackClick}
                className="h-9 gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <>
                <Shield className="h-5 w-5 text-foreground" />
                <span className="font-brand font-semibold">PayIn</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedToken && !selectedChainId && (
              <div className="selected-token-badge">
                <span className="token-badge-text">{selectedToken}</span>
              </div>
            )}
            {selectedToken && selectedChainId && selectedChain && (
              <div className="text-right mr-2">
                <div className="text-sm font-medium">{selectedToken}</div>
                <div className="text-xs text-muted-foreground">{selectedChain.name}</div>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content - Centered and Scrollable */}
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center px-4 sm:px-6 py-6">
          <div className="w-full max-w-2xl">
            {/* Step 1: Token Selection (skipped if only one) */}
            {!selectedToken && availableTokens.length > 1 && (
              <Card>
                <CardHeader className="pb-6">
                  <CardTitle className="text-2xl mb-3">
                    <div>Deposit to</div>
                    <div className="text-lg text-muted-foreground font-normal mt-1">{depositReference}</div>
                  </CardTitle>
                  <CardDescription className="text-sm mt-4">Select token to deposit</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {availableTokens.map((token) => (
                      <Button
                        key={token.symbol}
                        variant="outline"
                        className="token-card h-auto p-4 flex-col items-center justify-center hover:border-foreground/30 hover:bg-accent hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                        onClick={() => setUserSelectedToken(token.symbol)}
                      >
                        <div className="flex flex-col items-center gap-2 w-full">
                          <div className="token-icon h-10 w-10 rounded-full flex items-center justify-center transition-all duration-200 overflow-hidden bg-white">
                            <img
                              src={`/assets/tokens/${token.symbol.toLowerCase()}.png`}
                              alt={token.symbol}
                              className="w-8 h-8 object-contain"
                              onError={(e) => {
                                // Fallback to text if image fails to load
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.classList.remove('bg-white');
                                  parent.innerHTML = `<span class="text-sm font-semibold text-foreground">${token.symbol.substring(0, 2)}</span>`;
                                }
                              }}
                            />
                          </div>
                          <div className="text-center w-full">
                            <div className="font-semibold text-sm truncate">{token.symbol}</div>
                            <div className="text-xs text-muted-foreground truncate">{token.name}</div>
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <style>{`
              .token-icon,
              .chain-icon {
                border: 2px solid hsl(var(--border));
              }
              .token-card:hover .token-icon,
              .chain-card:hover .chain-icon {
                border-color: hsl(var(--foreground) / 0.3);
                transform: scale(1.1);
              }
              .token-card,
              .chain-card {
                position: relative;
              }
              .token-card:hover,
              .chain-card:hover {
                box-shadow: 0 8px 24px hsl(var(--foreground) / 0.1);
                border-color: hsl(var(--foreground) / 0.3) !important;
              }
              .selected-token-badge {
                display: flex;
                align-items: center;
                padding: 6px 12px;
                background: hsl(var(--muted));
                border: 1px solid hsl(var(--border));
                border-radius: 20px;
                margin-right: 8px;
              }
              .token-badge-text {
                font-size: 14px;
                font-weight: 600;
                color: hsl(var(--foreground));
              }
            `}</style>

            {/* Step 2: Chain Selection (always show to let user confirm their choice) */}
            {selectedToken && !selectedChainId && supportedChainsInfo.length > 0 && (
              <Card>
                <CardHeader className="pb-6">
                  <CardTitle className="text-2xl mb-3">Select Blockchain</CardTitle>
                  <CardDescription className="text-sm mt-4">Select chain to send {selectedToken}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {supportedChainsInfo.map((chain) => (
                      <Button
                        key={chain.chainId}
                        variant="outline"
                        className="chain-card h-auto p-4 flex-col items-center justify-center hover:border-foreground/30 hover:bg-accent hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                        onClick={() => setUserSelectedChainId(chain.chainId)}
                      >
                        <div className="flex flex-col items-center gap-2 w-full">
                          <div className="chain-icon h-10 w-10 rounded-full flex items-center justify-center transition-all duration-200 overflow-hidden bg-white">
                            <img
                              src={
                                chain.chainId.includes('ethereum') || chain.chainId.includes('sepolia')
                                  ? '/assets/chains/ethereum.png'
                                  : chain.chainId.includes('polygon') || chain.chainId.includes('amoy')
                                  ? '/assets/chains/polygon.png'
                                  : '/assets/chains/ethereum.png'
                              }
                              alt={chain.name}
                              className="w-8 h-8 object-contain"
                              onError={(e) => {
                                // Fallback to text if image fails to load
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  parent.classList.remove('bg-white');
                                  parent.innerHTML = `<span class="text-sm font-semibold text-foreground">${chain.name.substring(0, 2).toUpperCase()}</span>`;
                                }
                              }}
                            />
                          </div>
                          <div className="text-center w-full">
                            <div className="font-semibold text-sm truncate">{chain.name}</div>
                            {chain.network === 'testnet' && (
                              <div className="text-xs font-bold text-orange-500">TEST</div>
                            )}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Payment */}
            {selectedToken && selectedChainId && selectedChain && depositAddress && (
              <div className="space-y-4">
                {/* Payment Component - Hidden after wallet payment */}
                {!txHash && (
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl mb-2 text-center">
                        {isWalletMode ? 'Transfer to deposit' : 'Scan to deposit'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <AdaptivePayment
                        targetAddress={depositAddress}
                        tokenSymbol={tokenContract?.symbol || selectedToken}
                        tokenDecimals={tokenContract?.decimals || 6}
                        chainId={selectedChain.chainId}
                        chainName={selectedChain.name}
                        protocol={selectedChain.protocol}
                        tokenContractAddress={tokenContract?.address}
                        qrCodeDataUrl={qrCodeDataUrl}
                        allowAmountEdit={true}
                        showFallback={true}
                        showDescription={false}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        onModeChange={setIsWalletMode}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* Transfer Confirmation Progress */}
                {txHash && transferStatus && (
                  <Card className="border-foreground/20">
                    <CardHeader className="space-y-1">
                      <div className="flex items-center gap-2">
                        {transferStatus.isConfirmed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                        )}
                        <CardTitle className="text-xl">
                          {transferStatus.isConfirmed
                            ? 'Deposit Confirmed'
                            : transferStatus.found
                              ? 'Confirming Deposit'
                              : 'Verifying Transaction'}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Transaction Hash */}
                      <div className="space-y-3">
                        <p className="text-base font-semibold">Transaction Hash</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <code className="flex-1 bg-muted px-4 py-3 rounded-lg text-sm font-mono break-all border-2 border-foreground/10">
                            {txHash}
                          </code>
                          <div className="flex gap-2 sm:flex-col">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCopyTxHash}
                              className="flex-1 sm:flex-none h-10"
                            >
                              {copiedTxHash ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="flex-1 sm:flex-none h-10"
                              disabled={!selectedChain.metadata?.explorer_url}
                            >
                              <a
                                href={selectedChain.metadata?.explorer_url ? `${selectedChain.metadata.explorer_url}/tx/${txHash}` : '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  if (!selectedChain.metadata?.explorer_url) {
                                    e.preventDefault();
                                  }
                                }}
                              >
                                <ExternalLink className="h-5 w-5" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Confirmation Progress */}
                      {transferStatus.found && transferStatus.requiredConfirmations && (
                        <>
                          <div className="text-center py-4">
                            <div className="text-4xl sm:text-5xl font-bold mb-2">
                              {transferStatus.currentConfirmations || 0} / {transferStatus.requiredConfirmations}
                            </div>
                            <p className="text-sm text-muted-foreground">Block Confirmations</p>
                          </div>

                          <Progress
                            value={Math.min(
                              ((transferStatus.currentConfirmations || 0) / transferStatus.requiredConfirmations) * 100,
                              100
                            )}
                            className="h-2"
                          />

                          {transferStatus.isConfirmed && (
                            <Alert className="bg-green-500/10 border-green-500/50">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <AlertDescription className="text-green-600 dark:text-green-400">
                                <div>Your deposit has been confirmed and processed</div>
                                {(transferStatus as any).redirectUrl && (
                                  <div className="mt-1">
                                    <a
                                      href={(transferStatus as any).redirectUrl}
                                      className="font-semibold underline hover:no-underline"
                                    >
                                      Return to Application
                                    </a>
                                  </div>
                                )}
                              </AlertDescription>
                            </Alert>
                          )}

                          {transferStatus.amount && (
                            <>
                              <Separator />
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Amount</span>
                                <span className="font-semibold">
                                  {transferStatus.amount} {transferStatus.tokenSymbol}
                                </span>
                              </div>
                            </>
                          )}
                        </>
                      )}

                      {!transferStatus.found && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Transaction submitted. Waiting for blockchain detection
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 border-t">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-3 text-center text-xs text-muted-foreground">
          Powered by <span className="font-brand font-medium text-foreground">PayIn</span>
        </div>
      </footer>

      {/* Error Dialog */}
      <Dialog open={!!error} onOpenChange={(open) => !open && setError(null)}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            {/* Error Icon */}
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>

            {/* Title */}
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-semibold">Error</DialogTitle>
              <DialogDescription className="text-base text-muted-foreground px-2">
                {error}
              </DialogDescription>
            </DialogHeader>

            {/* Action Button */}
            <div className="w-full pt-2">
              <Button
                type="button"
                onClick={() => setError(null)}
                className="w-full"
                size="lg"
              >
                Try Again
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Check if we have any EVM addresses - determines if RainbowKit is needed
  // This check is stable and doesn't change during the session
  const hasEVMSupport = depositAddresses.evm !== null;

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {hasEVMSupport ? (
        <RainbowKitWrapper wagmiConfig={wagmiConfig}>
          {content}
        </RainbowKitWrapper>
      ) : (
        content
      )}
    </ThemeProvider>
  );
}

/**
 * RainbowKit wrapper component that applies theme based on current theme
 */
function RainbowKitWrapper({ wagmiConfig, children }: { wagmiConfig: any; children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={{
            lightMode: lightTheme({
              accentColor: '#3b82f6',
              accentColorForeground: 'white',
              borderRadius: 'medium',
            }),
            darkMode: darkTheme({
              accentColor: '#3b82f6',
              accentColorForeground: 'white',
              borderRadius: 'medium',
            }),
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// Initialize app when DOM is ready
if (typeof window !== 'undefined') {
  const rootElement = document.getElementById('deposit-payment-root');
  if (rootElement) {
    const depositReference = (window as any).__DEPOSIT_REFERENCE__;
    const depositAddresses = (window as any).__DEPOSIT_ADDRESSES__ || { evm: null, tron: null };
    const metadata = (window as any).__DEPOSIT_METADATA__ || { title: 'Account Deposit', description: '' };

    if (depositReference) {
      const root = ReactDOM.createRoot(rootElement);
      root.render(
        <React.StrictMode>
          <DepositPaymentApp
            depositReference={depositReference}
            depositAddresses={depositAddresses}
            metadata={metadata}
          />
        </React.StrictMode>
      );
    }
  }
}
