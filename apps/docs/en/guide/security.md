# Security Best Practices

Security is critical when handling cryptocurrency payments. This guide covers essential security practices for integrating PayIn into your application.

## Security Fundamentals

PayIn is designed with security at its core:

- 🔐 **Non-Custodial**: You control private keys via mnemonic phrases
- 🔒 **End-to-End Encryption**: All API communication over HTTPS
- 🛡️ **Signature Verification**: Webhooks signed with HMAC-SHA256
- 📊 **Complete Audit Logs**: All operations logged and traceable
- 🔑 **Fine-Grained Access**: Role-based permissions (Owner, Admin, Member, Viewer)

**Your Responsibilities:**
- Secure API keys and webhook secrets
- Safely store mnemonic phrases
- Verify all webhook signatures
- Monitor for suspicious activity
- Follow production security best practices

## API Key Security

API keys are credentials that grant access to your PayIn account. Treat them like passwords.

### Storage Best Practices

**✅ DO:**
- Store in environment variables (`process.env.PAYIN_API_KEY`)
- Use secret management systems (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault)
- Encrypt keys at rest
- Use different keys for testnet and mainnet
- Create separate keys for different services/environments

```bash
# .env file
PAYIN_TESTNET_KEY=pk_test_abc123...
PAYIN_MAINNET_KEY=pk_live_xyz789...
```

**❌ DON'T:**
- Commit keys to version control (Git, SVN, etc.)
- Hardcode keys in application code
- Log keys in application logs
- Share keys via email or chat
- Expose keys in client-side code (JavaScript, mobile apps)
- Use same key across multiple environments

### Key Rotation

Rotate API keys regularly to minimize risk if a key is compromised.

**Rotation Schedule:**
- 🔄 **Every 90 days**: Routine rotation
- ⚠️ **Immediately**: Team member departure or suspected compromise
- 🚨 **Within 24 hours**: Confirmed security incident

**Zero-Downtime Rotation:**

```bash
# Step 1: Create new API key through the Open operator API/CLI
NEW_KEY=pk_live_new123...

# Step 2: Update environment variables (keep old key temporarily)
PAYIN_API_KEY=$NEW_KEY
PAYIN_API_KEY_OLD=$OLD_KEY

# Step 3: Deploy with dual-key support
# Your app should try new key, fallback to old if needed

# Step 4: After 24 hours, verify new key works
# Check logs for any old key usage

# Step 5: Delete old key through the Open operator API/CLI
```

**Implementation:**

```typescript
async function makeApiCall(endpoint: string, options: any) {
  // Try new key first
  try {
    return await fetch(endpoint, {
      ...options,
      headers: {
        'Authorization': `Bearer ${process.env.PAYIN_API_KEY}`,
        ...options.headers
      }
    });
  } catch (error) {
    // Fallback to old key during transition
    if (process.env.PAYIN_API_KEY_OLD) {
      console.warn('Falling back to old API key');
      return await fetch(endpoint, {
        ...options,
        headers: {
          'Authorization': `Bearer ${process.env.PAYIN_API_KEY_OLD}`,
          ...options.headers
        }
      });
    }
    throw error;
  }
}
```

### Key Scope and Permissions

PayIn Open scopes API access to your self-hosted deployment and configured business/API-key scope. It does not ship Cloud organization members or dashboard roles; protect operator functions with your identity provider, deployment controls, or a self-built console.

| Key Scope | Permissions | Use Case |
|------|-------------|----------|
| **Operator** | Manage deployment settings, keys, webhooks, address pools | Trusted operations automation |
| **Write** | Create orders and deposits, read related status | Application backend |
| **Read-only** | Query status and history | Monitoring, analytics |

**Best Practices:**
- ✅ Create keys with minimum necessary permissions
- ✅ Use separate keys for read vs. write operations
- ✅ One key per service/application
- ✅ Monitor key usage through logs, metrics, or self-hosted operator tooling

### Monitoring Key Usage

Monitor API key usage for suspicious activity:

```typescript
// Log all API calls with key ID
logger.info('API call', {
  endpoint: '/orders',
  keyId: extractKeyId(apiKey),
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString()
});

// Alert on unusual patterns
if (callsInLastHour > 1000) {
  await sendAlert({
    type: 'api_abuse',
    message: `Unusual API activity: ${callsInLastHour} calls in last hour`,
    keyId: extractKeyId(apiKey)
  });
}
```

