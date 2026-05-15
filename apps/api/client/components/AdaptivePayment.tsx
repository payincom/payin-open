/**
 * Adaptive Payment Component
 * Automatically switches between wallet connection and manual transfer based on environment
 */

import React from 'react';
import { Check, Lightbulb, Info } from 'lucide-react';
import { useWalletEnvironment } from '../hooks/useWalletEnvironment';
import { WalletConnector } from './WalletConnector';
import { QRCodePayment } from './QRCodePayment';

interface AdaptivePaymentProps {
  // Payment details
  targetAddress: string;
  amount?: string; // Optional for deposit flows where user can send any amount
  tokenSymbol: string;
  tokenDecimals: number;
  chainId: string;
  chainName: string;
  protocol: 'evm' | 'tron';
  tokenContractAddress?: string;
  qrCodeDataUrl?: string;

  // Optional features
  allowAmountEdit?: boolean;
  showFallback?: boolean;
  showDescription?: boolean;

  // Callbacks
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
  onModeChange?: (isWalletMode: boolean) => void;
}

export function AdaptivePayment({
  targetAddress,
  amount,
  tokenSymbol,
  tokenDecimals,
  chainId,
  chainName,
  protocol,
  tokenContractAddress,
  qrCodeDataUrl,
  allowAmountEdit = false,
  showFallback = true,
  showDescription = false,
  onSuccess,
  onError,
  onModeChange,
}: AdaptivePaymentProps) {
  const env = useWalletEnvironment();
  const [showManualOption, setShowManualOption] = React.useState(false);

  // Force manual mode for Tron or if explicitly requested
  const forceManualMode = protocol === 'tron' || showManualOption;

  // Show wallet connector if:
  // - EVM protocol
  // - Has wallet (injected, walletconnect, or dapp browser)
  // - Not in manual mode
  const shouldShowWalletConnector =
    protocol === 'evm' &&
    env.connectionMode !== 'manual' &&
    !forceManualMode;

  // Notify parent component when mode changes
  React.useEffect(() => {
    onModeChange?.(shouldShowWalletConnector);
  }, [shouldShowWalletConnector, onModeChange]);

  // Render description based on mode
  const renderDescription = () => {
    if (!showDescription) return null;

    if (shouldShowWalletConnector) {
      return (
        <div className="payment-description">
          Connect your wallet to complete the transfer
        </div>
      );
    } else {
      return (
        <div className="payment-description">
          Scan the QR code below
        </div>
      );
    }
  };

  // Render environment hints - only for wallet mode
  const renderEnvironmentHints = () => {
    // Don't show any hints in manual/QR mode
    if (forceManualMode) return null;

    if (env.isInWalletBrowser) {
      return (
        <div className="env-hint in-wallet">
          <Check className="h-4 w-4" />
          <span>You're in a wallet browser. Click connect to proceed.</span>
        </div>
      );
    }

    if (env.isMobile && env.connectionMode === 'walletconnect') {
      return (
        <div className="env-hint mobile">
          <Lightbulb className="h-4 w-4" />
          <span>Clicking connect will open your wallet app if installed.</span>
        </div>
      );
    }

    // Desktop without wallet - don't show warning in manual mode
    if (env.platform === 'desktop' && env.connectionMode === 'manual' && shouldShowWalletConnector) {
      return (
        <div className="env-hint desktop-no-wallet">
          <Info className="h-4 w-4" />
          <span>
            No wallet extension detected. Please install{' '}
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">
              MetaMask
            </a>{' '}
            or use manual transfer below.
          </span>
        </div>
      );
    }

    return null;
  };

  // Render wallet connection option
  const renderWalletOption = () => {
    if (!shouldShowWalletConnector) return null;

    return (
      <div className="wallet-payment-option">
        <WalletConnector
          targetAddress={targetAddress}
          amount={amount}
          tokenSymbol={tokenSymbol}
          tokenDecimals={tokenDecimals}
          chainId={chainId}
          tokenContractAddress={tokenContractAddress}
          allowAmountEdit={allowAmountEdit}
          onSuccess={onSuccess}
          onError={onError}
        />

        {showFallback && qrCodeDataUrl && (
          <button
            className="show-manual-btn"
            onClick={() => setShowManualOption(true)}
          >
            Can't connect? Use manual transfer
          </button>
        )}
      </div>
    );
  };

  // Render manual transfer option
  const renderManualOption = () => {
    if (!forceManualMode && shouldShowWalletConnector) return null;

    if (!qrCodeDataUrl) {
      return (
        <div className="manual-payment-option">
          <div className="error-message">
            QR code not available. Please contact support.
          </div>
        </div>
      );
    }

    return (
      <div className="manual-payment-option">
        {showManualOption && shouldShowWalletConnector && (
          <button
            className="back-to-wallet-btn"
            onClick={() => setShowManualOption(false)}
          >
            ← Back to wallet connection
          </button>
        )}

        <QRCodePayment
          address={targetAddress}
          qrCodeDataUrl={qrCodeDataUrl}
          protocol={protocol}
          chainName={chainName}
          chainId={chainId}
          tokenContractAddress={tokenContractAddress}
          tokenDecimals={tokenDecimals}
          amount={amount}
          tokenSymbol={tokenSymbol}
        />
      </div>
    );
  };

  return (
    <div className="adaptive-payment">
      {renderDescription()}
      {renderEnvironmentHints()}
      {renderWalletOption()}
      {renderManualOption()}

      <style>{`
        .adaptive-payment {
          width: 100%;
        }

        .payment-description {
          font-size: 14px;
          color: hsl(var(--muted-foreground));
          margin-bottom: 16px;
          line-height: 1.5;
        }

        .env-hint {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          line-height: 1.5;
        }

        .env-hint.in-wallet {
          background: rgba(76, 175, 80, 0.1);
          border-left: 4px solid #4caf50;
          color: hsl(var(--foreground));
        }

        .env-hint.in-wallet svg {
          color: #4caf50;
          flex-shrink: 0;
        }

        .env-hint.mobile {
          background: rgba(33, 150, 243, 0.1);
          border-left: 4px solid #2196f3;
          color: hsl(var(--foreground));
        }

        .env-hint.mobile svg {
          color: #2196f3;
          flex-shrink: 0;
        }

        .env-hint.desktop-no-wallet {
          background: rgba(255, 152, 0, 0.1);
          border-left: 4px solid #ff9800;
          color: hsl(var(--foreground));
        }

        .env-hint.desktop-no-wallet svg {
          color: #ff9800;
          flex-shrink: 0;
        }

        .env-hint a {
          color: inherit;
          text-decoration: underline;
          font-weight: 600;
        }

        .wallet-payment-option {
          margin-bottom: 20px;
        }

        .show-manual-btn {
          width: 100%;
          margin-top: 16px;
          padding: 8px;
          background: transparent;
          border: none;
          color: hsl(var(--color-primary));
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          text-decoration: underline;
          text-underline-offset: 4px;
        }

        .show-manual-btn:hover {
          opacity: 0.8;
          text-decoration: underline;
        }

        .manual-payment-option {
          position: relative;
        }

        .back-to-wallet-btn {
          margin-bottom: 20px;
          padding: 10px 16px;
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          color: #666;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .back-to-wallet-btn:hover {
          background: #e0e0e0;
        }

        .error-message {
          background: #ffebee;
          border-left: 4px solid #f44336;
          padding: 16px;
          border-radius: 8px;
          color: #c62828;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
