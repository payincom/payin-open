/**
 * New Order Payment Page (with shadcn UI)
 * Professional, clear, and trustworthy design
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  AlertCircle,
  Wallet,
  QrCode as QrCodeIcon,
  ArrowRight,
  ArrowLeft,
  Shield
} from 'lucide-react';

import { ThemeProvider } from './components/theme-provider';
import { AdaptivePayment } from './components/AdaptivePayment';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Progress } from './components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Button } from './components/ui/button';
import { Separator } from './components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { createWagmiConfig } from './config/wagmi';
import { getTokenContract } from './config/tokens';
import type { OrderInfo, ChainInfo } from './types';

// Import shared layout components
import { PaymentContent, OrderSummary, type OrderSummaryData } from '@payin/shared/checkout';

// Import styles
import './styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';

// Create React Query client
const queryClient = new QueryClient();

interface OrderPaymentAppProps {
  order: OrderInfo;
  chain: ChainInfo;
  qrCodeDataUrl?: string;
  supportedChains: ChainInfo[];
}

interface OrderStatusData {
  status: string;
  requiredConfirmations: number;
  currentConfirmations: number;
  transactionHash: string | null;
  transferStatus: string | null;
  completedAt: string | null;
  requiredAmount: string;
  receivedAmount: string;
  remainingAmount: string;
  paymentProgress: number;
  isPartiallyPaid: boolean;
  isFullyPaid: boolean;
  transferCount: number;
}

function OrderPaymentApp({ order, chain, qrCodeDataUrl, supportedChains }: OrderPaymentAppProps) {
  const [currentStep, setCurrentStep] = React.useState<1 | 2>(1);
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [orderStatus, setOrderStatus] = React.useState<OrderStatusData | null>(null);
  const [isPolling, setIsPolling] = React.useState(false);
  const [isWalletPayment, setIsWalletPayment] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [allChains, setAllChains] = React.useState<ChainInfo[]>(supportedChains);

  const isInitialLoad = React.useRef(true);

  // Restore state from URL on initial load
  React.useEffect(() => {
    if (!isInitialLoad.current) return;
    isInitialLoad.current = false;

    const urlParams = new URLSearchParams(window.location.search);
    const stepFromUrl = urlParams.get('step');
    const txHashFromUrl = urlParams.get('txHash');
    const isWalletPaymentFromUrl = urlParams.get('isWalletPayment') === 'true';

    // If there's a txHash, go to step 2
    if (txHashFromUrl) {
      setCurrentStep(2);
      setTxHash(txHashFromUrl);
      setIsWalletPayment(isWalletPaymentFromUrl);
      setIsPolling(true);
    } else if (stepFromUrl === '2') {
      setCurrentStep(2);
    }
  }, []);

  // Fetch all available chains for proper wagmi configuration
  React.useEffect(() => {
    // Skip fetching if order is already completed
    if (order.status === 'completed' || (orderStatus && orderStatus.status === 'completed')) {
      return;
    }

    async function fetchChains() {
      try {
        const chains: ChainInfo[] = [];

        // Fetch chains based on order's protocol
        if (chain.protocol === 'evm') {
          const evmResponse = await fetch('/api/chains?protocol=evm');
          const evmData = await evmResponse.json();
          if (evmData.success) {
            chains.push(...evmData.chains);
          }
        } else if (chain.protocol === 'tron') {
          const tronResponse = await fetch('/api/chains?protocol=tron');
          const tronData = await tronResponse.json();
          if (tronData.success) {
            chains.push(...tronData.chains);
          }
        }

        if (chains.length > 0) {
          setAllChains(chains);
        }
      } catch (err) {
        console.error('Failed to fetch chains:', err);
        // Keep using supportedChains from server as fallback
      }
    }

    fetchChains();
  }, [chain.protocol, order.status, orderStatus]);

  // Update URL when state changes
  React.useEffect(() => {
    if (isInitialLoad.current) return;

    // Skip URL updates if order is completed
    if (order.status === 'completed' || (orderStatus && orderStatus.status === 'completed')) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);

    // Update step in URL
    if (currentStep === 2) {
      urlParams.set('step', '2');
    } else {
      urlParams.delete('step');
    }

    if (txHash) {
      urlParams.set('txHash', txHash);
      urlParams.set('isWalletPayment', String(isWalletPayment));
    } else {
      urlParams.delete('txHash');
      urlParams.delete('isWalletPayment');
    }

    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({ currentStep, txHash, isWalletPayment }, '', newUrl);
  }, [currentStep, txHash, isWalletPayment, order.status, orderStatus]);

  // Poll order status
  const pollOrderStatus = React.useCallback(async () => {
    // Stop polling if order is already completed
    if (order.status === 'completed' || (orderStatus && orderStatus.status === 'completed')) {
      setIsPolling(false);
      return;
    }

    try {
      const response = await fetch(`/api/order-status/${order.id}`);
      const data = await response.json();

      if (data.success && data.data) {
        setOrderStatus((prevStatus) => {
          if (!prevStatus ||
              prevStatus.status !== data.data.status ||
              prevStatus.currentConfirmations !== data.data.currentConfirmations ||
              prevStatus.receivedAmount !== data.data.receivedAmount ||
              prevStatus.transferCount !== data.data.transferCount) {
            return data.data;
          }
          return prevStatus;
        });

        if (data.data.status === 'completed') {
          setIsPolling(false);
        }
      }
    } catch (err) {
      console.error('Failed to poll order status:', err);
    }
  }, [order.id, order.status, orderStatus]);

  // Start polling
  React.useEffect(() => {
    if (!isPolling) return;

    // Don't start polling if order is already completed
    if (order.status === 'completed' || (orderStatus && orderStatus.status === 'completed')) {
      setIsPolling(false);
      return;
    }

    pollOrderStatus();
    const interval = setInterval(pollOrderStatus, 3000);

    return () => clearInterval(interval);
  }, [isPolling, pollOrderStatus, order.status, orderStatus]);

  // Auto-start polling
  React.useEffect(() => {
    // Don't start polling if order is already completed
    if (order.status === 'completed') {
      return;
    }
    setIsPolling(true);
  }, [order.status]);

  const handleSuccess = (hash: string) => {
    setTxHash(hash);
    setError(null);
    setIsWalletPayment(true);
    setIsPolling(true);
  };

  const handleError = (err: Error) => {
    setError(err.message);
  };

  const handleCopyAddress = async () => {
    const address = order.payment_address || order.paymentAddress || '';
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get payment details
  const paymentAddress = order.payment_address || order.paymentAddress || '';
  const amount = order.amount;
  const tokenSymbol = order.token_symbol || order.currency || 'USDT';

  // Get token contract for the chain
  const tokenContract = React.useMemo(() => {
    return getTokenContract(chain.chainId, tokenSymbol);
  }, [chain.chainId, tokenSymbol]);

  // Create Wagmi config with all available chains
  const wagmiConfig = React.useMemo(() => {
    return createWagmiConfig(allChains);
  }, [allChains]);

  const shouldHidePaymentComponent = isWalletPayment && orderStatus && orderStatus.status !== 'completed';

  // Order completed state
  if (order.status === 'completed' || (orderStatus && orderStatus.status === 'completed')) {
    const redirectUrl = (order as any).redirect_url || (orderStatus as any)?.redirect_url;

    const orderSummaryData: OrderSummaryData = {
      title: order.metadata?.title || 'Order Payment',
      description: order.metadata?.description,
      amount: amount,
      currency: tokenSymbol,
      networksDescription: chain.name,
      shareUrl: null,
      isPreview: false,
    };

    const completedRightColumn = (
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <CardTitle className="text-2xl mb-2">Payment Completed!</CardTitle>
          <CardDescription>
            Your payment has been successfully confirmed on the blockchain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderStatus?.completedAt && (
            <>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Completed at {new Date(orderStatus.completedAt).toLocaleString()}
                </p>
              </div>
              <Separator />
            </>
          )}

          {redirectUrl && (
            <div className="pt-2">
              <a
                href={redirectUrl}
                className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                Return to Merchant
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Order Reference: <span className="font-mono">{order.order_reference || order.id}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    );

    return (
      <PaymentContent
        leftColumn={<OrderSummary data={orderSummaryData} />}
        rightColumn={completedRightColumn}
      />
    );
  }

  // Order expired state
  if (order.status === 'expired') {
    const redirectUrl = (order as any).redirect_url;

    const orderSummaryData: OrderSummaryData = {
      title: order.metadata?.title || 'Order Payment',
      description: order.metadata?.description,
      amount: amount,
      currency: tokenSymbol,
      networksDescription: chain.name,
      shareUrl: null,
      isPreview: false,
    };

    const expiredRightColumn = (
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl mb-2">Payment Expired</CardTitle>
          <CardDescription>
            This payment link has expired. Please contact the merchant for a new payment link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {redirectUrl && (
            <>
              <div className="pt-2">
                <a
                  href={redirectUrl}
                  className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  Return to Store
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
              <Separator />
            </>
          )}

          <div className="pt-2">
            <p className="text-xs text-muted-foreground text-center">
              Order Reference: <span className="font-mono">{order.order_reference || order.id}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    );

    return (
      <PaymentContent
        leftColumn={<OrderSummary data={orderSummaryData} />}
        rightColumn={expiredRightColumn}
      />
    );
  }

  // Prepare OrderSummary data
  const orderSummaryData: OrderSummaryData = {
    title: order.metadata?.title || 'Order Payment',
    description: order.metadata?.description,
    amount: amount,
    currency: tokenSymbol,
    networksDescription: chain.name,
    shareUrl: null,
    isPreview: false,
  };

  // Right column content (action area)
  const rightColumn = (
    <div className="space-y-6">
      {/* Step 1: Continue to Payment Button */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-xl">Ready to Pay</CardTitle>
              <Badge variant="warning">
                <Clock className="w-3 h-3 mr-1" />
                Awaiting Payment
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-sm text-muted-foreground">Payment Address</span>
                <div className="flex flex-col items-end gap-2">
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all text-right max-w-xs">
                    {paymentAddress}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyAddress}
                    className="h-7 text-xs"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <Separator />
            <Button
              className="w-full"
              size="lg"
              onClick={() => setCurrentStep(2)}
            >
              Continue to Payment
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Partial Payment Progress - Show in both steps */}
      {orderStatus && orderStatus.isPartiallyPaid && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Partial Payment Received
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Received</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {orderStatus.receivedAmount} {tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Required</span>
                <span className="font-medium">{orderStatus.requiredAmount} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  {orderStatus.remainingAmount} {tokenSymbol}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{orderStatus.paymentProgress.toFixed(1)}%</span>
              </div>
              <Progress value={orderStatus.paymentProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {orderStatus.transferCount} transfer{orderStatus.transferCount !== 1 ? 's' : ''} received
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please send the remaining amount to complete your order
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Progress */}
      {currentStep === 2 && isWalletPayment && orderStatus && orderStatus.status !== 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Confirming Payment
            </CardTitle>
            <CardDescription>
              Waiting for blockchain confirmations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orderStatus.transactionHash && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground flex-shrink-0">TX Hash:</span>
                <span className="font-mono text-xs flex-1 truncate">
                  {orderStatus.transactionHash}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={() => {
                    // Open blockchain explorer
                    const explorerUrl = chain.metadata?.explorer_url;
                    if (explorerUrl && orderStatus.transactionHash) {
                      window.open(`${explorerUrl}/tx/${orderStatus.transactionHash}`, '_blank');
                    }
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Confirmations</span>
                <span className="font-medium">
                  {orderStatus.currentConfirmations} / {orderStatus.requiredConfirmations}
                </span>
              </div>
              <Progress
                value={(orderStatus.currentConfirmations / orderStatus.requiredConfirmations) * 100}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground text-center">
                This usually takes a few minutes
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Payment Component */}
      {currentStep === 2 && !shouldHidePaymentComponent && !txHash && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep(1)}
                className="h-9 w-9 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-xl">
                Complete Payment
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <AdaptivePayment
              targetAddress={paymentAddress}
              amount={amount}
              tokenSymbol={tokenContract?.symbol || tokenSymbol}
              tokenDecimals={tokenContract?.decimals || 6}
              chainId={chain.chainId}
              chainName={chain.name}
              protocol={chain.protocol}
              tokenContractAddress={tokenContract?.address}
              qrCodeDataUrl={qrCodeDataUrl}
              allowAmountEdit={false}
              showFallback={true}
              showDescription={false}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Main payment UI content with new two-column layout
  const paymentContent = (
    <>
      <PaymentContent
        leftColumn={<OrderSummary data={orderSummaryData} />}
        rightColumn={rightColumn}
      />

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
              <DialogTitle className="text-xl font-semibold">Transaction Error</DialogTitle>
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
    </>
  );

  // Wrap with RainbowKit for EVM chains
  if (chain.protocol === 'evm') {
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
            {paymentContent}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    );
  }

  // Return content directly for non-EVM chains
  return paymentContent;
}

// Render app
function renderApp() {
  const rootElement = document.getElementById('order-payment-root');
  if (!rootElement) return;

  const orderData = (window as any).__ORDER_DATA__;
  const chainData = (window as any).__CHAIN_DATA__;
  const qrCodeDataUrl = (window as any).__QR_CODE_DATA_URL__;
  const supportedChains = (window as any).__SUPPORTED_CHAINS__ || [];

  if (!orderData) {
    console.error('Order data not found');
    return;
  }

  const chainInfo = chainData || {
    chainId: orderData.chain_id || orderData.chainId,
    name: orderData.chain_id || orderData.chainId,
    protocol: orderData.chain_id?.startsWith('tron') ? 'tron' : 'evm',
    network: orderData.chain_id?.includes('mainnet') ? 'mainnet' : 'testnet',
    metadata: orderData.metadata || {}
  };

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <OrderPaymentApp
          order={orderData}
          chain={chainInfo}
          qrCodeDataUrl={qrCodeDataUrl}
          supportedChains={supportedChains}
        />
      </ThemeProvider>
    </React.StrictMode>
  );
}

if (typeof window !== 'undefined') {
  renderApp();
}