## Webhook Security

Webhooks are HTTP callbacks from PayIn to your server. Securing them is critical.

### Signature Verification (Required)

**Always verify webhook signatures** using HMAC-SHA256:

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const parts = signature.split(',');
  const timestamp = parseInt(parts.find(p => p.startsWith('t='))!.split('=')[1]);
  const sig = parts.find(p => p.startsWith('v1='))!.split('=')[1];

  // Check timestamp tolerance (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > 300) {
    throw new Error('Webhook timestamp expired');
  }

  // Compute expected signature
  const payload = `${timestamp}.${rawBody.toString()}`;
  const expected = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(sig, 'hex'),
    Buffer.from(expected, 'hex')
  );
}
```

::: tip Complete Webhook Security
See [Webhooks Guide](/en/guide/webhooks#signature-verification) for complete signature verification implementation in TypeScript, Python, and PHP.
:::

### Endpoint Protection

1. **HTTPS Only**
   - PayIn requires HTTPS webhook endpoints
   - Use valid SSL/TLS certificates
   - Never use self-signed certificates in production

2. **Authentication** (Optional)
   - Add custom authentication header
   - Implement IP whitelist if feasible
   - Use VPN or private network for sensitive webhooks

3. **Rate Limiting**
   ```typescript
   import rateLimit from 'express-rate-limit';

   const webhookLimiter = rateLimit({
     windowMs: 1 * 60 * 1000, // 1 minute
     max: 100, // 100 requests per minute
     message: 'Too many webhook requests'
   });

   app.post('/webhooks/payin', webhookLimiter, handleWebhook);
   ```

4. **Input Validation**
   ```typescript
   app.post('/webhooks/payin', async (req, res) => {
     // Validate event structure
     const event = req.body;
     if (!event.id || !event.type || !event.data) {
       return res.status(400).json({ error: 'Invalid webhook structure' });
     }

     // Validate event type
     const validTypes = [
       'order.completed', 'order.expired',
       'deposit.completed', 'deposit.address_bound'
     ];
     if (!validTypes.includes(event.type)) {
       return res.status(400).json({ error: 'Unknown event type' });
     }

     // Process webhook...
   });
   ```

### Replay Attack Prevention

Prevent attackers from replaying old webhooks:

```typescript
// Track processed webhook IDs (use Redis or database in production)
const processedWebhooks = new Set<string>();

app.post('/webhooks/payin', async (req, res) => {
  const event = req.body;

  // Check if already processed
  if (processedWebhooks.has(event.id)) {
    console.warn('Replay attack detected:', event.id);
    return res.status(200).json({ received: true }); // Still return 200
  }

  // Verify signature (includes timestamp check)
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook
  await handleWebhook(event);
  processedWebhooks.add(event.id);

  res.json({ received: true });
});
```

## Mnemonic Phrase Security

Your mnemonic phrase is the master key to all addresses generated by PayIn. **If someone obtains your mnemonic, they control your funds.**

### Storage Requirements

**🔴 CRITICAL:**
- **Never store mnemonics in database**
- **Never log mnemonics**
- **Never transmit mnemonics over network**
- **Never commit mnemonics to version control**

**Recommended Storage:**
1. **Hardware Security Module (HSM)** - Best for high-value operations
2. **Air-gapped computer** - Store offline, never connected to internet
3. **Encrypted paper backup** - Physical storage in secure location
4. **Encrypted USB drive** - Stored in bank safe deposit box

### Generating Addresses

Use PayIn's address generation tool securely:

```bash
# Generate addresses offline on air-gapped machine
payin-address-tool generate \
  --mnemonic "your twelve word seed phrase..." \
  --protocol evm \
  --count 1000 \
  --output addresses.json

# Transfer addresses.json to online machine
# Import to PayIn via operator API/CLI

