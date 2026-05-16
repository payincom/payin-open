#!/usr/bin/env tsx
import { parseArgs } from 'node:util';
import {
  buildAuthHeaders,
  buildSmokeOrderPayload,
  checkHttpEndpoint,
  extractOrderId,
  extractPaymentUrl,
  fetchWithTimeout,
  formatChecks,
  hasLiveAuth,
  type OpenOpsCheck,
} from './ops-lib.js';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    timeout: { type: 'string', default: '5000' },
    'api-key': { type: 'string' },
    token: { type: 'string' },
    'create-order': { type: 'boolean', default: false },
    'require-live': { type: 'boolean', default: false },
    'order-reference': { type: 'string' },
    amount: { type: 'string' },
    currency: { type: 'string' },
    'chain-id': { type: 'string' },
    'webhook-id': { type: 'string' },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  console.log(`PayIn Open smoke test\n\nUsage:\n  npm run open:smoke\n  npm run open:smoke -- --url http://localhost:3000\n  npm run open:smoke -- --url http://localhost:3000 --api-key <redacted> --create-order\n  npm run open:smoke -- --url http://localhost:3000 --api-key <redacted> --create-order --webhook-id <id>\n\nDefault mode is safe dry-run. Live order creation requires --url, --create-order, and --api-key or --token.\n--require-live fails if live order/monitor/webhook checks are skipped.`);
  process.exit(0);
}

const checks: OpenOpsCheck[] = [];
const baseUrl = values.url?.replace(/\/$/, '');
const timeoutMs = Number.parseInt(values.timeout || '5000', 10);
const authHeaders = buildAuthHeaders({ apiKey: values['api-key'], bearerToken: values.token });
const requireLive = Boolean(values['require-live']);

function emit(ok: boolean, title = 'PayIn Open Smoke') {
  const summary = { ok, checks };
  console.log(values.json ? JSON.stringify(summary, null, 2) : formatChecks(title, summary));
  process.exit(ok ? 0 : 1);
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

if (!baseUrl) {
  checks.push({
    id: 'smoke.dry-run',
    status: requireLive ? 'fail' : 'warn',
    message: 'No --url provided; live API smoke checks were skipped.',
    suggestion: 'Start PayIn Open API and rerun: npm run open:smoke -- --url http://localhost:3000',
  });
  checks.push({
    id: 'smoke.required-flow',
    status: 'pass',
    message: 'Required live flow: /health, public chain/token config, order creation, payment page render, monitor status, webhook delivery.',
  });
  emit(checks.every((check) => check.status !== 'fail'), 'PayIn Open Smoke (dry run)');
}

checks.push(await checkHttpEndpoint(`${baseUrl}/health`, timeoutMs));
checks.push(await checkHttpEndpoint(`${baseUrl}/api/chains`, timeoutMs));
checks.push(await checkHttpEndpoint(`${baseUrl}/api/tokens`, timeoutMs));

if (!hasLiveAuth({ apiKey: values['api-key'], bearerToken: values.token })) {
  checks.push({
    id: 'smoke.auth',
    status: requireLive || values['create-order'] || values['webhook-id'] ? 'fail' : 'warn',
    message: 'No API key or bearer token was provided; authenticated live smoke checks were skipped.',
    suggestion: 'Pass --api-key or --token to create a test order, inspect monitor status, and test webhook delivery.',
  });
  emit(checks.every((check) => check.status !== 'fail'));
}

const authedGet = { headers: authHeaders } satisfies RequestInit;
checks.push(await checkHttpEndpoint(`${baseUrl}/api/v1/chains`, timeoutMs, authedGet));

if (values['create-order']) {
  const payload = buildSmokeOrderPayload({
    orderReference: values['order-reference'],
    amount: values.amount,
    currency: values.currency,
    chainId: values['chain-id'],
  });

  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/v1/orders`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, timeoutMs);
    const body = await readJson(response);
    const orderId = extractOrderId(body);
    const paymentUrl = extractPaymentUrl(body, baseUrl, orderId);

    checks.push({
      id: 'smoke.order.create',
      status: response.ok && orderId ? 'pass' : 'fail',
      message: response.ok && orderId
        ? `Created smoke order ${orderId}.`
        : `Order creation returned HTTP ${response.status}.`,
      detail: response.ok ? undefined : JSON.stringify(body).slice(0, 500),
      suggestion: response.ok ? undefined : 'Check address pool capacity, chain/token config, auth permissions, and Open default merchant bootstrap.',
    });

    if (paymentUrl) {
      checks.push(await checkHttpEndpoint(paymentUrl, timeoutMs, { headers: { Accept: 'text/html' } }));
    } else {
      checks.push({
        id: 'smoke.payment-page',
        status: 'fail',
        message: 'Could not derive a payment page URL from the created order response.',
        suggestion: 'Verify order response includes data.url or data.orderId.',
      });
    }

    if (orderId) {
      checks.push(await checkHttpEndpoint(`${baseUrl}/api/order-status/${orderId}`, timeoutMs));
    }
  } catch (error) {
    checks.push({
      id: 'smoke.order.create',
      status: 'fail',
      message: `Order creation failed: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Check API service logs, DB connectivity, auth, and address pool capacity.',
    });
  }
} else {
  checks.push({
    id: 'smoke.order.create',
    status: requireLive ? 'fail' : 'warn',
    message: 'Order creation smoke check skipped because --create-order was not provided.',
    suggestion: 'Run with --create-order plus --api-key/--token in sandbox/testnet.',
  });
}

if (values['webhook-id']) {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/v1/notifications/endpoints/${values['webhook-id']}/test`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'open.smoke', payload: { source: 'payin-open-smoke' } }),
    }, timeoutMs);
    const body = await readJson(response);
    checks.push({
      id: 'smoke.webhook.delivery',
      status: response.ok ? 'pass' : 'fail',
      message: response.ok
        ? `Webhook test delivery accepted for endpoint ${values['webhook-id']}.`
        : `Webhook test delivery returned HTTP ${response.status}.`,
      detail: response.ok ? undefined : JSON.stringify(body).slice(0, 500),
      suggestion: response.ok ? undefined : 'Check webhook endpoint configuration, signing secret, network reachability, and notification worker logs.',
    });
  } catch (error) {
    checks.push({
      id: 'smoke.webhook.delivery',
      status: 'fail',
      message: `Webhook delivery test failed: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Check webhook endpoint configuration and notification service logs.',
    });
  }
} else {
  checks.push({
    id: 'smoke.webhook.delivery',
    status: requireLive ? 'fail' : 'warn',
    message: 'Webhook delivery smoke check skipped because --webhook-id was not provided.',
    suggestion: 'Create/configure a sandbox webhook endpoint, then rerun with --webhook-id.',
  });
}

emit(checks.every((check) => check.status !== 'fail'));
