// Define types locally with literal types
type OrderStatus = 'pending' | 'expired' | 'completed';

type StateTransition = {
  from: OrderStatus;
  to: OrderStatus;
  context?: Record<string, any>;
};

type Order = {
  id: string;
  status: OrderStatus;
  [key: string]: any;
};

export class OrderStateMachine {
  private static readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    pending: ['completed', 'expired'],
    expired: [], // terminal state
    completed: [] // terminal state
  };

  async transitionTo(_orderId: string, _newStatus: OrderStatus, _context?: Record<string, any>): Promise<Order> {
    // This would typically update the order in the database
    // For now, return a mock order
    throw new Error('transitionTo method should be implemented with actual order updates');
  }

  isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    const validTransitions = OrderStateMachine.VALID_TRANSITIONS[from];
    return validTransitions ? validTransitions.includes(to) : false;
  }

  getValidTransitions(status: OrderStatus): OrderStatus[] {
    return OrderStateMachine.VALID_TRANSITIONS[status] || [];
  }

  validateTransition(transition: StateTransition): void {
    if (!this.isValidTransition(transition.from, transition.to)) {
      throw new Error(`Invalid transition from ${transition.from} to ${transition.to}`);
    }
  }

  isTerminalState(status: OrderStatus): boolean {
    return status === 'completed' || status === 'expired';
  }

  isAwaitingMorePayment(status: OrderStatus): boolean {
    return status === 'pending';
  }

  isPaymentRelated(status: OrderStatus): boolean {
    return ['pending', 'completed'].includes(status);
  }

  isTimeoutRelated(status: OrderStatus): boolean {
    return status === 'expired';
  }

  canRetry(status: OrderStatus): boolean {
    return !this.isTerminalState(status);
  }

  /**
   * Get user-friendly status message for UI display
   */
  getUserFriendlyMessage(order: {
    status: OrderStatus;
    paymentWindowEndsAt?: Date;
    gracePeriodEndsAt?: Date;
  }): string {
    switch (order.status) {
      case 'pending':
        return 'Waiting for payment';
      case 'completed':
        return 'Order completed successfully';
      case 'expired':
        return 'Order expired';
      default:
        return `Status: ${order.status}`;
    }
  }

  getStateDescription(status: OrderStatus): string {
    switch (status) {
      case 'pending':
        return 'Order created, waiting for payment';
      case 'completed':
        return 'Order processing completed';
      case 'expired':
        return 'Order expired without sufficient payment';
      default:
        return `Unknown status: ${status}`;
    }
  }

  getNextPossibleStates(currentStatus: OrderStatus): Array<{
    status: OrderStatus;
    description: string;
    requiresAction: boolean;
  }> {
    const transitions = this.getValidTransitions(currentStatus);
    return transitions.map(status => ({
      status,
      description: this.getStateDescription(status),
      requiresAction: this.requiresExternalAction(status)
    }));
  }

  private requiresExternalAction(status: OrderStatus): boolean {
    return false; // No external actions required in simplified architecture
  }
}

export const defaultOrderStateMachine = new OrderStateMachine();

export function addAmounts(amount1: string, amount2: string): string {
  const a1 = parseFloat(amount1);
  const a2 = parseFloat(amount2);
  return (a1 + a2).toString();
}

export function compareAmounts(amount1: string, amount2: string): number {
  const a1 = parseFloat(amount1);
  const a2 = parseFloat(amount2);
  if (a1 < a2) return -1;
  if (a1 > a2) return 1;
  return 0;
}

export function isAmountSufficient(receivedAmount: string, requiredAmount: string): boolean {
  return parseFloat(receivedAmount) >= parseFloat(requiredAmount);
}