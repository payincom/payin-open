# Payment Links

Payment Links allow you to accept cryptocurrency payments without writing any code. Create a shareable link, send it to your customers, and get paid - it's that simple.

## What are Payment Links?

Payment Links are no-code payment URLs that you create through the PayIn Admin dashboard. Share the link via email, messaging apps, or social media, and customers can pay instantly with cryptocurrency.

**Key Characteristics:**
- 🚫 **No code required** - Create links through Admin UI
- 🔗 **Share anywhere** - Email, WhatsApp, social media, QR code
- 💰 **Flexible pricing** - Fixed amount or custom amount
- 🌐 **Multi-chain** - Support multiple networks and tokens
- 📊 **Track payments** - Monitor all payments in dashboard
- 📦 **Inventory control** - Limit quantity for tickets/products

## Payment Links vs Order API

Understanding when to use Payment Links:

| Feature | Payment Links | Order Payment API |
|---------|---------------|-------------------|
| **Setup** | No code - Admin UI only | Requires development |
| **Sharing** | Public URL/QR code | Programmatic integration |
| **Use Case** | Manual sharing, simple needs | Automated systems, e-commerce |
| **Customization** | Limited (via UI) | Full control (via code) |
| **Payment Tracking** | Dashboard only | Dashboard + Webhooks + API |
| **Best For** | Freelancers, small businesses | Developers, businesses with systems |

**When to use Payment Links:**
- Freelancer invoicing
- Event ticket sales
- Course enrollment fees
- Consulting service payments
- Donation collections
- Small business payments
- One-time product sales

## Quick Start

### Step 1: Create Your First Payment Link

