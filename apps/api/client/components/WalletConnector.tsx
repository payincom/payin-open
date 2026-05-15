/**
 * Wallet Connector Component
 * Handles EVM wallet connection using RainbowKit
 */

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';
import { getNumericChainId, getChainByChainId } from '../config/wagmi';
import { parseBlockchainError } from '../utils/errorHandler';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';

// ERC20 ABI for transfer function
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function'
  }
] as const;

interface WalletConnectorProps {
  targetAddress: string;
  amount: string;
  tokenSymbol: string;
  tokenDecimals: number;
  chainId: string;
  tokenContractAddress?: string; // ERC20 token contract address
  allowAmountEdit?: boolean; // New prop to enable amount editing
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

export function WalletConnector({
  targetAddress,
  amount,
  tokenSymbol,
  tokenDecimals,
  chainId,
  tokenContractAddress,
  allowAmountEdit = false,
  onSuccess,
  onError,
}: WalletConnectorProps) {
  const { address, isConnected, chain: currentChain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { data: hash, isPending: isWritePending, writeContract, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });


  // State for editable amount
  const [editableAmount, setEditableAmount] = React.useState(amount || '');

  // State for error messages
  const [validationError, setValidationError] = React.useState<string>('');

  // Track if we've already called onSuccess to avoid duplicate calls
  const onSuccessCalledRef = React.useRef(false);

  // Reset the ref when hash changes
  React.useEffect(() => {
    if (hash) {
      onSuccessCalledRef.current = false;
    }
  }, [hash]);

  // Handle transaction confirmation
  React.useEffect(() => {
    if (isConfirmed && hash && onSuccess && !onSuccessCalledRef.current) {
      onSuccessCalledRef.current = true;
      onSuccess(hash);
    }
  }, [isConfirmed, hash]); // Intentionally not including onSuccess

  // Handle write errors
  React.useEffect(() => {
    if (writeError && onError) {
      const friendlyMessage = parseBlockchainError(writeError);
      const friendlyError = new Error(friendlyMessage);
      (friendlyError as any).originalError = writeError;
      onError(friendlyError);
    }
  }, [writeError]); // Intentionally not including onError

  // Parse chainId to number
  const targetChainId = React.useMemo(() => {
    // chainId could be:
    // 1. PayIn chain identifier like "ethereum-sepolia" (string)
    // 2. Numeric chainId like "11155111" (string)
    // 3. Hex chainId like "0xaa36a7" (string)
    // 4. Already a number

    const chainIdStr = String(chainId);
    let parsed: number | null;

    // First try to get numeric chainId from PayIn identifier
    parsed = getNumericChainId(chainIdStr);

    // If not found, try parsing as hex
    if (parsed === null && chainIdStr.startsWith('0x')) {
      parsed = parseInt(chainIdStr, 16);
    }

    // If still not found, try parsing as decimal
    if (parsed === null) {
      const decimal = parseInt(chainIdStr, 10);
      parsed = isNaN(decimal) ? null : decimal;
    }

    console.log('[WalletConnector] Parse chainId:', {
      input: chainId,
      inputType: typeof chainId,
      chainIdStr,
      parsed,
      parsedType: typeof parsed
    });

    return parsed || 0;
  }, [chainId]);

  // Get target chain object for displaying chain name
  const targetChain = React.useMemo(() => {
    return getChainByChainId(chainId);
  }, [chainId]);

  // Check if we're on the wrong network
  const isWrongNetwork = React.useMemo(() => {
    if (!isConnected || !currentChain) return false;
    const isWrong = currentChain.id !== targetChainId;
    console.log('[WalletConnector] Network check:', {
      currentChainId: currentChain.id,
      currentChainIdType: typeof currentChain.id,
      targetChainId,
      targetChainIdType: typeof targetChainId,
      isWrong,
      comparison: `${currentChain.id} !== ${targetChainId}`
    });
    return isWrong;
  }, [isConnected, currentChain, targetChainId]);

  // Handle network switch
  const handleSwitchNetwork = async () => {
    if (!switchChain) return;
    try {
      await switchChain({ chainId: targetChainId });
    } catch (error) {
      console.error('Failed to switch network:', error);
      if (onError) {
        const friendlyMessage = parseBlockchainError(error as Error);
        const friendlyError = new Error(friendlyMessage);
        (friendlyError as any).originalError = error;
        onError(friendlyError);
      }
    }
  };

  const handleSendPayment = async () => {
    // Clear previous validation errors
    setValidationError('');

    if (!isConnected || !address) {
      setValidationError('Please connect your wallet first');
      return;
    }

    // Check if we're on the correct network
    if (isWrongNetwork) {
      setValidationError('Please switch to the correct network first');
      return;
    }

    // Validate amount
    const amountToSend = allowAmountEdit ? editableAmount : amount;
    if (!amountToSend || parseFloat(amountToSend) <= 0) {
      setValidationError('Please enter a valid amount');
      return;
    }

    // Validate token contract address
    if (!tokenContractAddress) {
      setValidationError('Token contract address is required');
      return;
    }

    try {
      // Send ERC20 token using writeContract
      const value = parseUnits(amountToSend, tokenDecimals);

      writeContract({
        address: tokenContractAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [targetAddress as `0x${string}`, value],
      });
    } catch (error) {
      console.error('Failed to send transaction:', error);
      if (onError) {
        const friendlyMessage = parseBlockchainError(error as Error);
        const friendlyError = new Error(friendlyMessage);
        (friendlyError as any).originalError = error;
        onError(friendlyError);
      }
    }
  };

  return (
    <div className="wallet-connector">
      <div className="connect-section">
        <div className="connect-button-wrapper">
          <span className="connect-label">From:</span>
          <ConnectButton
            chainStatus="none"
            showBalance={false}
          />
        </div>
      </div>

      {isConnected && (
        <div className="payment-section">
          {/* Validation Error Alert */}
          {validationError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Network Warning */}
          {isWrongNetwork && (
            <div className="network-warning">
              <div className="warning-header">
                <AlertTriangle className="h-5 w-5" />
                <p className="warning-description">
                  Current chain: <span className="network-name">{currentChain?.name || 'Unknown'}</span>
                </p>
              </div>
              <Button className="w-full" onClick={handleSwitchNetwork}>
                Switch Wallet to {targetChain?.name || 'Correct Network'}
              </Button>
            </div>
          )}

          <div className="payment-info">
            <p className="info-label">{allowAmountEdit ? 'Deposit' : 'Payment'} Amount:</p>
            {allowAmountEdit ? (
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={editableAmount}
                  onChange={(e) => setEditableAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="0"
                  step="0.000001"
                  className="flex-1 text-lg font-semibold"
                  disabled={isWrongNetwork}
                />
                <span className="token-symbol whitespace-nowrap">{tokenSymbol}</span>
              </div>
            ) : (
              <p className="info-value">
                {amount} {tokenSymbol}
              </p>
            )}
          </div>

          <div className="payment-info">
            <p className="info-label">To Address:</p>
            <code className="info-value address-full">
              <span className="address-bold">{targetAddress.slice(0, 4)}</span>
              {targetAddress.slice(4, -4)}
              <span className="address-bold">{targetAddress.slice(-4)}</span>
            </code>
          </div>

          {/* Show button until transaction hash is detected */}
          {!isWrongNetwork && !hash && (
            <Button
              className="w-full mt-4"
              size="lg"
              onClick={handleSendPayment}
              disabled={isWritePending || isConfirming}
            >
              {isWritePending ? 'Opening Wallet...' : 'Send ' + tokenSymbol}
            </Button>
          )}

          {hash && (
            <div className="tx-status">
              <p className="tx-hash-label">Transaction Hash: <code className="tx-hash-code">{hash.slice(0, 12)}...{hash.slice(-8)}</code></p>
              {isConfirming && (
                <p className="status-text confirming">
                  <Clock className="h-4 w-4" />
                  Waiting for confirmation...
                </p>
              )}
              {isConfirmed && (
                <p className="status-text success">
                  <CheckCircle className="h-4 w-4" />
                  Transaction confirmed!
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .wallet-connector {
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
        }

        .connect-section {
          margin-bottom: 30px;
          display: flex;
          justify-content: center;
        }

        .connect-button-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .connect-label {
          color: hsl(var(--muted-foreground));
          font-size: 14px;
          font-weight: 500;
        }

        .payment-section {
          background: hsl(var(--muted) / 0.3);
          border-radius: 12px;
          padding: 24px;
          margin-top: 20px;
        }

        .network-warning {
          background: hsl(var(--muted) / 0.5);
          border-left: 4px solid hsl(var(--primary));
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .warning-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .warning-header svg {
          color: hsl(var(--primary));
          flex-shrink: 0;
          margin-top: 2px;
        }

        .warning-title {
          color: hsl(var(--foreground));
          font-weight: 600;
          margin: 0 0 4px 0;
          font-size: 15px;
        }

        .warning-description {
          color: hsl(var(--muted-foreground));
          font-size: 13px;
          margin: 0;
          line-height: 1.5;
        }

        .network-name {
          color: hsl(var(--foreground));
          font-weight: 600;
        }


        .payment-info {
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid hsl(var(--border));
        }

        .payment-info:last-of-type {
          border-bottom: none;
        }

        .info-label {
          color: hsl(var(--muted-foreground));
          font-size: 14px;
          margin-bottom: 6px;
        }

        .info-value {
          color: hsl(var(--foreground));
          font-size: 18px;
          font-weight: 600;
        }

        .info-value.address {
          font-family: 'Courier New', monospace;
          font-size: 16px;
        }

        .info-value.address-full {
          font-family: 'Courier New', monospace;
          font-size: 14px;
          word-break: break-all;
          line-height: 1.6;
          font-weight: 500;
        }

        .address-bold {
          font-weight: 700;
        }

        .token-symbol {
          color: hsl(var(--primary));
          font-weight: 600;
          font-size: 16px;
          white-space: nowrap;
        }

        .tx-status {
          margin-top: 16px;
          padding: 10px 12px;
          background: hsl(var(--card));
          border-radius: 8px;
          border: 1px solid hsl(var(--border));
          min-height: 44px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .tx-status p {
          margin: 2px 0;
          font-size: 13px;
          color: hsl(var(--muted-foreground));
          line-height: 1.4;
        }

        .tx-hash-label {
          color: hsl(var(--foreground));
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 4px !important;
        }

        .tx-hash-code {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          background: hsl(var(--muted));
          padding: 1px 4px;
          border-radius: 3px;
          color: hsl(var(--primary));
        }

        .status-text {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          margin-top: 4px !important;
          font-size: 13px;
        }

        .status-text svg {
          flex-shrink: 0;
        }

        .status-text.confirming {
          color: #ff9800;
        }

        .status-text.confirming svg {
          color: #ff9800;
        }

        .status-text.success {
          color: #4caf50;
        }

        .status-text.success svg {
          color: #4caf50;
        }

        /* Dark theme improvements */
        :global(.dark) .payment-section {
          background: hsl(var(--muted) / 0.2);
        }

        :global(.dark) .tx-status {
          background: hsl(var(--muted) / 0.3);
        }
      `}</style>
    </div>
  );
}
