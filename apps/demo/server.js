/**
 * PayIn Demo Shop
 * A merchant demo that showcases:
 * 1. Products + checkout (order flow)
 * 2. Deposit address binding + monitoring
 * 3. Webhook callbacks with signature verification
 * 4. Real-time status updates
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import crypto from 'crypto';

const app = new Hono();

const PORT = parseInt(process.env.PORT || '3001');
const PAYIN_API_URL = process.env.PAYIN_API_URL || 'https://api.sandbox.your-payin.example.com';
const PAYIN_API_KEY = process.env.PAYIN_API_KEY || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'demo-webhook-secret';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// In-memory store
const orders = new Map();
const deposits = new Map();
const webhookLogs = [];

// Helper: call PayIn API
async function payinAPI(method, path, body) {
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${PAYIN_API_KEY}`, 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${PAYIN_API_URL}${path}`, opts);
  return resp.json();
}

// ============================================================
// Products
// ============================================================
const PRODUCTS = [
  { id: 'coffee', name: '☕ Premium Coffee', price: '5.00', image: '☕' },
  { id: 'nft-pass', name: '🎫 NFT Access Pass', price: '25.00', image: '🎫' },
  { id: 'api-credits', name: '⚡ API Credits (1000)', price: '10.00', image: '⚡' },
  { id: 'donation', name: '❤️ Donation', price: '1.00', image: '❤️' },
];

// ============================================================
// HTML Templates
// ============================================================
function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | PayIn Demo Shop</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width: 960px; margin: 0 auto; padding: 20px; }
    header { background: #1a1a2e; color: white; padding: 20px 0; margin-bottom: 30px; }
    header .container { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    header h1 { font-size: 1.5em; }
    header nav a { color: #8be9fd; text-decoration: none; margin-left: 20px; font-size: 0.9em; }
    header nav a:hover { text-decoration: underline; }
    .badge { background: #50fa7b; color: #1a1a2e; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: bold; }
    .card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 24px; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
    .product { text-align: center; transition: transform 0.2s; cursor: pointer; }
    .product:hover { transform: translateY(-4px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    .product .emoji { font-size: 3em; margin: 10px 0; }
    .product .name { font-weight: 600; margin: 8px 0 4px; }
    .product .price { color: #666; font-size: 1.1em; }
    .btn { display: inline-block; padding: 10px 24px; border: none; border-radius: 8px; font-size: 1em; cursor: pointer; text-decoration: none; font-weight: 600; transition: background 0.2s; }
    .btn-primary { background: #6c5ce7; color: white; }
    .btn-primary:hover { background: #5a4bd1; }
    .btn-success { background: #00b894; color: white; }
    .btn-success:hover { background: #00a381; }
    .btn-sm { padding: 6px 16px; font-size: 0.85em; }
    .btn-danger { background: #e17055; color: white; }
    select, input { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 1em; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.9em; color: #555; }
    .form-group .hint { font-size: 0.8em; color: #999; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { font-weight: 600; color: #666; font-size: 0.85em; text-transform: uppercase; }
    .status { padding: 3px 10px; border-radius: 12px; font-size: 0.8em; font-weight: 600; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-active { background: #cce5ff; color: #004085; }
    .status-completed { background: #d4edda; color: #155724; }
    .status-expired { background: #f8d7da; color: #721c24; }
    .log-entry { font-family: monospace; font-size: 0.85em; padding: 8px; border-left: 3px solid #6c5ce7; margin-bottom: 8px; background: #f8f9fa; }
    .log-entry .time { color: #999; }
    .empty { text-align: center; padding: 40px; color: #999; }
    .addr { font-family: monospace; font-size: 0.85em; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; word-break: break-all; }
    .info-box { background: #e8f4fd; border-left: 4px solid #2196f3; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 0.9em; }
    .monitor-tag { display: inline-block; background: #e8e8e8; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; margin: 2px; }
    .section-tabs { display: flex; gap: 10px; margin-bottom: 20px; }
    .section-tabs a { padding: 8px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; color: #555; background: #e8e8e8; }
    .section-tabs a.active { background: #6c5ce7; color: white; }
    footer { text-align: center; padding: 30px; color: #999; font-size: 0.85em; }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>🏪 PayIn Demo Shop <span class="badge">SANDBOX</span></h1>
      <nav>
        <a href="/">Products</a>
        <a href="/deposits">Deposits</a>
        <a href="/orders">Orders</a>
        <a href="/webhooks">Webhooks</a>
        <a href="/health">Health</a>
      </nav>
    </div>
  </header>
  <div class="container">${body}</div>
  <footer>PayIn Demo Shop — Powered by <a href="https://your-payin.example.com" style="color:#6c5ce7">PayIn</a> Stablecoin Payment Gateway</footer>
</body>
</html>`;
}

// ============================================================
// HOME — Products
// ============================================================
app.get('/', (c) => {
  const productsHtml = PRODUCTS.map(p => `
    <div class="card product" onclick="location.href='/checkout/${p.id}'">
      <div class="emoji">${p.image}</div>
      <div class="name">${p.name}</div>
      <div class="price">\$${p.price} USDC</div>
      <br>
      <span class="btn btn-primary btn-sm">Buy Now</span>
    </div>
  `).join('');

  return c.html(layout('Shop', `
    <div class="section-tabs">
      <a href="/" class="active">🛍️ Order (Pay)</a>
      <a href="/deposits">💰 Deposit (Top-up)</a>
    </div>
    <h2 style="margin-bottom:20px">🛍️ Products</h2>
    <div class="grid">${productsHtml}</div>
  `));
});

// ============================================================
// ORDER FLOW
// ============================================================
app.get('/checkout/:productId', (c) => {
  const product = PRODUCTS.find(p => p.id === c.req.param('productId'));
  if (!product) return c.html(layout('Not Found', '<p>Product not found</p>'), 404);

  return c.html(layout(`Buy ${product.name}`, `
    <div class="card" style="max-width:500px;margin:0 auto">
      <h2 style="margin-bottom:20px">${product.image} ${product.name}</h2>
      <p style="margin-bottom:20px;font-size:1.3em">Price: <strong>\$${product.price}</strong></p>
      <form method="POST" action="/checkout/${product.id}">
        <div class="form-group">
          <label>Blockchain</label>
          <select name="chainId" style="width:100%">
            <option value="ethereum-sepolia">Ethereum Sepolia</option>
            <option value="polygon-amoy">Polygon Amoy</option>
            <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
            <option value="tron-nile">TRON Nile</option>
            <option value="solana-devnet">Solana Devnet</option>
          </select>
        </div>
        <div class="form-group">
          <label>Currency</label>
          <select name="currency" style="width:100%">
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="PYUSD">PYUSD</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:10px">
          Pay with Crypto →
        </button>
      </form>
    </div>
  `));
});

app.post('/checkout/:productId', async (c) => {
  const product = PRODUCTS.find(p => p.id === c.req.param('productId'));
  if (!product) return c.redirect('/');

  const body = await c.req.parseBody();
  const chainId = body.chainId;
  const currency = body.currency;
  const orderRef = `demo-${product.id}-${Date.now()}`;

  try {
    const data = await payinAPI('POST', '/api/v1/orders', {
      orderReference: orderRef,
      amount: product.price,
      currency,
      chainId,
      successUrl: `${BASE_URL}/order-success?ref=${orderRef}`,
      cancelUrl: `${BASE_URL}/order-cancel?ref=${orderRef}`
    });

    if (!data.success) {
      return c.html(layout('Error', `
        <div class="card">
          <h2>❌ Order Creation Failed</h2>
          <p style="margin-top:10px">${data.message || data.error || 'Unknown error'}</p>
          <a href="/" class="btn btn-primary" style="margin-top:20px">← Back to Shop</a>
        </div>
      `));
    }

    const order = data.data;
    orders.set(orderRef, {
      ref: orderRef,
      type: 'order',
      product: product.name,
      amount: product.price,
      currency,
      chainId,
      payinOrderId: order.orderId,
      paymentAddress: order.paymentAddress,
      paymentUrl: order.url,
      status: 'pending',
      createdAt: new Date().toISOString(),
      webhookEvents: []
    });

    return c.redirect(order.url);
  } catch (err) {
    return c.html(layout('Error', `
      <div class="card">
        <h2>❌ Error</h2>
        <p style="margin-top:10px">${err.message}</p>
        <a href="/" class="btn btn-primary" style="margin-top:20px">← Back</a>
      </div>
    `));
  }
});

app.get('/order-success', (c) => {
  const ref = c.req.query('ref');
  const order = orders.get(ref);
  return c.html(layout('Payment Successful', `
    <div class="card" style="text-align:center;max-width:500px;margin:0 auto">
      <h2 style="color:#155724">✅ Payment Successful!</h2>
      <p style="margin:15px 0">Thank you for your purchase.</p>
      ${order ? `<p>Order: <code>${ref}</code></p><p>Product: ${order.product}</p>` : ''}
      <a href="/" class="btn btn-primary" style="margin-top:20px">← Continue Shopping</a>
    </div>
  `));
});

app.get('/order-cancel', (c) => {
  return c.html(layout('Order Expired', `
    <div class="card" style="text-align:center;max-width:500px;margin:0 auto">
      <h2 style="color:#856404">⏰ Order Expired</h2>
      <p style="margin:15px 0">The payment window has expired.</p>
      <a href="/" class="btn btn-primary" style="margin-top:20px">← Try Again</a>
    </div>
  `));
});

// ============================================================
// DEPOSIT FLOW
// ============================================================

// Deposit landing page
app.get('/deposits', (c) => {
  const allDeposits = Array.from(deposits.values()).reverse();

  const depositsTable = allDeposits.length === 0 ? `
    <div class="card empty">
      <p>No deposit addresses bound yet.</p>
    </div>
  ` : `
    <div class="card" style="overflow-x:auto">
      <table>
        <thead><tr><th>Reference</th><th>Protocol</th><th>Address</th><th>Monitoring</th><th>Status</th><th>Transfers</th><th>Created</th></tr></thead>
        <tbody>${allDeposits.map(d => `
          <tr>
            <td><code style="font-size:0.8em">${d.ref}</code></td>
            <td><strong>${d.protocol.toUpperCase()}</strong></td>
            <td><span class="addr">${d.address.substring(0, 12)}...${d.address.substring(d.address.length - 6)}</span></td>
            <td>${(d.monitoringTargets || []).map(t => `<span class="monitor-tag">${t.chain}/${t.token}</span>`).join(' ')}</td>
            <td><span class="status status-${d.status}">${d.status}</span></td>
            <td>${d.transfers.length}</td>
            <td style="font-size:0.8em">${new Date(d.createdAt).toLocaleString()}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;

  return c.html(layout('Deposits', `
    <div class="section-tabs">
      <a href="/">🛍️ Order (Pay)</a>
      <a href="/deposits" class="active">💰 Deposit (Top-up)</a>
    </div>
    <h2 style="margin-bottom:20px">💰 Deposit Addresses</h2>
    
    <div class="info-box">
      <strong>How deposits work:</strong> Bind a deposit address for a protocol (EVM or TRON). 
      Any supported stablecoin sent to that address on any monitored chain will be automatically detected. 
      One EVM address monitors multiple chains and tokens simultaneously.
    </div>

    <div class="card" style="max-width:500px">
      <h3 style="margin-bottom:15px">Bind New Deposit Address</h3>
      <form method="POST" action="/deposits/bind">
        <div class="form-group">
          <label>Deposit Reference</label>
          <input type="text" name="depositReference" placeholder="e.g. user-123-topup" style="width:100%" required />
          <div class="hint">Unique identifier for this deposit (e.g. user ID, account reference)</div>
        </div>
        <div class="form-group">
          <label>Protocol</label>
          <select name="protocol" style="width:100%">
            <option value="evm">EVM (Ethereum, Polygon, Arbitrum)</option>
            <option value="tron">TRON</option>
          </select>
          <div class="hint">EVM: monitors USDC/USDT/PYUSD on Ethereum + Polygon | TRON: monitors USDT on TRON Nile</div>
        </div>
        <button type="submit" class="btn btn-success" style="width:100%;margin-top:10px">
          🔗 Bind Deposit Address
        </button>
      </form>
    </div>

    <h3 style="margin:20px 0 10px">Bound Addresses (${allDeposits.length})</h3>
    ${depositsTable}
  `));
});

// Process deposit bind
app.post('/deposits/bind', async (c) => {
  const body = await c.req.parseBody();
  const depositReference = body.depositReference?.toString().trim();
  const protocol = body.protocol;

  if (!depositReference || !protocol) {
    return c.html(layout('Error', `
      <div class="card">
        <h2>❌ Missing Fields</h2>
        <p style="margin-top:10px">Both depositReference and protocol are required.</p>
        <a href="/deposits" class="btn btn-primary" style="margin-top:20px">← Back</a>
      </div>
    `));
  }

  try {
    const data = await payinAPI('POST', '/api/v1/deposits/bind', {
      depositReference,
      protocol
    });

    if (!data.success) {
      return c.html(layout('Error', `
        <div class="card">
          <h2>❌ Deposit Bind Failed</h2>
          <p style="margin-top:10px">${data.message || data.error || 'Unknown error'}</p>
          <a href="/deposits" class="btn btn-primary" style="margin-top:20px">← Back</a>
        </div>
      `));
    }

    const dep = data.data;
    deposits.set(depositReference, {
      ref: depositReference,
      protocol,
      address: dep.depositAddress,
      monitoringTargets: dep.monitoringTargets || [],
      paymentUrl: dep.url,
      status: 'active',
      transfers: [],
      totalReceived: '0',
      createdAt: dep.bindingCreatedAt || new Date().toISOString(),
      webhookEvents: []
    });

    // Show success with deposit details
    const targetsHtml = (dep.monitoringTargets || []).map(t => `
      <tr>
        <td>${t.chain}</td>
        <td><strong>${t.token}</strong></td>
        <td><code style="font-size:0.8em">${t.contract}</code></td>
      </tr>
    `).join('');

    return c.html(layout('Deposit Bound', `
      <div class="card" style="max-width:600px;margin:0 auto">
        <h2 style="color:#155724;margin-bottom:15px">✅ Deposit Address Bound!</h2>
        <div class="form-group">
          <label>Reference</label>
          <code>${depositReference}</code>
        </div>
        <div class="form-group">
          <label>Protocol</label>
          <strong>${protocol.toUpperCase()}</strong>
        </div>
        <div class="form-group">
          <label>Deposit Address</label>
          <span class="addr" style="font-size:1em">${dep.depositAddress}</span>
        </div>
        <div class="form-group">
          <label>Payment Page</label>
          <a href="${dep.url}" target="_blank">${dep.url}</a>
        </div>
        <div class="form-group">
          <label>Monitored Chains & Tokens</label>
          <table style="margin-top:8px">
            <thead><tr><th>Chain</th><th>Token</th><th>Contract</th></tr></thead>
            <tbody>${targetsHtml}</tbody>
          </table>
        </div>
        <div class="info-box" style="margin-top:15px">
          Send any of the above tokens to <strong>${dep.depositAddress}</strong> on the corresponding chain. 
          The system will automatically detect and record the transfer.
        </div>
        <a href="/deposits" class="btn btn-primary" style="margin-top:15px">← View All Deposits</a>
        <a href="${dep.url}" target="_blank" class="btn btn-success btn-sm" style="margin-left:10px">Open Payment Page</a>
      </div>
    `));
  } catch (err) {
    return c.html(layout('Error', `
      <div class="card">
        <h2>❌ Error</h2>
        <p style="margin-top:10px">${err.message}</p>
        <a href="/deposits" class="btn btn-primary" style="margin-top:20px">← Back</a>
      </div>
    `));
  }
});

// Deposit detail page
app.get('/deposits/:ref', (c) => {
  const ref = c.req.param('ref');
  const dep = deposits.get(ref);
  
  if (!dep) {
    return c.html(layout('Not Found', `
      <div class="card"><p>Deposit reference not found.</p><a href="/deposits" class="btn btn-primary" style="margin-top:10px">← Back</a></div>
    `), 404);
  }

  const transfersHtml = dep.transfers.length === 0 ? '<p style="color:#999">No transfers detected yet.</p>' : `
    <table>
      <thead><tr><th>Amount</th><th>Token</th><th>Chain</th><th>TX Hash</th><th>Status</th><th>Time</th></tr></thead>
      <tbody>${dep.transfers.map(t => `
        <tr>
          <td><strong>${t.amount}</strong></td>
          <td>${t.token || '?'}</td>
          <td>${t.chain || '?'}</td>
          <td><code style="font-size:0.75em">${(t.txHash || '?').substring(0, 16)}...</code></td>
          <td><span class="status status-${t.status || 'pending'}">${t.status || '?'}</span></td>
          <td style="font-size:0.8em">${t.time || '?'}</td>
        </tr>
      `).join('')}</tbody>
    </table>
  `;

  return c.html(layout(`Deposit ${ref}`, `
    <div class="card" style="max-width:700px;margin:0 auto">
      <h2 style="margin-bottom:15px">💰 Deposit: ${ref}</h2>
      <p><strong>Protocol:</strong> ${dep.protocol.toUpperCase()}</p>
      <p><strong>Address:</strong> <span class="addr">${dep.address}</span></p>
      <p><strong>Status:</strong> <span class="status status-${dep.status}">${dep.status}</span></p>
      <p><strong>Monitoring:</strong> ${(dep.monitoringTargets || []).map(t => `<span class="monitor-tag">${t.chain}/${t.token}</span>`).join(' ')}</p>
      
      <h3 style="margin:20px 0 10px">Transfers (${dep.transfers.length})</h3>
      ${transfersHtml}
      
      <h3 style="margin:20px 0 10px">Webhook Events (${dep.webhookEvents.length})</h3>
      ${dep.webhookEvents.length === 0 ? '<p style="color:#999">No webhook events yet.</p>' : 
        dep.webhookEvents.map(e => `
          <div class="log-entry">
            <span class="time">${e.time}</span> | <strong>${e.eventType}</strong> | ${e.verified ? '✅' : '❌'}
          </div>
        `).join('')}
      
      <a href="/deposits" class="btn btn-primary" style="margin-top:20px">← All Deposits</a>
    </div>
  `));
});

// Unbind deposit
app.post('/deposits/:ref/unbind', async (c) => {
  const ref = c.req.param('ref');
  try {
    const data = await payinAPI('POST', '/api/v1/deposits/unbind', { depositReference: ref });
    if (data.success) {
      const dep = deposits.get(ref);
      if (dep) dep.status = 'unbound';
    }
    return c.redirect('/deposits');
  } catch (err) {
    return c.redirect('/deposits');
  }
});

// ============================================================
// ORDERS LIST
// ============================================================
app.get('/orders', (c) => {
  const allOrders = Array.from(orders.values()).reverse();
  
  if (allOrders.length === 0) {
    return c.html(layout('Orders', `
      <h2 style="margin-bottom:20px">📋 Orders</h2>
      <div class="card empty">
        <p>No orders yet. <a href="/">Buy something!</a></p>
      </div>
    `));
  }

  const rows = allOrders.map(o => `
    <tr>
      <td><code style="font-size:0.8em">${o.ref}</code></td>
      <td>${o.product}</td>
      <td>\$${o.amount} ${o.currency}</td>
      <td>${o.chainId}</td>
      <td><span class="status status-${o.status}">${o.status}</span></td>
      <td>${o.webhookEvents.length}</td>
      <td><a href="${o.paymentUrl}" target="_blank" class="btn btn-sm btn-primary">Pay</a></td>
    </tr>
  `).join('');

  return c.html(layout('Orders', `
    <h2 style="margin-bottom:20px">📋 Orders (${allOrders.length})</h2>
    <div class="card" style="overflow-x:auto">
      <table>
        <thead><tr><th>Reference</th><th>Product</th><th>Amount</th><th>Chain</th><th>Status</th><th>Webhooks</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `));
});

// ============================================================
// WEBHOOK RECEIVER
// ============================================================
app.post('/webhook', async (c) => {
  const body = await c.req.text();
  const signature = c.req.header('X-Payin-Signature') || '';
  const eventType = c.req.header('X-Payin-Event-Type') || '';
  const deliveryId = c.req.header('X-Payin-Delivery-Id') || '';

  // Verify signature
  let verified = false;
  if (signature && WEBHOOK_SECRET) {
    const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')));
    const timestamp = parts.t;
    const v1 = parts.v1;
    if (timestamp && v1) {
      const payload = `${timestamp}.${body}`;
      const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
      verified = expected === v1;
    }
  }

  let parsed;
  try { parsed = JSON.parse(body); } catch { parsed = body; }

  const logEntry = {
    time: new Date().toISOString(),
    eventType,
    deliveryId,
    verified,
    body: parsed
  };
  webhookLogs.unshift(logEntry);
  if (webhookLogs.length > 200) webhookLogs.pop();

  // Update order status from webhook
  if (parsed?.data) {
    const d = parsed.data;

    // Order events
    if (d.order_reference) {
      const order = orders.get(d.order_reference);
      if (order) {
        if (eventType === 'order.completed') order.status = 'completed';
        if (eventType === 'order.expired') order.status = 'expired';
        order.webhookEvents.push(logEntry);
      }
    }

    // Deposit events — match by depositReference or deposit_reference
    const depRef = d.depositReference || d.deposit_reference;
    if (depRef) {
      const dep = deposits.get(depRef);
      if (dep) {
        // deposit.completed means a transfer is confirmed, NOT that the address is done
        // The address stays active and can receive more transfers
        // Record transfer from deposit webhook
        if (d.amount) {
          dep.transfers.push({
            amount: d.amount || '?',
            token: d.token || d.currency || '?',
            chain: d.chain || d.chain_id || '?',
            txHash: d.txHash || d.tx_hash || d.transaction_hash || '?',
            status: eventType.split('.')[1] || 'detected',
            time: d.timestamp || new Date().toISOString()
          });
        }
        dep.webhookEvents.push(logEntry);
      }
    }

    // Transfer events — match by address (depositAddress, address, or payment_address)
    const addr = (d.depositAddress || d.address || d.payment_address || '').toLowerCase();
    if (addr) {
      // Try to match to a deposit (only if not already matched by ref above)
      if (!depRef) {
        for (const dep of deposits.values()) {
          if (dep.address.toLowerCase() === addr) {
            dep.transfers.push({
              amount: d.amount || d.received_amount || '?',
              token: d.token || d.currency || '?',
              chain: d.chain || d.chain_id || '?',
              txHash: d.txHash || d.tx_hash || d.transaction_hash || '?',
              status: d.status || 'detected',
              time: d.timestamp || new Date().toISOString()
            });
            dep.webhookEvents.push(logEntry);
            break;
          }
        }
      }
      // Try to match to an order
      for (const order of orders.values()) {
        if (order.paymentAddress?.toLowerCase() === addr) {
          order.webhookEvents.push(logEntry);
          break;
        }
      }
    }
  }

  console.log(`[WEBHOOK] ${eventType} | verified=${verified} | ${deliveryId}`);
  return c.json({ received: true });
});

// Webhook logs page
app.get('/webhooks', (c) => {
  if (webhookLogs.length === 0) {
    return c.html(layout('Webhooks', `
      <h2 style="margin-bottom:20px">🔔 Webhook Log</h2>
      <div class="card empty">
        <p>No webhook callbacks received yet.</p>
        <p style="margin-top:10px;font-size:0.9em">Webhook URL: <code>${BASE_URL}/webhook</code></p>
      </div>
    `));
  }

  const entries = webhookLogs.slice(0, 50).map(l => `
    <div class="log-entry">
      <span class="time">${l.time}</span> |
      <strong>${l.eventType}</strong> |
      ${l.verified ? '✅ verified' : '❌ unverified'} |
      <code>${l.deliveryId}</code>
      <pre style="margin-top:6px;white-space:pre-wrap;font-size:0.8em">${JSON.stringify(l.body, null, 2).substring(0, 500)}</pre>
    </div>
  `).join('');

  return c.html(layout('Webhooks', `
    <h2 style="margin-bottom:20px">🔔 Webhook Log (${webhookLogs.length})</h2>
    <p style="margin-bottom:15px;font-size:0.9em">Endpoint: <code>${BASE_URL}/webhook</code></p>
    <div class="card">${entries}</div>
  `));
});

// ============================================================
// HEALTH
// ============================================================
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'payin-demo-shop',
    timestamp: new Date().toISOString(),
    config: {
      payinApi: PAYIN_API_URL,
      webhookEndpoint: `${BASE_URL}/webhook`,
      hasApiKey: !!PAYIN_API_KEY,
      ordersCount: orders.size,
      depositsCount: deposits.size,
      webhookLogsCount: webhookLogs.length
    }
  });
});

// ============================================================
// START
// ============================================================
console.log(`🏪 PayIn Demo Shop starting on port ${PORT}`);
console.log(`   PayIn API: ${PAYIN_API_URL}`);
console.log(`   Webhook: ${BASE_URL}/webhook`);
console.log(`   API Key: ${PAYIN_API_KEY ? 'configured' : '⚠️  NOT SET'}`);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`🚀 Demo Shop running at http://localhost:${info.port}`);
});