# ⚠️ NEVER upload mnemonic to any online service
```

### Multi-Signature Alternative

For high-value deployments, consider multi-signature wallets:
- Require multiple approvals for withdrawals
- Distribute control across multiple parties
- Reduce single point of failure

## Payment Verification

Always verify payments before fulfilling orders.

### Amount Verification

```typescript
async function verifyPayment(webhook: any) {
  const { amount, currency, orderId } = webhook.data;

  // 1. Fetch original order
  const order = await db.orders.findUnique({ where: { id: orderId } });

  // 2. Verify exact amount (in smallest units)
  if (amount !== order.amount) {
    throw new Error(`Amount mismatch: expected ${order.amount}, got ${amount}`);
  }

  // 3. Verify currency
  if (currency !== order.currency) {
    throw new Error(`Currency mismatch: expected ${order.currency}, got ${currency}`);
  }

  // 4. Verify order not already fulfilled
  if (order.status === 'fulfilled') {
    throw new Error('Order already fulfilled');
  }

  return true;
}
```

### Transaction Verification

```typescript
async function verifyTransaction(txHash: string, chainId: string) {
  // 1. Check transaction exists on blockchain
  const tx = await blockchainProvider.getTransaction(txHash);
  if (!tx) {
    throw new Error('Transaction not found');
  }

  // 2. Verify sufficient confirmations
  const confirmations = await blockchainProvider.getConfirmations(txHash);
  const required = getRequiredConfirmations(chainId); // e.g., 3 for Ethereum
  if (confirmations < required) {
    throw new Error(`Insufficient confirmations: ${confirmations}/${required}`);
  }

  // 3. Verify transaction succeeded
  if (!tx.status) {
    throw new Error('Transaction failed');
  }

  return true;
}
```

### Address Verification

```typescript
async function verifyAddress(address: string, protocol: string) {
  // 1. Verify address format
  if (!isValidAddress(address, protocol)) {
    throw new Error('Invalid address format');
  }

  // 2. Verify address ownership (belongs to your pool)
  const owned = await db.addressPool.findUnique({
    where: { address, protocol }
  });
  if (!owned) {
    throw new Error('Address not in pool');
  }

  // 3. Verify address allocated correctly
  if (owned.status !== 'allocated' && owned.status !== 'bound') {
    throw new Error('Address not properly allocated');
  }

  return true;
}
```

## Network Security

### HTTPS Everywhere

All communication must use HTTPS:

```typescript
// ❌ BAD: HTTP endpoint
const API_BASE = 'http://<your-payin-open-api>'; // INSECURE

// ✅ GOOD: HTTPS endpoint
const API_BASE = 'https://<your-payin-open-api>'; // SECURE
```

**Requirements:**
- Use TLS 1.2 or higher
- Valid SSL/TLS certificates (not self-signed in production)
- HSTS headers enabled
- Certificate pinning for mobile apps

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 22/tcp   # SSH (restrict to specific IPs)
sudo ufw deny 80/tcp    # Block HTTP
sudo ufw enable

# Restrict database access
sudo ufw allow from 10.0.1.0/24 to any port 5432  # PostgreSQL
```

### DDoS Protection

Use DDoS protection services:
- Cloudflare
- AWS Shield
- Akamai
- Fastly

## Access Control

### Application Access Control

Implement least privilege in your application or self-built console:

```typescript
// Define application roles and permissions
const ROLES = {
  owner: ['*'],  // All permissions
  admin: ['orders:*', 'deposits:*', 'webhooks:*', 'keys:*'],
  member: ['orders:create', 'orders:read', 'deposits:create', 'deposits:read'],
  viewer: ['orders:read', 'deposits:read']
};

function checkPermission(user: User, permission: string): boolean {
  const userPermissions = ROLES[user.role];
  return userPermissions.includes('*') ||
         userPermissions.includes(permission) ||
         userPermissions.some(p => p.endsWith(':*') && permission.startsWith(p.split(':')[0]));
}

// Usage
if (!checkPermission(user, 'orders:create')) {
  throw new Error('Insufficient permissions');
}
```

### Multi-Factor Authentication (MFA)

For PayIn Open, protect operator access with your identity provider, VPN, or deployment platform MFA. If you use PayIn Cloud, enable dashboard MFA in the Cloud security settings.

**Enforce MFA for:**
- ✅ All Owner accounts
- ✅ All Admin accounts
- ✅ Production environment access
- ✅ API key creation

### Session Management

```typescript
// Implement secure session handling
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,      // HTTPS only
    httpOnly: true,    // Not accessible via JavaScript
    sameSite: 'strict', // CSRF protection
    maxAge: 3600000    // 1 hour
  }
};
```

## Logging and Monitoring

### Comprehensive Logging

