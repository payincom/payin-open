/**
 * Transfer Status API Routes
 * Public endpoint for querying transfer confirmation status by transaction hash
 */

import { Hono } from 'hono';
import { getManager } from '../manager-instance.js';

const transferStatus = new Hono();

/**
 * Get transfer confirmation status by transaction hash
 * GET /api/transfer-status/:txHash
 * Public endpoint - No authentication required
 */
transferStatus.get('/:txHash', async (c) => {
  try {
    const manager = getManager();
    const txHash = c.req.param('txHash')!;

    console.log('[TransferStatus] Querying transfer for txHash:', txHash);

    // Query transfer through Manager -> Processor -> Repository
    const transfer = await manager.getTransferByTxHash(txHash);

    if (!transfer) {
      console.log('[TransferStatus] No transfer found for txHash:', txHash);
      return c.json({
        success: false,
        message: 'Transfer not found. It may not have been detected yet.',
        data: {
          txHash,
          found: false,
        },
      });
    }

    console.log('[TransferStatus] Transfer found:', {
      id: transfer.id,
      status: transfer.status,
      confirmations: transfer.last_checked_confirmations,
      required: transfer.required_confirmations,
    });

    // Get redirect URL for confirmed deposits
    let redirectUrl: string | null = null;
    if (transfer.business_type === 'deposit' && transfer.is_confirmed) {
      redirectUrl = await manager.getDepositRedirectUrl(transfer.id);
    }

    // Return transfer confirmation status
    return c.json({
      success: true,
      data: {
        txHash: transfer.transaction_hash,
        found: true,
        transferId: transfer.id,
        status: transfer.status,
        amount: transfer.amount,
        tokenSymbol: transfer.token,
        chain: transfer.chain,
        requiredConfirmations: transfer.required_confirmations,
        currentConfirmations: transfer.last_checked_confirmations || 0,
        isConfirmed: transfer.is_confirmed || false,
        confirmedAt: transfer.confirmed_at,
        detectedAt: transfer.detected_at,
        fromAddress: transfer.from_address,
        toAddress: transfer.to_address,
        redirectUrl: redirectUrl, // Add redirect URL for completed deposits
      },
    });
  } catch (error: any) {
    console.error('[TransferStatus] Error querying transfer:', error);
    return c.json(
      {
        success: false,
        message: error.message || 'Failed to query transfer status',
      },
      500
    );
  }
});

export default transferStatus;
