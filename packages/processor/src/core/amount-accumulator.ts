// Define Order type locally
type Order = {
  id: string;
  status: string;
  amount: string;
  confirmed_received?: string;
  created_at: Date;
  updated_at: Date;
  payment_window_minutes?: number;
  grace_period_minutes?: number;
  [key: string]: any;
};

/**
 * Amount accumulation and monitoring control logic
 */
export class AmountAccumulator {
  /**
   * Add a confirmed transaction to the order's received transactions
   */
  addTransaction(order: Order, txHash: string, amount: string, blockNumber: number): {
    updatedOrder: Order;
    newReceivedAmount: string;
    isAmountSufficient: boolean;
    isOverpaid: boolean;
  } {
    const currentReceived = parseFloat(order.confirmed_received || '0');
    const txAmount = parseFloat(amount);
    const newReceivedAmount = (currentReceived + txAmount).toString();
    const requiredAmount = parseFloat(order.amount);

    const updatedOrder = {
      ...order,
      confirmed_received: newReceivedAmount,
      updated_at: new Date()
    };

    const isAmountSufficient = parseFloat(newReceivedAmount) >= requiredAmount;
    const isOverpaid = parseFloat(newReceivedAmount) > requiredAmount;

    return {
      updatedOrder,
      newReceivedAmount,
      isAmountSufficient,
      isOverpaid
    };
  }

  /**
   * Check if order should stop monitoring based on amount and time
   */
  shouldStopMonitoring(order: Order): {
    shouldStop: boolean;
    reason: 'amount_sufficient' | 'grace_period_expired' | 'completed' | 'continue';
  } {
    const timeoutStatus = this.getTimeoutStatus(order);
    const receivedAmount = parseFloat(order.confirmed_received || '0');
    const requiredAmount = parseFloat(order.amount);

    if (order.status === 'completed') {
      return { shouldStop: true, reason: 'completed' };
    }

    if (receivedAmount >= requiredAmount) {
      return { shouldStop: true, reason: 'amount_sufficient' };
    }

    if (timeoutStatus.isGracePeriodExpired) {
      return { shouldStop: true, reason: 'grace_period_expired' };
    }

    return { shouldStop: false, reason: 'continue' };
  }

  /**
   * Get remaining amount needed for the order
   */
  getRemainingAmount(order: Order): string {
    const received = parseFloat(order.confirmed_received || '0');
    const required = parseFloat(order.amount);
    const remaining = Math.max(0, required - received);
    return remaining.toString();
  }

  /**
   * Get payment progress as percentage
   */
  getPaymentProgress(order: Order): number {
    const received = parseFloat(order.confirmed_received || '0');
    const required = parseFloat(order.amount);
    return required > 0 ? Math.min(100, (received / required) * 100) : 0;
  }

  /**
   * Check if order is in a state where it can still receive payments
   */
  canReceivePayments(order: Order): boolean {
    const completedStates = ['completed', 'cancelled', 'expired'];
    if (completedStates.includes(order.status)) {
      return false;
    }

    const timeoutStatus = this.getTimeoutStatus(order);
    return !timeoutStatus.isGracePeriodExpired;
  }

  /**
   * Get timeout status information
   */
  getTimeoutStatus(order: Order): {
    isPaymentWindowExpired: boolean;
    isGracePeriodExpired: boolean;
    isInGracePeriod: boolean;
    paymentWindowRemainingMs: number;
    gracePeriodRemainingMs: number;
  } {
    const now = new Date();
    const createdAt = new Date(order.created_at);
    const paymentWindowMs = (order.payment_window_minutes || 30) * 60 * 1000;
    const gracePeriodMs = (order.grace_period_minutes || 5) * 60 * 1000;

    const paymentWindowEndMs = createdAt.getTime() + paymentWindowMs;
    const gracePeriodEndMs = paymentWindowEndMs + gracePeriodMs;

    const paymentWindowRemainingMs = Math.max(0, paymentWindowEndMs - now.getTime());
    const gracePeriodRemainingMs = Math.max(0, gracePeriodEndMs - now.getTime());

    const isPaymentWindowExpired = now.getTime() > paymentWindowEndMs;
    const isGracePeriodExpired = now.getTime() > gracePeriodEndMs;
    const isInGracePeriod = isPaymentWindowExpired && !isGracePeriodExpired;

    return {
      isPaymentWindowExpired,
      isGracePeriodExpired,
      isInGracePeriod,
      paymentWindowRemainingMs,
      gracePeriodRemainingMs
    };
  }

  /**
   * Create summary of order payment status
   */
  getPaymentSummary(order: Order): {
    requiredAmount: string;
    receivedAmount: string;
    remainingAmount: string;
    progressPercentage: number;
    transactionCount: number;
    canReceiveMore: boolean;
    timeoutStatus: ReturnType<AmountAccumulator['getTimeoutStatus']>;
  } {
    return {
      requiredAmount: order.amount,
      receivedAmount: order.confirmed_received || '0',
      remainingAmount: this.getRemainingAmount(order),
      progressPercentage: this.getPaymentProgress(order),
      transactionCount: 0, // Would need to track this separately
      canReceiveMore: this.canReceivePayments(order),
      timeoutStatus: this.getTimeoutStatus(order)
    };
  }
}

export const defaultAmountAccumulator = new AmountAccumulator();