Log all critical operations:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log API calls
app.use((req, res, next) => {
  logger.info('API request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });
  next();
});

// Log webhook deliveries
logger.info('Webhook received', {
  eventId: event.id,
  eventType: event.type,
  deliveryId: req.headers['x-payin-delivery-id'],
  timestamp: new Date().toISOString()
});

// Log payment confirmations
logger.info('Payment confirmed', {
  orderId: order.id,
  amount: order.amount,
  currency: order.currency,
  txHash: payment.txHash,
  timestamp: new Date().toISOString()
});
```

**⚠️ Never Log:**
- API keys or webhook secrets
- Mnemonic phrases
- Private keys
- Full credit card numbers (if applicable)
- Passwords

### Real-Time Monitoring

Set up monitoring and alerts:

```typescript
// Monitor for unusual activity
async function monitorApiActivity() {
  const last10MinCalls = await db.auditLogs.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
    }
  });

  if (last10MinCalls > 1000) {
    await sendAlert({
      type: 'api_spike',
      message: `High API activity: ${last10MinCalls} calls in 10 minutes`,
      severity: 'high'
    });
  }
}

// Monitor for failed webhooks
async function monitorWebhookFailures() {
  const failed = await db.webhookLogs.count({
    where: {
      status: 'failed',
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
    }
  });

  if (failed > 10) {
    await sendAlert({
      type: 'webhook_failures',
      message: `${failed} webhook failures in 15 minutes`,
      severity: 'critical'
    });
  }
}

// Run monitors periodically
setInterval(monitorApiActivity, 5 * 60 * 1000);  // Every 5 minutes
setInterval(monitorWebhookFailures, 5 * 60 * 1000);
```

## Data Security

### Encryption at Rest

Encrypt sensitive data in database:

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Usage
await db.users.create({
  data: {
    email: user.email,
    sensitiveData: encrypt(user.sensitiveData)
  }
});
```

### Database Security

```bash
# PostgreSQL configuration
# /etc/postgresql/postgresql.conf

# Encrypt connections
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'

# Strong authentication
password_encryption = scram-sha-256

# Connection limits
max_connections = 100
```

### Backup Security

```bash
# Encrypt database backups
pg_dump payindb | gzip | \
  openssl enc -aes-256-cbc -salt -pbkdf2 \
  -out backup_$(date +%Y%m%d).sql.gz.enc

# Store encrypted backups in multiple locations
aws s3 cp backup_*.enc s3://payinbackups/ --sse AES256
```

## Incident Response

### Preparation

1. **Create Incident Response Plan**
   - Define incident-response responsibilities
   - Document escalation procedures
   - Establish communication channels
   - Prepare runbooks for common scenarios

2. **Incident Response Team**
   - Incident Commander
   - Technical Lead
   - Security Officer
   - Communications Lead

### Detection

Monitor for security incidents:

```typescript
// Detect suspicious patterns
const suspiciousPatterns = {
  rapidApiCalls: { threshold: 100, window: 60 }, // 100 calls/minute
  failedLogins: { threshold: 5, window: 300 },   // 5 failed/5min
  unusualIPs: { threshold: 10, window: 3600 },   // 10 different IPs/hour
  largeOrders: { threshold: 10000, currency: 'USDT' }
};

async function detectAnomalies() {
  // Check for rapid API calls from single IP
  const rapidCalls = await db.auditLogs.groupBy({
    by: ['ipAddress'],
    where: {
      createdAt: { gte: new Date(Date.now() - 60000) }
    },
    _count: true,
    having: {
      _count: { gte: 100 }
    }
  });

  if (rapidCalls.length > 0) {
    await triggerIncident({
      type: 'api_abuse',
      details: rapidCalls,
      severity: 'medium'
    });
  }
}
```

### Response

When incident detected:

1. **Assess** - Determine scope and severity
2. **Contain** - Stop ongoing attack
3. **Eradicate** - Remove threat
4. **Recover** - Restore normal operations
5. **Review** - Post-incident analysis

**Common Actions:**
```typescript
// Revoke compromised API key
await revokeApiKey(compromisedKeyId);

// Block suspicious IP
await addIpToBlocklist(suspiciousIp);

// Rotate webhook secret
await rotateWebhookSecret(endpointId);

// Notify affected users
await notifyUsers({
  type: 'security_incident',
  message: 'We detected suspicious activity...',
  actions: ['Reset your password', 'Review recent transactions']
});
```

