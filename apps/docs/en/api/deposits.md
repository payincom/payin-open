# Deposits API

Deposit APIs bind a reusable address to your own `depositReference`, list bindings, and expose public deposit-page helpers. In PayIn Open, use testnet/sandbox assets only while validating.

**Authenticated base endpoint:** `/api/v1/deposits`
**Public helper endpoints:** `/pay/deposit`, `/api/deposits`, `/api/tokens/deposit`, `/api/transfer-status`

## Bind Deposit Address

Bind one deposit address to a merchant/user reference.

**Endpoint:**

```http
POST /api/v1/deposits/bind
```

**Required permission:** `deposits:write`

**Request body:**

| Field              | Type   | Required | Description                                                       |
| ------------------ | ------ | -------- | ----------------------------------------------------------------- |
| `depositReference` | string | Yes      | Your stable user/account reference, for example `user_alice_123`. |
| `protocol`         | string | Yes      | `evm` or `tron`.                                                  |
| `metadata`         | object | No       | Optional display or integration metadata.                         |

**Example:**

```bash
curl -X POST https://your-payin.example.com/api/v1/deposits/bind \
  -H "Authorization: Bearer $PAYIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "depositReference": "user_alice_123",
    "protocol": "evm",
    "metadata": {
      "title": "Alice deposit wallet",
      "userId": "alice_123"
    }
  }'
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "protocol": "evm",
    "deposit_reference": "user_alice_123",
    "url": "https://your-payin.example.com/pay/deposit/0x1234567890abcdef1234567890abcdef12345678"
  },
  "message": "Deposit address bound successfully"
}
```

## Get Deposit Address

Fetch the bound address for one reference/protocol pair.

**Endpoint:**

```http
GET /api/v1/deposits/:depositReference?protocol=evm
```

**Required permission:** `deposits:read`

**Query parameters:**

| Field      | Type   | Required | Description                         |
| ---------- | ------ | -------- | ----------------------------------- |
| `protocol` | string | No       | `evm` or `tron`; defaults to `evm`. |

## List Deposit Addresses

List bound deposit addresses with optional filtering and pagination.

**Endpoint:**

```http
GET /api/v1/deposits
```

**Required permission:** `deposits:read`

**Query parameters:**

| Field              | Type   | Required | Description                                     |
| ------------------ | ------ | -------- | ----------------------------------------------- |
| `protocol`         | string | No       | Filter to `evm` or `tron`.                      |
| `depositReference` | string | No       | Filter by your reference.                       |
| `page`             | number | No       | Positive integer; defaults are service-defined. |
| `limit`            | number | No       | Positive integer up to `100`.                   |

## List Deposit References

List unique deposit references with aggregate address/deposit metadata from the processor repository.

**Endpoint:**

```http
GET /api/v1/deposits/references
```

**Required permission:** `deposits:read`

**Query parameters:**

| Field    | Type   | Required | Description                   |
| -------- | ------ | -------- | ----------------------------- |
| `page`   | number | No       | Positive integer.             |
| `limit`  | number | No       | Positive integer up to `100`. |
| `search` | string | No       | Search deposit references.    |

## Deposit Statistics

Return address counts and transfer-derived deposit totals for the authenticated runtime scope.

**Endpoint:**

```http
GET /api/v1/deposits/stats
```

**Required permission:** `deposits:read`

**Query parameters:**

| Field            | Type   | Required | Description                                            |
| ---------------- | ------ | -------- | ------------------------------------------------------ |
| `protocol`       | string | No       | Filter transfer totals to `evm` or `tron`.             |
| `detectedAfter`  | string | No       | ISO 8601 timestamp for transfer detection lower bound. |
| `detectedBefore` | string | No       | ISO 8601 timestamp for transfer detection upper bound. |

The response includes:

