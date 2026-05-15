/**
 * Token Selector Component
 * Allows users to select which token to use for deposit
 */

import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';

interface TokenOption {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
}

interface TokenSelectorProps {
  tokens: TokenOption[];
  selectedToken: string | null;
  onSelectToken: (tokenSymbol: string) => void;
}

export function TokenSelector({ tokens, selectedToken, onSelectToken }: TokenSelectorProps) {
  if (tokens.length === 0) {
    return (
      <div className="no-tokens-message">
        <AlertTriangle className="h-6 w-6" />
        <p>No tokens available</p>
        <style>{`
          .no-tokens-message {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 40px 20px;
            color: #ff9800;
          }
          .no-tokens-message svg {
            flex-shrink: 0;
          }
        `}</style>
      </div>
    );
  }

  // Removed auto-selection logic - users must explicitly choose
  return (
    <div className="token-selector">
      <div className="token-grid">
        {tokens.map((token) => (
          <button
            key={token.symbol}
            className={`token-card ${selectedToken === token.symbol ? 'selected' : ''}`}
            onClick={() => onSelectToken(token.symbol)}
          >
            <div className="token-icon">
              {token.symbol.substring(0, 2)}
            </div>
            <div className="token-info">
              <div className="token-symbol">{token.symbol}</div>
              <div className="token-name">{token.name}</div>
            </div>
            {selectedToken === token.symbol && (
              <div className="selected-badge">
                <Check className="h-4 w-4" />
              </div>
            )}
          </button>
        ))}
      </div>

      <style>{`
        .token-selector {
          width: 100%;
        }

        .token-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }

        .token-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          text-align: left;
        }

        .token-card:hover {
          border-color: #667eea;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .token-card.selected {
          border-color: #667eea;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .token-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 18px;
          flex-shrink: 0;
        }

        .token-card.selected .token-icon {
          background: rgba(255, 255, 255, 0.3);
        }

        .token-info {
          flex: 1;
        }

        .token-symbol {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .token-name {
          font-size: 14px;
          opacity: 0.8;
        }

        .selected-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 24px;
          height: 24px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        @media (max-width: 600px) {
          .token-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
