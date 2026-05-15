/**
 * Signature Utilities Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSignature,
  parseSignature,
  verifySignature,
  generateEventId,
  generateDeliveryId,
} from '../src/utils/signature';

describe('Signature Utils', () => {
  const testPayload = {
    id: 'evt_test_123',
    type: 'order.completed',
    data: { order_id: 'ord_123', amount: '100.00' },
  };
  const testSecret = 'test_secret_key_12345';

  describe('generateSignature', () => {
    it('should generate valid signature format', () => {
      const signature = generateSignature(testPayload, testSecret);

      // Should match format: t=timestamp,v1=hex_signature
      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    });

    it('should generate consistent signature for same payload and timestamp', () => {
      const timestamp = 1702387200;
      const sig1 = generateSignature(testPayload, testSecret, timestamp);
      const sig2 = generateSignature(testPayload, testSecret, timestamp);

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const timestamp = 1702387200;
      const payload1 = { id: 'evt_1', data: 'test1' };
      const payload2 = { id: 'evt_2', data: 'test2' };

      const sig1 = generateSignature(payload1, testSecret, timestamp);
      const sig2 = generateSignature(payload2, testSecret, timestamp);

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const timestamp = 1702387200;
      const sig1 = generateSignature(testPayload, 'secret1', timestamp);
      const sig2 = generateSignature(testPayload, 'secret2', timestamp);

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different timestamps', () => {
      const sig1 = generateSignature(testPayload, testSecret, 1000);
      const sig2 = generateSignature(testPayload, testSecret, 2000);

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('parseSignature', () => {
    it('should parse valid signature', () => {
      const signatureHeader = 't=1702387200,v1=abc123def456';
      const { timestamp, signature } = parseSignature(signatureHeader);

      expect(timestamp).toBe(1702387200);
      expect(signature).toBe('abc123def456');
    });

    it('should throw on invalid format (missing timestamp)', () => {
      const signatureHeader = 'v1=abc123def456';
      expect(() => parseSignature(signatureHeader)).toThrow('Invalid signature format');
    });

    it('should throw on invalid format (missing signature)', () => {
      const signatureHeader = 't=1702387200';
      expect(() => parseSignature(signatureHeader)).toThrow('Invalid signature format');
    });

    it('should throw on invalid timestamp', () => {
      const signatureHeader = 't=invalid,v1=abc123';
      expect(() => parseSignature(signatureHeader)).toThrow('Invalid timestamp');
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const signature = generateSignature(testPayload, testSecret);
      expect(() => verifySignature(testPayload, signature, testSecret)).not.toThrow();
      expect(verifySignature(testPayload, signature, testSecret)).toBe(true);
    });

    it('should reject signature with wrong secret', () => {
      const signature = generateSignature(testPayload, testSecret);
      const wrongSecret = 'wrong_secret';

      expect(() => verifySignature(testPayload, signature, wrongSecret)).toThrow('Invalid signature');
    });

    it('should reject signature with modified payload', () => {
      const signature = generateSignature(testPayload, testSecret);
      const modifiedPayload = { ...testPayload, data: { ...testPayload.data, amount: '999.99' } };

      expect(() => verifySignature(modifiedPayload, signature, testSecret)).toThrow('Invalid signature');
    });

    it('should reject expired signature (default 5 min tolerance)', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
      const signature = generateSignature(testPayload, testSecret, oldTimestamp);

      expect(() => verifySignature(testPayload, signature, testSecret)).toThrow('expired');
    });

    it('should accept recent signature within tolerance', () => {
      const recentTimestamp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
      const signature = generateSignature(testPayload, testSecret, recentTimestamp);

      expect(() => verifySignature(testPayload, signature, testSecret)).not.toThrow();
    });

    it('should respect custom tolerance', () => {
      const timestamp = Math.floor(Date.now() / 1000) - 120; // 2 minutes ago
      const signature = generateSignature(testPayload, testSecret, timestamp);

      // Should fail with 1 minute tolerance
      expect(() => verifySignature(testPayload, signature, testSecret, 60)).toThrow('expired');

      // Should succeed with 3 minute tolerance
      expect(() => verifySignature(testPayload, signature, testSecret, 180)).not.toThrow();
    });
  });

  describe('generateEventId', () => {
    it('should generate deterministic event ID', () => {
      const eventType = 'order.completed';
      const businessId = 'ord_abc123';

      const id1 = generateEventId(eventType, businessId);
      const id2 = generateEventId(eventType, businessId);

      expect(id1).toBe(id2);
      expect(id1).toBe('evt_order_completed_ord_abc123');
    });

    it('should handle dots in event type', () => {
      const eventType = 'deposit.address.bound';
      const businessId = 'dep_123';

      const id = generateEventId(eventType, businessId);

      expect(id).toBe('evt_deposit_address_bound_dep_123');
    });

    it('should generate different IDs for different inputs', () => {
      const id1 = generateEventId('order.created', 'ord_1');
      const id2 = generateEventId('order.created', 'ord_2');
      const id3 = generateEventId('order.completed', 'ord_1');

      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);
    });
  });

  describe('generateDeliveryId', () => {
    it('should generate unique delivery IDs', () => {
      const id1 = generateDeliveryId();
      const id2 = generateDeliveryId();

      expect(id1).not.toBe(id2);
    });

    it('should match format dlv_timestamp_random', () => {
      const id = generateDeliveryId();

      expect(id).toMatch(/^dlv_\d+_[a-z0-9]+$/);
    });

    it('should include timestamp component', () => {
      const before = Date.now();
      const id = generateDeliveryId();
      const after = Date.now();

      const timestamp = parseInt(id.split('_')[1]);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });
});
