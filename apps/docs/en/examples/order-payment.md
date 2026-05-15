# Order Payment Example

::: tip Work in Progress
Complete code examples are coming soon. This page will include full integration examples for e-commerce order payments.
:::

## Quick Example

Here's a basic example of creating an order payment:

```typescript
// Create a payment order
const response = await fetch('http://localhost:3000/api/v1/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    orderReference: 'ORDER-2025-001',
    amount: '100.00',
    currency: 'USDT',
    chainId: 'ethereum-sepolia',
    successUrl: 'https://yoursite.com/payment/success',
    cancelUrl: 'https://yoursite.com/payment/cancel'
  })
});

const order = await response.json();
console.log('Payment address:', order.data.paymentAddress);
```

## What's Coming

This example page will include:

- Complete Node.js integration example
- Frontend payment page implementation
- Webhook handling
- Error handling
- Testing with testnets
- Production deployment guide

Stay tuned for the full documentation!
