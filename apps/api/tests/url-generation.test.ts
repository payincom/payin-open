/**
 * URL Generation Tests
 * Verify that payment links, orders, and deposits return correct URLs
 */

import { describe, it, expect } from 'vitest';
import {
  buildPaymentLinkCheckoutUrl,
  buildOrderPaymentUrl,
  buildDepositPageUrl,
  getBaseUrl,
} from '../src/utils/url-builder.js';

describe('URL Builder Utilities', () => {
  describe('buildPaymentLinkCheckoutUrl', () => {
    it('should build checkout URL with slug', () => {
      const url = buildPaymentLinkCheckoutUrl('https://api.payin.com', 'coffee-5usd');
      expect(url).toBe('https://api.payin.com/checkout/coffee-5usd');
    });

    it('should handle trailing slash in base URL', () => {
      const url = buildPaymentLinkCheckoutUrl('https://api.payin.com/', 'coffee-5usd');
      expect(url).toBe('https://api.payin.com/checkout/coffee-5usd');
    });

    it('should encode special characters in slug', () => {
      const url = buildPaymentLinkCheckoutUrl('https://api.payin.com', 'test product');
      expect(url).toBe('https://api.payin.com/checkout/test%20product');
    });
  });

  describe('buildOrderPaymentUrl', () => {
    it('should build order payment URL with UUID', () => {
      const orderId = '123e4567-e89b-12d3-a456-426614174000';
      const url = buildOrderPaymentUrl('https://api.payin.com', orderId);
      expect(url).toBe('https://api.payin.com/pay/order/123e4567-e89b-12d3-a456-426614174000');
    });

    it('should handle trailing slash in base URL', () => {
      const orderId = '123e4567-e89b-12d3-a456-426614174000';
      const url = buildOrderPaymentUrl('https://api.payin.com/', orderId);
      expect(url).toBe('https://api.payin.com/pay/order/123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('buildDepositPageUrl', () => {
    it('should build deposit page URL for EVM protocol', () => {
      const url = buildDepositPageUrl('https://api.payin.com', 'user_12345', 'evm');
      expect(url).toBe('https://api.payin.com/pay/deposit/user_12345?protocol=evm');
    });

    it('should build deposit page URL for Tron protocol', () => {
      const url = buildDepositPageUrl('https://api.payin.com', 'user_12345', 'tron');
      expect(url).toBe('https://api.payin.com/pay/deposit/user_12345?protocol=tron');
    });

    it('should encode special characters in deposit reference', () => {
      const url = buildDepositPageUrl('https://api.payin.com', 'user name@123', 'evm');
      expect(url).toBe('https://api.payin.com/pay/deposit/user%20name%40123?protocol=evm');
    });

    it('should handle trailing slash in base URL', () => {
      const url = buildDepositPageUrl('https://api.payin.com/', 'user_12345', 'evm');
      expect(url).toBe('https://api.payin.com/pay/deposit/user_12345?protocol=evm');
    });
  });

  describe('getBaseUrl', () => {
    it('should return BASE_URL from environment if set', () => {
      const originalEnv = process.env.BASE_URL;
      process.env.BASE_URL = 'https://test.payin.com';

      const url = getBaseUrl();
      expect(url).toBe('https://test.payin.com');

      // Restore original value
      if (originalEnv) {
        process.env.BASE_URL = originalEnv;
      } else {
        delete process.env.BASE_URL;
      }
    });

    it('should return localhost fallback if BASE_URL not set', () => {
      const originalEnv = process.env.BASE_URL;
      delete process.env.BASE_URL;

      const url = getBaseUrl();
      expect(url).toBe('http://localhost:3000');

      // Restore original value
      if (originalEnv) {
        process.env.BASE_URL = originalEnv;
      }
    });
  });
});
