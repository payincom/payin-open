/**
 * Public Order Status API
 * Allows payment pages to check order confirmation status without authentication
 */

import { Hono } from 'hono';
import { getManager } from '../manager-instance.js';

const orderStatus = new Hono();

/**
 * Get order confirmation status
 * GET /api/order-status/:orderId
 * Public endpoint - No authentication required
 *
 * Returns:
 * - Order status (pending, completed, expired)
 * - Required confirmations
 * - Current confirmations (if transaction detected)
 * - Transaction hash (if available)
 */
orderStatus.get('/:orderId', async (c) => {
  try {
    const manager = getManager();
    const orderId = c.req.param('orderId')!;

    // Get order details
    const order = await manager.getOrder(orderId);

    if (!order) {
      return c.json({
        success: false,
        error: 'Order not found',
        message: `Order with ID "${orderId}" does not exist`
      }, 404);
    }

    // Get transfer records for this order (if any)
    const transfersResult = await manager.listTransfers({
      orderId,
      limit: 10,
    });
    const transfers = transfersResult.transfers ?? [];

    // Calculate current confirmations if we have a transfer
    let currentConfirmations = 0;
    let transactionHash: string | null = null;
    let transferStatus: string | null = null;

    if (transfers.length > 0) {
      const latestTransfer = transfers[0];
      transactionHash = latestTransfer.transaction_hash;
      transferStatus = latestTransfer.status;

      if (latestTransfer.confirmed_at && latestTransfer.detected_block_number && latestTransfer.confirmed_block_number) {
        currentConfirmations = latestTransfer.confirmed_block_number - latestTransfer.detected_block_number + 1;
      } else if (latestTransfer.detected_block_number) {
        // If not yet confirmed, we can try to get current block height
        // For now, just return 0 or 1 depending on whether it's detected
        currentConfirmations = 1;
      }
    }

    // Calculate payment progress
    const requiredAmount = parseFloat(order.amount);
    const receivedAmount = parseFloat(order.confirmed_received || '0');
    const remainingAmount = Math.max(0, requiredAmount - receivedAmount);
    const paymentProgress = requiredAmount > 0 ? (receivedAmount / requiredAmount) * 100 : 0;
    const isPartiallyPaid = receivedAmount > 0 && receivedAmount < requiredAmount;
    const isFullyPaid = receivedAmount >= requiredAmount;

    // Get redirect URL for completed/expired orders
    let redirectUrl: string | null = null;
    if (order.status === 'completed' || order.status === 'expired') {
      redirectUrl = await manager.getOrderRedirectUrl(
        order.id,
        order.status === 'completed'
      );
    }

    return c.json({
      success: true,
      data: {
        orderId: order.id,
        orderReference: order.order_reference,
        status: order.status,
        amount: order.amount,
        token: order.token,
        chain: order.chain,
        address: order.address,
        requiredConfirmations: order.required_confirmations,
        currentConfirmations,
        transactionHash,
        transferStatus,
        confirmedReceived: order.confirmed_received || '0',
        completedAt: order.completed_at,
        createdAt: order.created_at,
        // Payment progress info
        requiredAmount: order.amount,
        receivedAmount: order.confirmed_received || '0',
        remainingAmount: remainingAmount.toString(),
        paymentProgress: Math.min(paymentProgress, 100),
        isPartiallyPaid,
        isFullyPaid,
        transferCount: transfers.length,
        // Redirect URL for completed/expired orders
        redirect_url: redirectUrl,
      }
    });
  } catch (error) {
    console.error(`Failed to get order status for ${c.req.param('orderId')!}:`, error);
    return c.json({
      success: false,
      error: 'Failed to get order status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default orderStatus;
