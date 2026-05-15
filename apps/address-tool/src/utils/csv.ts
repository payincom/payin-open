/**
 * CSV export utilities
 */

import { stringify } from 'csv-stringify/sync';
import type { AddressData, Protocol } from '../types.js';

/**
 * Export addresses to CSV format (address,derivation_index)
 */
export function exportToCSV(
  addresses: AddressData[],
  protocol: Protocol
): string {
  const columns = ['address', 'derivation_index'];

  const records = addresses.map(addr => [
    addr.address,
    addr.derivationIndex,
  ]);

  return stringify([columns, ...records]);
}

/**
 * Generate filename for CSV export
 */
export function generateFilename(protocol: Protocol, mode: 'full' | 'simple' = 'full'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' + Date.now();
  return `${protocol}-addresses-${timestamp}-${mode}.csv`;
}

/**
 * Get sample CSV content for display
 */
export function getSampleCSV(protocol: Protocol): string {
  let sampleData: AddressData[];

  if (protocol === 'evm') {
    sampleData = [
      {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        derivationIndex: 0,
        protocol: 'evm',
        masterPublicKey: 'xpub6CUGRUonZSQ4...',
      },
      {
        address: '0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE',
        derivationIndex: 1,
        protocol: 'evm',
        masterPublicKey: 'xpub6CUGRUonZSQ4...',
      },
    ];
  } else if (protocol === 'tron') {
    sampleData = [
      {
        address: 'TYWqRdyeNvW3AJHBvUKzMMnKLq7ctAYtCw',
        derivationIndex: 0,
        protocol: 'tron',
        masterPublicKey: 'xpub6D4BDPcP2GT577...',
      },
      {
        address: 'TXYZoPZKHFahUB3RdyeNvW3AJHBvUKzMM',
        derivationIndex: 1,
        protocol: 'tron',
        masterPublicKey: 'xpub6D4BDPcP2GT577...',
      },
    ];
  } else {
    // Solana
    sampleData = [
      {
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        derivationIndex: 0,
        protocol: 'solana',
        masterPublicKey: 'Gw8cT5Y3k4VFxEqj...',
      },
      {
        address: '4sZZYk3vZ9Ld89QvXLGWzM7PfqHczBKZPMp9VvGxWkWs',
        derivationIndex: 1,
        protocol: 'solana',
        masterPublicKey: 'Gw8cT5Y3k4VFxEqj...',
      },
    ];
  }

  return exportToCSV(sampleData, protocol);
}
