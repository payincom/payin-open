/**
 * Webhook Signature Utilities
 * Implements HMAC-SHA256 signature generation and verification
 * Following Stripe's webhook signature scheme
 */

import { createHmac, timingSafeEqual } from 'crypto';

export interface SignatureComponents {
  timestamp: number;
  signature: string;
}

/**
 * Generate webhook signature
 *
 * Signature algorithm: HMAC-SHA256(secret, timestamp + '.' + payload)
 *
 * @param payload - JSON payload to sign
 * @param secret - Webhook secret
 * @param timestamp - Unix timestamp (optional, defaults to now)
 * @returns Signature string in format: t=timestamp,v1=signature
 *
 * @example
 * ```typescript
 * const payload = { id: 'evt_123', type: 'order.completed', data: {...} };
 * const signature = generateSignature(payload, 'whsec_abc123');
 * // Returns: "t=1702387200,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd"
 * ```
 */
export function generateSignature(
  payload: Record<string, any>,
  secret: string,
  timestamp?: number
): string {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);
  const signedPayload = `${ts}.${payloadString}`;

  const signature = createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  return `t=${ts},v1=${signature}`;
}

/**
 * Parse signature string into components
 *
 * @param signatureHeader - Signature header string
 * @returns Parsed signature components
 * @throws Error if signature format is invalid
 *
 * @example
 * ```typescript
 * const { timestamp, signature } = parseSignature('t=1702387200,v1=abc123...');
 * ```
 */
export function parseSignature(signatureHeader: string): SignatureComponents {
  const parts = signatureHeader.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signaturePart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    throw new Error('Invalid signature format');
  }

  const timestamp = parseInt(timestampPart.split('=')[1]);
  const signature = signaturePart.split('=')[1];

  if (isNaN(timestamp)) {
    throw new Error('Invalid timestamp in signature');
  }

  return { timestamp, signature };
}

/**
 * Verify webhook signature
 *
 * Performs timing-safe comparison to prevent timing attacks
 *
 * @param payload - JSON payload to verify
 * @param signatureHeader - Signature header from request
 * @param secret - Webhook secret
 * @param toleranceSeconds - Time tolerance in seconds (default: 300 = 5 minutes)
 * @returns true if signature is valid
 * @throws Error if signature is invalid or expired
 *
 * @example
 * ```typescript
 * try {
 *   verifySignature(req.body, req.headers['x-payin-signature'], secret);
 *   console.log('Signature verified!');
 * } catch (error) {
 *   console.error('Invalid signature:', error.message);
 * }
 * ```
 */
export function verifySignature(
  payload: Record<string, any>,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300
): boolean {
  const { timestamp, signature } = parseSignature(signatureHeader);

  // Check timestamp tolerance (防止重放攻击)
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > toleranceSeconds) {
    throw new Error(`Signature timestamp expired (tolerance: ${toleranceSeconds}s)`);
  }

  // Compute expected signature
  const payloadString = JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;
  const expectedSignature = createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const actualBuffer = Buffer.from(signature, 'hex');

  if (expectedBuffer.length !== actualBuffer.length) {
    throw new Error('Invalid signature');
  }

  if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error('Invalid signature');
  }

  return true;
}

/**
 * Generate deterministic event ID for idempotency
 *
 * Format: evt_{eventType}_{businessId}
 *
 * @param eventType - Event type (e.g., 'order.completed')
 * @param businessId - Business ID (e.g., order_id, deposit_reference)
 * @returns Deterministic event ID
 *
 * @example
 * ```typescript
 * const eventId = generateEventId('order.completed', 'ord_abc123');
 * // Returns: "evt_order_completed_ord_abc123"
 * ```
 */
export function generateEventId(eventType: string, businessId: string): string {
  const sanitizedType = eventType.replace(/\./g, '_');
  return `evt_${sanitizedType}_${businessId}`;
}

/**
 * Generate unique delivery ID
 *
 * Format: dlv_{timestamp}_{random}
 *
 * @returns Unique delivery ID
 *
 * @example
 * ```typescript
 * const deliveryId = generateDeliveryId();
 * // Returns: "dlv_1702387200_a1b2c3d4e5"
 * ```
 */
export function generateDeliveryId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 10);
  return `dlv_${timestamp}_${random}`;
}
