/**
 * QR Code Payment Component
 * For Tron and fallback payment method
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './ui/button';

interface QRCodePaymentProps {
  address: string;
  qrCodeDataUrl: string;
  protocol: 'evm' | 'tron';
  chainName: string;
  chainId?: string;
  tokenContractAddress?: string;
  tokenDecimals?: number;
  amount?: string;
  tokenSymbol?: string;
}

export function QRCodePayment({
  address,
  qrCodeDataUrl,
  protocol,
  chainName,
  chainId,
  tokenContractAddress,
  tokenDecimals = 6,
  amount,
  tokenSymbol,
}: QRCodePaymentProps) {
  const [copySuccess, setCopySuccess] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy address');
    }
  };

  const getDeepLink = () => {
    if (protocol === 'tron') {
      // TronLink deep link (Note: TronLink has blocked third-party deeplinks since Aug 2023)
      // This may not work without whitelisting
      if (tokenContractAddress && amount) {
        // TRC20 token transfer
        const params = {
          action: 'transfer',
          contract: tokenContractAddress,
          to: address,
          amount: amount,
          tokenId: '0',
        };
        return `tronlinkoutside://pull.activity?param=${encodeURIComponent(JSON.stringify(params))}`;
      } else {
        // TRX transfer
        return `tronlink://send?address=${address}${amount ? `&amount=${amount}` : ''}`;
      }
    } else {
      // MetaMask ERC-20 token deeplink
      if (tokenContractAddress && amount && chainId) {
        // ERC-20 token transfer
        // Format: https://metamask.app.link/send/<contractAddress>@<chainId>/transfer?address=<recipientAddress>&uint256=<amount>
        // Amount should be in smallest unit (e.g., 1 USDT = 1000000 for 6 decimals)
        const amountInSmallestUnit = parseFloat(amount) * Math.pow(10, tokenDecimals);
        return `https://metamask.app.link/send/${tokenContractAddress}@${chainId}/transfer?address=${address}&uint256=${amountInSmallestUnit.toFixed(0)}`;
      } else {
        // Native token (ETH) transfer
        return `metamask://send?address=${address}${amount ? `&value=${amount}` : ''}`;
      }
    }
  };

  const getWalletName = () => {
    return protocol === 'tron' ? 'TronLink' : 'MetaMask';
  };

  return (
    <div className="qrcode-payment">
      {/* QR Code Section */}
      <div className="qr-section">
        <div className="qr-code-container">
          <img src={qrCodeDataUrl} alt="QR Code" className="qr-code-img" />
        </div>
      </div>

      {/* Address Section */}
      <div className="address-section">
        <p className="address-label">Receiving Address</p>
        <div className="address-container">
          <div className="address-wrapper">
            <code className="address-text">
              <span className="address-bold">{address.slice(0, 4)}</span>
              {address.slice(4, -4)}
              <span className="address-bold">{address.slice(-4)}</span>
            </code>
          </div>
          <Button onClick={handleCopy} className="gap-2">
            {copySuccess ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>
      {/* Warning Box */}
      {tokenSymbol && (
        <div className="warning-box">
          <div className="warning-title">Important</div>
          <div className="warning-content">
            {amount && amount !== '0' ? (
              <ul className="warning-list">
                <li>Send exactly <strong>{amount} {tokenSymbol}</strong></li>
                <li>Use <strong>{chainName}</strong> network</li>
                <li>Double-check the address before sending</li>
              </ul>
            ) : (
              <ul className="warning-list">
                <li>Send only <strong>{tokenSymbol}</strong> tokens</li>
                <li>Use <strong>{chainName}</strong> network</li>
                <li>Double-check the address before sending</li>
              </ul>
            )}
          </div>
        </div>
      )}

      <style>{`
        .qrcode-payment {
          width: 100%;
          max-width: 550px;
          margin: 0 auto;
        }

        .qr-section {
          text-align: center;
          margin-bottom: 16px;
        }

        .qr-code-container {
          background: hsl(var(--card));
          padding: 16px;
          border-radius: 12px;
          display: inline-block;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .qr-code-img {
          display: block;
          width: 200px;
          height: 200px;
        }

        .address-section {
          margin-bottom: 16px;
        }

        .address-label {
          color: hsl(var(--foreground));
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .address-container {
          display: flex;
          gap: 12px;
          align-items: stretch;
          background: hsl(var(--muted) / 0.3);
          padding: 4px;
          border-radius: 10px;
          border: 1px solid hsl(var(--border));
        }

        .address-wrapper {
          flex: 1;
          display: flex;
          align-items: center;
          background: hsl(var(--card));
          padding: 14px 16px;
          border-radius: 8px;
        }

        .address-text {
          width: 100%;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          font-weight: 500;
          color: hsl(var(--foreground));
          word-break: break-all;
          line-height: 1.6;
        }

        .address-bold {
          font-weight: 700;
        }

        .warning-box {
          background: hsl(var(--muted) / 0.2);
          border-width: 2px;
          border-style: dashed;
          border-color: hsl(var(--border));
          padding: 14px 16px;
          border-radius: 10px;
          color: hsl(var(--foreground));
        }

        .warning-title {
          font-size: 15px;
          font-weight: 700;
          color: hsl(var(--foreground));
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .warning-content {
          font-size: 14px;
          line-height: 1.6;
        }

        .warning-list {
          margin: 0;
          padding-left: 20px;
          list-style-type: disc;
        }

        .warning-list li {
          margin-bottom: 6px;
          color: hsl(var(--foreground));
        }

        .warning-list li:last-child {
          margin-bottom: 0;
        }

        .warning-box strong {
          color: hsl(var(--foreground));
          font-weight: 700;
        }

        @media (max-width: 600px) {
          .qr-code-img {
            width: 180px;
            height: 180px;
          }

          .address-text {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