| Field               | Description                                                                         |
| ------------------- | ----------------------------------------------------------------------------------- |
| `boundAddressCount` | Number of currently bound deposit addresses in the authenticated scope.             |
| `activeReferences`  | Number of unique currently bound deposit references in the authenticated scope.     |
| `totalDeposits`     | Count of detected `business_type = 'deposit'` transfers in the authenticated scope. |
| `totalVolume`       | Token-symbol keyed aggregate transfer volume, for example `{ "USDC": 125.5 }`.      |

## Unbind Deposit Address

Unbind by reference or by a specific address/protocol pair.

**Endpoint:**

```http
POST /api/v1/deposits/unbind
```

**Required permission:** `deposits:write`

**Request body options:**

```json
{ "depositReference": "user_alice_123", "protocol": "evm" }
```

```json
{ "address": "0x1234567890abcdef1234567890abcdef12345678", "protocol": "evm" }
```

When `depositReference` is supplied without `protocol`, PayIn attempts to unbind all currently supported deposit protocols for that reference.

## Public Deposit Page

Render the user-facing deposit page for a bound address.

**Endpoint:**

```http
GET /pay/deposit/:address
```

This endpoint is public and does not require API authentication. It returns `404` HTML when the address is missing or not bound to a deposit.

## Public Deposit Lookup

Fetch public deposit metadata for a bound address, including a QR code data URL.

**Endpoint:**

```http
GET /api/deposits/:address
```

**Response (200):**

```json
{
  "success": true,
  "deposit": {
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "protocol": "evm",
    "depositReference": "user_alice_123",
    "metadata": {}
  },
  "qrCodeDataUrl": "data:image/png;base64,..."
}
```

## Public Available Tokens

List configured tokens that can be sent to a bound deposit address based on its protocol.

**Endpoint:**

```http
GET /api/tokens/deposit/:address/available
```

The general public token catalog is available at `GET /api/tokens` and accepts optional `chainId` or `protocol` filters.

## Transfer Status

Query processor transfer confirmation state by transaction hash. This is useful after the monitor detects a deposit transaction.

**Endpoint:**

```http
GET /api/transfer-status/:txHash
```

**Response fields include:** `txHash`, `found`, `transferId`, `status`, `amount`, `tokenSymbol`, `chain`, `requiredConfirmations`, `currentConfirmations`, `isConfirmed`, `confirmedAt`, `detectedAt`, `fromAddress`, `toAddress`, and `redirectUrl` when applicable.

## Open Smoke Coverage

Use the Open smoke script to validate deposits without mainnet funds:

```bash
npm run open:smoke -- \
  --url http://localhost:3000 \
  --api-key <redacted> \
  --bind-deposit \
  --deposit-reference smoke-deposit-user \
  --deposit-protocol evm
```

Add `--require-live` only when the target Open environment has testnet address-pool capacity and you expect all live checks to pass.

## Error Codes

Common deposit route errors include:

| Code                           | Meaning                                                                   |
| ------------------------------ | ------------------------------------------------------------------------- |
| `DEPOSIT_VALIDATION_FAILED`    | Required request fields are missing.                                      |
| `DEPOSIT_PROTOCOL_UNSUPPORTED` | Protocol is not `evm` or `tron`.                                          |
| `DEPOSIT_FILTER_INVALID_PAGE`  | Pagination `page` is invalid.                                             |
| `DEPOSIT_FILTER_INVALID_LIMIT` | Pagination `limit` is invalid or above `100`.                             |
| `DEPOSIT_STATS_INVALID_DATE`   | Statistics date filter is not valid ISO 8601.                             |
| `DEPOSIT_BIND_FAILED`          | Binding failed, often due to service enablement or address-pool capacity. |
| `DEPOSIT_UNBIND_FAILED`        | Unbinding failed.                                                         |
| `DEPOSIT_GET_FAILED`           | Fetching a deposit address failed.                                        |
| `DEPOSIT_LIST_FAILED`          | Listing deposit addresses failed.                                         |
