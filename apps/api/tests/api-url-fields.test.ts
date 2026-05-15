/**
 * API URL Fields Integration Tests
 * Verify that API responses include url fields for payment links, orders, and deposits
 */

import { describe, it, expect } from 'vitest';
import {
  buildPaymentLinkCheckoutUrl,
  buildOrderPaymentUrl,
  buildDepositPageUrl,
} from '../src/utils/url-builder.js';

describe('API URL Fields Integration', () => {
  const baseUrl = 'http://localhost:3000';

  describe('Payment Link URL Format', () => {
    it('should generate correct checkout URL for published payment link', () => {
      const slug = 'coffee-5usd';
      const url = buildPaymentLinkCheckoutUrl(baseUrl, slug);

      expect(url).toBe('http://localhost:3000/checkout/coffee-5usd');
    });

    it('should return proper URL structure with protocol and path', () => {
      const url = buildPaymentLinkCheckoutUrl(baseUrl, 'test-product');

      expect(url).toContain('http://');
      expect(url).toContain('/checkout/');
      expect(url.startsWith('http://localhost:3000/checkout/')).toBe(true);
    });
  });

  describe('Order URL Format', () => {
    it('should generate correct payment URL for order', () => {
      const orderId = '123e4567-e89b-12d3-a456-426614174000';
      const url = buildOrderPaymentUrl(baseUrl, orderId);

      expect(url).toBe('http://localhost:3000/pay/order/123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return proper URL structure with protocol and path', () => {
      const orderId = '550e8400-e29b-41d4-a716-446655440001';
      const url = buildOrderPaymentUrl(baseUrl, orderId);

      expect(url).toContain('http://');
      expect(url).toContain('/pay/order/');
      expect(url.startsWith('http://localhost:3000/pay/order/')).toBe(true);
    });
  });

  describe('Deposit URL Format', () => {
    it('should generate correct deposit page URL with protocol parameter', () => {
      const depositRef = 'user_12345';
      const url = buildDepositPageUrl(baseUrl, depositRef, 'evm');

      expect(url).toBe('http://localhost:3000/pay/deposit/user_12345?protocol=evm');
    });

    it('should support both EVM and Tron protocols', () => {
      const depositRef = 'user_12345';

      const evmUrl = buildDepositPageUrl(baseUrl, depositRef, 'evm');
      expect(evmUrl).toContain('protocol=evm');

      const tronUrl = buildDepositPageUrl(baseUrl, depositRef, 'tron');
      expect(tronUrl).toContain('protocol=tron');
    });

    it('should return proper URL structure with protocol and query params', () => {
      const url = buildDepositPageUrl(baseUrl, 'test-user', 'evm');

      expect(url).toContain('http://');
      expect(url).toContain('/pay/deposit/');
      expect(url).toContain('?protocol=');
      expect(url.startsWith('http://localhost:3000/pay/deposit/')).toBe(true);
    });
  });
});
