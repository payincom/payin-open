/**
 * Deposits API Routes
 * Provides deposit address information
 */

import { Hono } from 'hono';
import { getManager } from '../manager-instance.js';
import QRCode from 'qrcode';

const apiDeposits = new Hono();

/**
 * Get deposit address information by address
 * GET /api/deposits/:address
 * Address is globally unique identifier for deposits
 */
apiDeposits.get('/:address', async (c) => {
  try {
    const manager = getManager();
    const address = c.req.param('address');

    // Fetch deposit by address (public endpoint)
    const depositAddress = await manager.getDepositByAddress(address);

    if (!depositAddress) {
      return c.json({
        success: false,
        error: 'Deposit address not found'
      }, 404);
    }

    // Verify address is bound to a deposit
    if (depositAddress.state !== 'bound' || !depositAddress.deposit_reference) {
      return c.json({
        success: false,
        error: 'Address is not bound to any deposit'
      }, 404);
    }

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(depositAddress.address, {
      width: 280,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    return c.json({
      success: true,
      deposit: {
        address: depositAddress.address,
        protocol: depositAddress.protocol,
        depositReference: depositAddress.deposit_reference,
        metadata: depositAddress.metadata || {}
      },
      qrCodeDataUrl
    });
  } catch (error) {
    console.error(`Failed to fetch deposit address for ${c.req.param('address')}:`, error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default apiDeposits;