### Recovery

After incident:

1. Document incident timeline
2. Identify root cause
3. Implement fixes
4. Update security procedures
5. Share lessons learned with team

## Security Checklist

### Development Phase

- [ ] API keys stored in environment variables
- [ ] Webhook signature verification implemented
- [ ] All endpoints use HTTPS
- [ ] Input validation on all user inputs
- [ ] Error messages don't leak sensitive information
- [ ] No secrets in code or version control
- [ ] Dependency vulnerabilities checked (`npm audit`)
- [ ] Code reviewed for security issues

### Testing Phase

- [ ] Security testing performed
- [ ] Testnet testing completed
- [ ] Webhook signature verification tested
- [ ] Payment verification logic tested
- [ ] Error scenarios tested
- [ ] Rate limiting tested
- [ ] Penetration testing (if high-value)

### Pre-Production

- [ ] API keys rotated from testnet keys
- [ ] Webhook secrets configured
- [ ] HTTPS certificates valid
- [ ] Firewall rules configured
- [ ] Database encrypted
- [ ] Backups configured and tested
- [ ] Monitoring and alerts set up
- [ ] Incident response plan documented
- [ ] Team trained on security procedures

### Production

- [ ] Regular key rotation schedule (90 days)
- [ ] Active monitoring and alerting
- [ ] Regular security audits
- [ ] Backup procedures tested monthly
- [ ] Incident response drills quarterly
- [ ] Dependencies updated regularly
- [ ] Audit logs reviewed weekly
- [ ] Access control reviewed quarterly

### Compliance (If Applicable)

- [ ] GDPR compliance (EU users)
- [ ] CCPA compliance (California users)
- [ ] PCI DSS compliance (if handling cards)
- [ ] KYC/AML procedures (if required)
- [ ] Data retention policies
- [ ] Privacy policy published
- [ ] Terms of service published

## Common Vulnerabilities

### API Abuse

**Problem:** Attacker makes excessive API calls

**Prevention:**
```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
```

### SQL Injection

**Problem:** Attacker injects malicious SQL

**Prevention:**
```typescript
// ❌ BAD: String concatenation
const query = `SELECT * FROM users WHERE email = '${userInput}'`;

// ✅ GOOD: Parameterized queries
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.query(query, [userInput]);
```

### Cross-Site Scripting (XSS)

**Problem:** Attacker injects malicious scripts

**Prevention:**
```typescript
import DOMPurify from 'isomorphic-dompurify';

// Sanitize user input
const cleanInput = DOMPurify.sanitize(userInput);

// Set Content-Security-Policy header
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'"
  );
  next();
});
```

### Insecure Dependencies

**Problem:** Using packages with known vulnerabilities

**Prevention:**
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Check before installing
npm install --audit=true

# Use Snyk for continuous monitoring
npm install -g snyk
snyk test
```

## Security Resources

### Tools

- **Dependency Scanning**: `npm audit`, Snyk, Dependabot
- **Secret Detection**: GitGuardian, TruffleHog
- **Static Analysis**: ESLint (with security plugins), SonarQube
- **Dynamic Analysis**: OWASP ZAP, Burp Suite
- **Monitoring**: Datadog, New Relic, Sentry

### Learning Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Web Security Academy (PortSwigger)](https://portswigger.net/web-security)

## Reporting Security Issues

If you discover a security vulnerability in PayIn:

**📧 Email:** security@payin.com

**Include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

**Please:**
- ✅ Report privately first
- ✅ Give us reasonable time to fix (90 days)
- ✅ Don't exploit the vulnerability
- ❌ Don't disclose publicly until resolved

We appreciate responsible disclosure and may recognize security researchers who help improve PayIn's security.

## Next Steps

### Essential Security Guides

- **[Webhooks Security](/en/guide/webhooks#signature-verification)** - Complete webhook security implementation
- **[API Integration](/en/guide/api-integration#error-handling)** - Secure API usage patterns

### Setup Guides

- **[Address Pool Setup](/en/guide/address-pool-setup)** - Secure address generation
- **[Quick Start with MCP](/en/guide/quick-start-mcp)** - Get started safely

---

**Remember:** Security is not a one-time setup. It's an ongoing process of monitoring, updating, and improving your defenses. Stay vigilant!
