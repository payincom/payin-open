/**
 * Chain Selector Component
 * Allows users to select blockchain network for deposit
 */

import React from 'react';
import { Check } from 'lucide-react';
import type { ChainInfo } from '../types';

interface ChainSelectorProps {
  chains: ChainInfo[];
  selectedChainId: string | null;
  onSelectChain: (chainId: string) => void;
}

export function ChainSelector({ chains, selectedChainId, onSelectChain }: ChainSelectorProps) {
  const renderChainButton = (chain: ChainInfo) => {
    const isSelected = selectedChainId === chain.chainId;
    const networkBadge = chain.network === 'testnet' ? 'TEST' : '';

    return (
      <button
        key={chain.chainId}
        className={`chain-button ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelectChain(chain.chainId)}
      >
        <div className="chain-icon">
          <span className="chain-initial">
            {chain.name.substring(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="chain-info">
          <div className="chain-name">{chain.name}</div>
          {networkBadge && <div className="network-badge">{networkBadge}</div>}
        </div>
        {isSelected && <Check className="check-icon" />}
      </button>
    );
  };

  return (
    <div className="chain-selector">
      <div className="chain-list">
        {chains.map(renderChainButton)}
      </div>

      <style>{`
        .chain-selector {
          width: 100%;
        }

        .chain-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        @media (min-width: 640px) {
          .chain-list {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .chain-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border)) !important;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
          text-align: center;
          width: 100%;
          position: relative;
          min-height: 100px;
        }

        .chain-button:hover {
          border-color: hsl(var(--primary)) !important;
          background: hsl(var(--accent));
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .chain-button.selected {
          border-color: hsl(var(--primary)) !important;
          background: hsl(var(--accent));
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .chain-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(124, 58, 237, 0.15);
          border: 2px solid rgba(124, 58, 237, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease-in-out;
        }

        .chain-button:hover .chain-icon {
          background: rgba(124, 58, 237, 0.25);
          border-color: rgba(124, 58, 237, 0.7);
          transform: scale(1.1);
        }

        .chain-initial {
          font-size: 14px;
          font-weight: 600;
          color: rgb(124, 58, 237);
        }

        .chain-info {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .chain-name {
          font-size: 14px;
          font-weight: 600;
          color: hsl(var(--foreground));
          word-break: break-word;
        }

        .network-badge {
          font-size: 10px;
          font-weight: 700;
          color: #ff9800;
          background: rgba(255, 152, 0, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .check-icon {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 16px;
          height: 16px;
          color: hsl(var(--primary));
          flex-shrink: 0;
        }

        @media (max-width: 600px) {
          .chain-button {
            min-height: 90px;
            padding: 10px;
          }

          .chain-icon {
            width: 36px;
            height: 36px;
          }

          .chain-initial {
            font-size: 13px;
          }

          .chain-name {
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}
