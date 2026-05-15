/**
 * Client-side Type Definitions
 */

export interface ChainInfo {
  chainId: string;
  protocol: 'evm' | 'tron';
  network: 'mainnet' | 'testnet';
  name: string;
  displayOrder: number;
  metadata?: {
    chain_id_numeric?: number;
    icon?: string;
    explorer_url?: string;
    rpc_url?: string;
  };
}

export interface OrderInfo {
  id: string;
  order_reference?: string;
  chain_id: string;
  chainId?: string;
  amount: string;
  token_symbol?: string;
  currency?: string;
  payment_address?: string;
  paymentAddress?: string;
  status: 'pending' | 'completed' | 'expired';
  metadata?: {
    title?: string;
    description?: string;
  };
}

export interface DepositInfo {
  deposit_reference: string;
  address: string;
  protocol: 'evm' | 'tron';
  metadata?: {
    title?: string;
    description?: string;
  };
}
