/**
 * Event Mapper Tests
 */

import { describe, it, expect } from 'vitest';
import { mapOrderStatusEvent, mapDepositEvent, mapTransferEvent } from '../src/utils/event-mapper';
import { EVENT_TYPES } from '../src/types/events';

describe('Event Mapper', () => {
  describe('mapOrderStatusEvent', () => {
    it('should map order created event (pending status with no old status)', () => {
      const processorEvent = {
        orderId: 'ord_123',
        oldStatus: null,
        newStatus: 'pending',
        timestamp: new Date(),
        orderReference: 'ORDER_2024_001',
        amount: '100.00',
        currency: 'USDT',
        chainId: 'ethereum-sepolia',
        paymentAddress: '0xabc123...',
        expiresAt: new Date('2024-12-31'),
      };

      const notification = mapOrderStatusEvent(processorEvent);

      expect(notification).toBeDefined();
      expect(notification!.type).toBe(EVENT_TYPES.ORDER_CREATED);
      expect(notification!.id).toBe('evt_order_created_ord_123');
      expect(notification!.data.order_id).toBe('ord_123');
      expect(notification!.data.order_reference).toBe('ORDER_2024_001');
      expect(notification!.data.amount).toBe('100.00');
      expect(notification!.data.currency).toBe('USDT');
      expect(notification!.data.expires_at).toBeDefined();
    });

    it('should map order completed event', () => {
      const processorEvent = {
        orderId: 'ord_123',
        oldStatus: 'pending',
        newStatus: 'completed',
        timestamp: new Date(),
        orderReference: 'ORDER_2024_001',
        amount: '100.00',
        currency: 'USDT',
        chainId: 'ethereum-sepolia',
        paymentAddress: '0xabc123...',
        completedAt: new Date('2024-12-31'),
      };

      const notification = mapOrderStatusEvent(processorEvent);

      expect(notification).toBeDefined();
      expect(notification!.type).toBe(EVENT_TYPES.ORDER_COMPLETED);
      expect(notification!.id).toBe('evt_order_completed_ord_123');
      expect(notification!.data.completed_at).toBeDefined();
    });

    it('should map order expired event', () => {
      const processorEvent = {
        orderId: 'ord_123',
        oldStatus: 'pending',
        newStatus: 'expired',
        timestamp: new Date(),
        orderReference: 'ORDER_2024_001',
        amount: '100.00',
        currency: 'USDT',
        chainId: 'ethereum-sepolia',
      };

      const notification = mapOrderStatusEvent(processorEvent);

      expect(notification).toBeDefined();
      expect(notification!.type).toBe(EVENT_TYPES.ORDER_EXPIRED);
      expect(notification!.id).toBe('evt_order_expired_ord_123');
      expect(notification!.data.expired_at).toBeDefined();
      expect(notification!.data.reason).toBe('timeout');
    });

    it('should return null for ignored status transitions', () => {
      const processorEvent = {
        orderId: 'ord_123',
        oldStatus: 'completed',
        newStatus: 'pending', // Invalid transition
        timestamp: new Date(),
      };

      const notification = mapOrderStatusEvent(processorEvent);

      expect(notification).toBeNull();
    });

    it('should generate deterministic event IDs for same order', () => {
      const event1 = mapOrderStatusEvent({
        orderId: 'ord_123',
        oldStatus: null,
        newStatus: 'pending',
        timestamp: new Date(),
      });

      const event2 = mapOrderStatusEvent({
        orderId: 'ord_123',
        oldStatus: null,
        newStatus: 'pending',
        timestamp: new Date(),
      });

      expect(event1!.id).toBe(event2!.id);
    });
  });

  describe('mapDepositEvent', () => {
    it('should map deposit address bound event', () => {
      const processorEvent = {
        depositReference: 'game_player_123',
        protocol: 'evm',
        depositAddress: '0xabc123...',
        monitoringTargets: [
          { chain: 'ethereum-sepolia', contract: '0x...', token: 'USDT' }
        ],
      };

      const notification = mapDepositEvent(processorEvent, 'address_bound');

      expect(notification.type).toBe(EVENT_TYPES.DEPOSIT_ADDRESS_BOUND);
      expect(notification.id).toBe('evt_deposit_address_bound_game_player_123');
      expect(notification.data.depositReference).toBe('game_player_123');
    });

    it('should map deposit completed event using txHash', () => {
      const processorEvent = {
        depositReference: 'game_player_123',
        depositAddress: '0xabc123...',
        amount: '50.00',
        token: 'USDC',
        chain: 'polygon-amoy',
        txHash: '0x123abc...',
      };

      const notification = mapDepositEvent(processorEvent, 'completed');

      expect(notification.type).toBe(EVENT_TYPES.DEPOSIT_COMPLETED);
      // Should use txHash for uniqueness (each deposit is a separate transaction)
      expect(notification.id).toBe('evt_deposit_completed_0x123abc...');
      expect(notification.data.txHash).toBe('0x123abc...');
    });

    it('should allow multiple deposits for same depositReference', () => {
      const depositRef = 'game_player_123';

      // First deposit
      const deposit1 = mapDepositEvent({
        depositReference: depositRef,
        txHash: '0xaaa...',
        amount: '10.00',
      }, 'completed');

      // Second deposit from same user
      const deposit2 = mapDepositEvent({
        depositReference: depositRef,
        txHash: '0xbbb...',
        amount: '20.00',
      }, 'completed');

      // Should have different event IDs (based on txHash)
      expect(deposit1.id).toBe('evt_deposit_completed_0xaaa...');
      expect(deposit2.id).toBe('evt_deposit_completed_0xbbb...');
      expect(deposit1.id).not.toBe(deposit2.id);
    });

    it('should handle deposit_reference field name', () => {
      const processorEvent = {
        deposit_reference: 'user_456',  // Snake case
        protocol: 'tron',
      };

      const notification = mapDepositEvent(processorEvent, 'address_bound');

      expect(notification.id).toBe('evt_deposit_address_bound_user_456');
    });
  });

  describe('mapTransferEvent', () => {
    it('should map transfer detected event with transfer object', () => {
      const processorEvent = {
        transfer: {
          transactionHash: '0xabc123...',
          chain: 'ethereum-sepolia',
          fromAddress: '0x111...',
          toAddress: '0x222...',
          amount: '100.00',
          token: 'USDT',
          blockNumber: 12345,
        },
      };

      const notification = mapTransferEvent(processorEvent, 'detected');

      expect(notification.type).toBe(EVENT_TYPES.TRANSFER_DETECTED);
      expect(notification.id).toBe('evt_transfer_detected_0xabc123...');
      expect(notification.data.transactionHash).toBe('0xabc123...');
    });

    it('should map transfer confirmed event', () => {
      const processorEvent = {
        transfer: {
          transactionHash: '0xabc123...',
          chain: 'polygon-amoy',
        },
        confirmations: 10,
      };

      const notification = mapTransferEvent(processorEvent, 'confirmed');

      expect(notification.type).toBe(EVENT_TYPES.TRANSFER_CONFIRMED);
      expect(notification.id).toBe('evt_transfer_confirmed_0xabc123...');
    });

    it('should handle direct tx_hash field', () => {
      const processorEvent = {
        tx_hash: '0xdef456...',
        chain: 'ethereum-sepolia',
      };

      const notification = mapTransferEvent(processorEvent, 'detected');

      expect(notification.id).toBe('evt_transfer_detected_0xdef456...');
    });
  });

  describe('Event ID consistency', () => {
    it('should generate same ID for same business event', () => {
      const event1 = mapOrderStatusEvent({
        orderId: 'ord_abc',
        oldStatus: null,
        newStatus: 'pending',
        timestamp: new Date(),
      });

      const event2 = mapOrderStatusEvent({
        orderId: 'ord_abc',
        oldStatus: null,
        newStatus: 'pending',
        timestamp: new Date(Date.now() + 1000), // Different time
      });

      // Should have same ID (idempotency)
      expect(event1!.id).toBe(event2!.id);
    });

    it('should generate different IDs for different orders', () => {
      const event1 = mapOrderStatusEvent({
        orderId: 'ord_1',
        oldStatus: null,
        newStatus: 'pending',
        timestamp: new Date(),
      });

      const event2 = mapOrderStatusEvent({
        orderId: 'ord_2',
        oldStatus: null,
        newStatus: 'pending',
        timestamp: new Date(),
      });

      expect(event1!.id).not.toBe(event2!.id);
    });
  });
});