1. Log in to [PayIn Admin](https://testnet.payin.com)
2. Navigate to **Payment Links** in the sidebar
3. Click **Create Payment Link**
4. Fill in the details:
   - **Title**: "Consulting Service - 1 Hour"
   - **Amount**: 50 USDT
   - **Currency**: Select USDT
   - **Chains**: Select ethereum-sepolia, polygon-amoy
5. Click **Create Draft**

### Step 2: Customize (Optional)

- Add a **Description**: Explain what the payment is for
- Set **Inventory**: Limit to specific quantity (e.g., 10 tickets)
- Set **Expiration**: Auto-expire after a date
- Add **Metadata**: Track internal information

### Step 3: Publish

1. Click **Publish** on your payment link
2. A unique URL is generated (e.g., `payin.com/p/abc123XYZ`)
3. Copy the link or QR code

### Step 4: Share

Share your payment link via:
- 📧 **Email**: Copy and paste the link
- 💬 **Messaging**: WhatsApp, Telegram, etc.
- 📱 **QR Code**: Download and print
- 🌐 **Website**: Add link to your site
- 📱 **Social Media**: Share on Twitter, Facebook

### Step 5: Get Paid

1. Customer clicks your link
2. Customer selects chain and pays
3. You receive notification
4. Payment appears in dashboard

::: tip Test First
Use testnet links to test the complete flow before sharing mainnet links to customers.
:::

## Creating Payment Links

### Basic Payment Link

**Minimum required fields:**

```json
{
  "title": "Consulting Service - 1 Hour",
  "amount": "50",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "is_primary": true
    }
  ]
}
```

**What customers see:**
- Title: "Consulting Service - 1 Hour"
- Price: 50 USDT
- Available chains: Ethereum Sepolia, Polygon Amoy
- Customer selects chain and pays

### Payment Link with Description

```json
{
  "title": "Web Development Course",
  "description": "Complete 12-week course including:\n• Frontend development\n• Backend APIs\n• Deployment guide\n• Lifetime access",
  "amount": "299",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "is_primary": true
    }
  ]
}
```

**Benefits:**
- Clear explanation of what they're paying for
- Builds trust and reduces confusion
- Supports markdown formatting

### Multi-Currency Payment Link

```json
{
  "title": "Premium Membership",
  "amount": "99",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "is_primary": true
    },
    {
      "currency": "USDC",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "amount": "99"
    }
  ]
}
```

**What customers see:**
- Can choose between USDT or USDC
- Same price in both currencies
- All supported chains available

### Limited Inventory Payment Link

```json
{
  "title": "VIP Event Ticket",
  "description": "Annual Tech Conference 2025\nDate: June 15-17\nVenue: San Francisco",
  "amount": "500",
  "inventoryTotal": 100,
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia"],
      "is_primary": true
    }
  ]
}
```

**Features:**
- Limited to 100 tickets
- Shows "X remaining" to customers
- Automatically stops accepting payments when sold out
- Tracks reserved (pending payment) vs sold (completed)

### Time-Limited Payment Link

```json
{
  "title": "Early Bird Discount",
  "description": "Limited time offer - ends Dec 31, 2025",
  "amount": "79",
  "expiresAt": "2025-12-31T23:59:59Z",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "is_primary": true
    }
  ]
}
```

**Features:**
- Automatically expires at specified date/time
- Customers cannot pay after expiration
- Shows countdown timer on payment page

### Custom Amount Payment Link

```json
{
  "title": "Donation",
  "description": "Support our open source project",
  "amount": "0",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum-sepolia", "polygon-amoy"],
      "is_primary": true
    }
  ]
}
```

**Features:**
- Customer enters their own amount
- Useful for donations, tips, variable pricing
- Set amount to "0" for custom amount

::: warning Custom Amount Validation
Set minimum amount validation on payment page to avoid very small payments that might not cover transaction costs.
:::

## Managing Payment Links

### Link States

Payment links have two states:

**1. Draft** (`draft`)
- Not publicly accessible
- Can be edited freely
- No slug/URL assigned yet
- For preparation and testing

**2. Published** (`published`)
- Publicly accessible via unique URL
- Limited editing (cannot change pricing fundamentals)
- Has unique slug (e.g., `abc123XYZ`)
- Ready for customers

::: tip Publishing Workflow
Create links as drafts → Test internally → Publish when ready → Share with customers
:::

### Editing Payment Links

**Can always edit:**
- ✅ Title
- ✅ Description
- ✅ Inventory total (can increase or decrease)
- ✅ Expiration date
- ✅ Metadata

**Cannot edit after publishing:**
- ❌ Amount (create new link instead)
- ❌ Currencies
- ❌ Chain options
- ❌ Slug (auto-generated on publish)

**To make major changes:**
1. Archive the old link
2. Create a new link with updated details
3. Publish and share new link

### Archiving Links

Archive payment links that are no longer needed:

**When to archive:**
- Event is over
- Product is sold out permanently
- Promotion has ended
- Service no longer offered

**Effects of archiving:**
- Link becomes inaccessible
- Existing payments remain in history
- Can be restored if needed
- Helps keep your dashboard organized

### Viewing Payment History

**For a specific link:**
1. Go to Payment Links dashboard
2. Click on a payment link
3. View **Orders** tab
4. See all payments for this link

**Statistics shown:**
- Total orders: All payment attempts
- Completed orders: Successful payments
- Pending orders: Awaiting payment/confirmation
- Expired orders: Timed out or expired
- Total revenue: Sum of completed payments
- Reserved inventory: Pending payments
- Sold inventory: Completed payments

## Use Cases

### Freelancer Invoice

**Scenario:** Web developer invoicing a client for completed work.

```json
{
  "title": "Website Development - Project Alpha",
  "description": "Delivered items:\n• Homepage design\n• 5 content pages\n• Contact form\n• 2 rounds of revisions\n\nPayment due within 7 days",
  "amount": "2500",
  "expiresAt": "2025-02-07T23:59:59Z",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum", "polygon"],
      "is_primary": true
    },
    {
      "currency": "USDC",
      "chainOptions": ["ethereum", "polygon"],
      "amount": "2500"
    }
  ],
  "metadata": {
    "project_id": "proj_alpha_2025",
    "client_name": "Acme Corp",
    "invoice_number": "INV-2025-001"
  }
}
```

**Workflow:**
1. Create payment link for project
2. Email link to client: "Pay invoice via crypto: [link]"
3. Client pays using their preferred chain
4. Receive notification when paid
5. Mark invoice as paid in your system

### Event Ticket Sales

**Scenario:** Tech conference selling 500 VIP tickets.

```json
{
  "title": "TechConf 2025 - VIP Pass",
  "description": "Includes:\n• All conference sessions\n• VIP networking events\n• Speaker dinner\n• Conference swag bag\n\nDates: June 15-17, 2025\nVenue: San Francisco Convention Center",
  "amount": "499",
  "inventoryTotal": 500,
  "expiresAt": "2025-06-01T00:00:00Z",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum", "polygon"],
      "is_primary": true
    }
  ],
  "metadata": {
    "event_id": "techconf_2025",
    "ticket_type": "vip",
    "venue": "SF Convention Center"
  }
}
```

**Workflow:**
1. Create payment link for tickets
2. Add link to event website
3. Share on social media
4. Monitor sales in dashboard
5. Send ticket fulfillment emails (manual or automated)

### Online Course Enrollment

**Scenario:** Educational platform selling course access.

```json
{
  "title": "Complete Python Bootcamp",
  "description": "Learn Python from zero to hero!\n\n✓ 60 hours of video content\n✓ 200+ coding exercises\n✓ 12 real-world projects\n✓ Certificate of completion\n✓ Lifetime access\n✓ Money-back guarantee",
  "amount": "149",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum", "polygon", "tron"],
      "is_primary": true
    },
    {
      "currency": "USDC",
      "chainOptions": ["ethereum", "polygon"],
      "amount": "149"
    }
  ],
  "metadata": {
    "course_id": "python_bootcamp",
    "platform": "learn.example.com",
    "access_duration": "lifetime"
  }
}
```

**Workflow:**
1. Create payment link for course
2. Add to course landing page
3. Customer clicks "Enroll Now" → redirects to payment link
4. After payment, receive webhook (if configured)
5. Auto-grant course access via webhook handler

### Donation Collection

**Scenario:** Open source project accepting donations.

```json
{
  "title": "Support PayIn Development",
  "description": "Help us build better crypto payment infrastructure!\n\nYour donation helps us:\n• Maintain and improve PayIn\n• Add support for more chains\n• Keep the service free for small businesses\n• Build developer-friendly tools\n\nEvery contribution matters. Thank you! 🙏",
  "amount": "0",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum", "polygon", "tron"],
      "is_primary": true
    },
    {
      "currency": "USDC",
      "chainOptions": ["ethereum", "polygon"],
    }
  ],
  "metadata": {
    "campaign": "open_source_support",
    "project": "payin"
  }
}
```

**Features:**
- Custom amount (donors choose amount)
- Multiple chain options for convenience
- Heartfelt description to encourage donations

## Best Practices

### Link Naming

Use clear, descriptive titles:

**Good Examples:**
```
Consulting Call - 30 Minutes
Web Design Services - Homepage Package
Conference Ticket - Early Bird Price
Python Course - Full Access
```

**Avoid:**
```
Payment          // Too generic
Link 1           // No context
Service          // Vague
Product A        // Unclear
```

### Description Guidelines

**Do:**
- ✅ Clearly explain what they're paying for
- ✅ List specific deliverables or features
- ✅ Include relevant dates/deadlines
- ✅ Add terms or conditions if needed
- ✅ Use bullet points for readability

**Don't:**
- ❌ Leave description empty
- ❌ Use overly technical jargon
- ❌ Write walls of text
- ❌ Forget important details

### Pricing Strategy

**Fixed Amount:**
```json
{
  "amount": "99.00",
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": ["ethereum", "polygon"]
    }
  ]
}
```
- **Use for**: Products, services, tickets with fixed pricing
- **Benefit**: Clear expectations, no confusion

**Custom Amount:**
```json
{
  "amount": "0",
  "currencies": [...]
}
```
- **Use for**: Donations, tips, variable pricing
- **Benefit**: Flexibility for customers
- **Warning**: Set minimum amount to avoid dust payments

### Multi-Chain Strategy

**Offer multiple chains for convenience:**

```json
{
  "currencies": [
    {
      "currency": "USDT",
      "chainOptions": [
        "ethereum",      // High security
        "polygon",       // Low fees
        "tron"          // Very low fees
      ],
      "is_primary": true
    }
  ]
}
```

**Benefits:**
- Customers choose based on their preference
- Lower fees on some chains = happier customers
- Higher conversion rates

**Recommendation:**
- Include at least 2 chains
- Polygon/Tron for low-value payments (< $100)
- Ethereum for high-value payments (> $1000)

### Inventory Management

**For limited availability:**

```json
{
  "inventoryTotal": 50,
  "title": "Early Bird Special - Limited to 50"
}
```

**Monitor in real-time:**
- Check dashboard for available/reserved/sold counts
- Update inventory if you add more capacity
- Archive when sold out

**Best practices:**
- Set realistic inventory numbers
- Mention scarcity in title/description
- Update customers if sold out

### Testing Links

**Always test before sharing:**

1. **Create testnet link** - Use testnet environment first
2. **Test payment flow** - Complete a test payment yourself
3. **Verify notifications** - Check dashboard updates
4. **Check mobile** - Test on mobile devices
5. **Share internally** - Have team test before public launch

::: warning Test With Real Amounts
Test with realistic amounts to ensure the UX is good. Testing with $0.01 won't reveal issues with $1000 payments.
:::

### Link Sharing

**Email Template:**

```
Hi [Customer Name],

Thank you for your interest in [Product/Service]!

To complete your payment, please click the link below:
[Payment Link URL]

Or scan this QR code:
[QR Code Image]

Payment details:
• Amount: $X USDT/USDC
• Supported networks: Ethereum, Polygon
• Payment window: [if time-limited]

Questions? Reply to this email.

Best regards,
[Your Name]
```

**Social Media Post:**

```
🎉 Now accepting crypto payments!

Get [Product/Service Name] with USDT/USDC:
[Payment Link]

✅ Instant confirmation
✅ Multiple chains supported
✅ Secure & transparent

Limited slots available! 👇
```

## Troubleshooting

### "Link not found" Error

**Problem:** Customer gets error when accessing link.

**Causes:**
- Link is still in draft status (not published)
- Link has been archived
- Typo in URL

**Solutions:**
1. Verify link status in dashboard (should be "Published")
2. Check if link is archived (restore if needed)
3. Copy fresh URL from dashboard

### Payment Not Detected

**Problem:** Customer paid but payment not showing in dashboard.

**Causes:**
- Wrong network (paid on different chain than selected)
- Wrong token (paid ETH instead of USDT)
- Transaction still pending
- Paid to wrong address

**Solutions:**
1. Check transaction on block explorer
2. Verify correct network and token
3. Wait for required confirmations
4. Contact support with transaction hash

### Inventory Not Updating

**Problem:** Inventory count not updating after payment.

**Expected Behavior:**
- **Reserved**: Increments when order created (payment pending)
- **Sold**: Increments when payment confirmed
- **Available**: Decreases when reserved

**If stuck:**
- Check order status (might still be pending)
- Wait for blockchain confirmations
- Refresh dashboard

### Cannot Edit Published Link

**Problem:** Need to change amount but link is published.

**Solution:**
1. Archive current link
2. Create new link with updated amount
3. Publish new link
4. Share new URL with customers
5. Inform existing customers of change

::: tip Keep Old Link Active
If customers already have the old link, keep it active until transition is complete. Then archive after grace period.
:::

### QR Code Not Working

**Problem:** Scanning QR code doesn't open payment page.

**Causes:**
- QR code contains wrong URL
- URL is too long for QR code
- QR code image quality too low

**Solutions:**
1. Regenerate QR code from dashboard
2. Use URL shortener if needed
3. Test QR code with multiple apps
4. Increase QR code size/quality

## Advanced Features

### Metadata for Tracking

Attach custom data to payment links:

```json
{
  "title": "Consulting Service",
  "amount": "500",
  "metadata": {
    "client_id": "client_12345",
    "project_code": "PROJ-2025-Q1",
    "service_category": "consulting",
    "sales_rep": "john@example.com",
    "campaign": "email_blast_jan_2025"
  }
}
```

**Use metadata for:**
- Internal tracking and reporting
- Client/project association
- Sales attribution
- Campaign tracking
- Integration with your systems

**Access metadata:**
- View in payment link details
- Included in webhook events
- Searchable via API

### Webhook Integration

Configure webhooks to automate fulfillment:

**Event types:**
- `paymentlink.order.completed` - Payment confirmed
- `paymentlink.order.expired` - Order expired without payment

**Example webhook handler:**

```typescript
app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  if (event.type === 'paymentlink.order.completed') {
    const { paymentLinkId, buyerEmail, amount } = event.data;

    // Auto-fulfill based on payment link
    if (paymentLinkId === 'link_course_python') {
      await grantCourseAccess(buyerEmail);
      await sendWelcomeEmail(buyerEmail);
    } else if (paymentLinkId === 'link_ticket_conference') {
      await generateTicket(buyerEmail);
      await sendTicketEmail(buyerEmail);
    }
  }

  res.status(200).send('OK');
});
```

### API Access

Manage payment links programmatically:

**Create via API:**
```bash
curl -X POST https://testnet.payin.com/api/v1/payment-links \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Product Name",
    "amount": "99",
    "currencies": [...]
  }'
```

**List all links:**
```bash
curl https://testnet.payin.com/api/v1/payment-links \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Useful for:**
- Bulk link creation
- Integration with your CMS
- Dynamic link generation
- Automated reporting

## Next Steps

### Enhance Your Setup
- [Webhooks](/en/guide/webhooks) - Automate fulfillment
- [API Integration](/en/guide/api-integration) - Programmatic control
- [Security](/en/guide/security) - Secure your integration

### For Developers
- [Order Payment Service](/en/guide/order-payment) - Full API control
- [Deposit Service](/en/guide/deposit-service) - Recurring payments
- [Address Pool Setup](/en/guide/address-pool-setup) - Address management

### Resources
- [Supported Networks](/en/guide/supported-networks) - Available blockchains
- [Supported Tokens](/en/guide/supported-tokens) - Available stablecoins

## Support

Need help with Payment Links?

- 📧 **Email**: support@payin.com
- 💬 **Discord**: [Join our community](https://discord.gg/payin) 
- 📚 **Admin Dashboard**: Built-in help and tutorials
