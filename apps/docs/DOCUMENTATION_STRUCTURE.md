# PayIn Open Documentation Structure Overview

This document outlines the complete structure of PayIn documentation for review.

## Phase 1: MCP Onboarding & Core Concepts ⭐ (Week 1) - IN PROGRESS

### 1.0 Address Pool Setup ✅ DETAILED (NEW - CRITICAL)
**File:** `en/guide/address-pool-setup.md`
**Status:** Completed with full content
**Purpose:** Critical first step before any PayIn usage
**Sections:**
- What is Address Pool and why it's needed
- HD Wallet Mode (recommended) - complete guide
  - Install Address Tool CLI
  - Generate mnemonic
  - Generate addresses
  - Import to PayIn
- Self-Managed Mode - complete guide
- Best practices and monitoring
- Security considerations
- Troubleshooting

### 1.1 Quick Start with MCP Server ✅ DETAILED
**File:** `en/guide/quick-start-mcp.md`
**Status:** Completed with full content
**Purpose:** Primary onboarding path using AI assistant
**Sections:**
- What is MCP Server?
- Prerequisites (register → generate API key)
- Step-by-step configuration (Claude Desktop / Cline)
- Verification and first usage
- Read-only mode (no API key)
- Available capabilities
- Troubleshooting

### 1.2 Testnet vs Mainnet ✅ DETAILED
**File:** `en/guide/testnet-vs-mainnet.md`
**Status:** Completed with full content
**Purpose:** Explain two environments and when to use each
**Sections:**
- Overview comparison table
- Testnet characteristics and use cases
- Mainnet characteristics and prerequisites
- Switching between environments
- Best practices and workflow
- Data isolation
- FAQs

### 1.3 Supported Networks ✅ DETAILED
**File:** `en/guide/supported-networks.md`
**Status:** Completed with full content
**Purpose:** Complete blockchain network reference
**Sections:**
- Network overview (4 protocols, 8 networks)
- Detailed testnet specs (Sepolia, Amoy, Nile, Devnet)
- Detailed mainnet specs (Ethereum, Polygon, Tron, Solana)
- Network selection guide
- Cost comparison
- Multi-chain strategy
- Network status monitoring

### 1.4 Supported Tokens ✅ DETAILED
**File:** `en/guide/supported-tokens.md`
**Status:** Completed with full content
**Purpose:** Stablecoin reference and integration guide
**Sections:**
- Token overview (USDC, USDT, DAI, USD1)
- Detailed specs per token
- Contract addresses (testnet + mainnet)
- Token selection guide
- Amount formatting and decimals
- Getting test/mainnet tokens
- Contract verification
- Multi-token strategy

---

## Phase 2: Core Features & Integration (Week 2) - SKELETON ONLY

### 2.1 Introduction
**File:** `en/guide/introduction.md`
**Status:** Needs update (currently basic)
**Purpose:** PayIn overview and value proposition
**Planned Sections:**
- What is PayIn?
- Key features
- Architecture overview
- Use cases
- Why choose PayIn?

### 2.2 Order Payment Service
**File:** `en/guide/order-payment.md`
**Status:** To be created
**Purpose:** Explain order-based payment flow
**Planned Sections:**
- What is Order Payment Service?
- Use cases (e-commerce, one-time payments)
- Order lifecycle
- Creating orders (MCP + API)
- Payment flow
- Order statuses
- Best practices

### 2.3 Deposit Service
**File:** `en/guide/deposit-service.md`
**Status:** To be created
**Purpose:** Explain deposit address binding
**Planned Sections:**
- What is Deposit Service?
- Use cases (gaming, wallets, recurring)
- Binding flow
- Multi-chain monitoring
- Deposit lifecycle
- Creating deposit references
- Best practices

### 2.4 Payment Links (No-Code)
**File:** `en/guide/payment-links.md`
**Status:** To be created
**Purpose:** No-code payment collection
**Planned Sections:**
- What are Payment Links?
- Use cases (events, consulting, tickets)
- Creating payment links (via Admin UI)
- Customization options
- Sharing links
- Tracking payments
- Best practices

### 2.5 Traditional API Integration
**File:** `en/guide/api-integration.md`
**Status:** To be created
**Purpose:** Direct REST API integration guide
**Planned Sections:**
- API overview
- Authentication (API keys)
- Base URLs (testnet/mainnet)
- Common patterns
- Error handling
- Rate limiting
- Best practices
- Migration from MCP to direct API

---

## Phase 3: Advanced Features (Week 3) - SKELETON ONLY

### 3.1 Webhooks
**File:** `en/guide/webhooks.md`
**Status:** To be created
**Purpose:** Event notification system
**Planned Sections:**
- What are webhooks?
- Supported events
- Configuring webhook endpoints
- Signature verification
- Retry mechanism
- Testing webhooks
- Best practices

### 3.2 Address Management
**File:** `en/guide/address-management.md`
**Status:** To be created
**Purpose:** Address pool and HD wallet management
**Planned Sections:**
- Address pool overview
- HD Wallet mode vs Self-managed mode
- Importing addresses (CSV/API)
- Address lifecycle
- Address Tool CLI
- Best practices

### 3.3 Security Best Practices
**File:** `en/guide/security.md`
**Status:** To be created
**Purpose:** Security guidelines
**Planned Sections:**
- API key security
- Webhook security
- Amount verification
- Address verification
- Rate limiting
- Monitoring and alerts

---

## Phase 4: API Reference (Week 4) - SKELETON ONLY

### 4.1 API Overview
**File:** `en/api/overview.md`
**Status:** Placeholder exists
**Purpose:** API documentation entry point
**Planned Sections:**
- REST API introduction
- Authentication
- Base URLs
- Request/response format
- Error codes
- Rate limits

### 4.2 Authentication API
**File:** `en/api/auth.md`
**Status:** To be created
**Sections:** Login, Register, OAuth, API Key management

### 4.3 Orders API
**File:** `en/api/orders.md`
**Status:** To be created
**Sections:** Create, Get, List, Cancel orders

### 4.4 Deposits API
**File:** `en/api/deposits.md`
**Status:** To be created
**Sections:** Create reference, List deposits, Get deposit

### 4.5 Payment Links API
**File:** `en/api/payment-links.md`
**Status:** To be created
**Sections:** Create, Get, List, Update, Delete payment links

### 4.6 Webhooks API
**File:** `en/api/webhooks.md`
**Status:** To be created
**Sections:** Configure, Test, List events

### 4.7 Address Pool API
**File:** `en/api/address-pool.md`
**Status:** To be created
**Sections:** Import, List, Get status

---

## Phase 5: Examples & Advanced (Week 5) - SKELETON ONLY

### 5.1 Order Payment Example
**File:** `en/examples/order-payment.md`
**Status:** Placeholder exists
**Purpose:** Complete e-commerce integration
**Planned Sections:**
- Scenario description
- Backend implementation (Node.js)
- Frontend checkout page
- Webhook handling
- Testing guide
- Full code repository

### 5.2 Deposit Service Example
**File:** `en/examples/deposit-service.md`
**Status:** To be created
**Purpose:** Gaming wallet integration
**Sections:** Similar structure to order example

### 5.3 Payment Link Example
**File:** `en/examples/payment-link.md`
**Status:** To be created
**Purpose:** Event ticketing use case
**Sections:** Similar structure to order example

### 5.4 Multi-Chain Strategy
**File:** `en/examples/multi-chain.md`
**Status:** To be created
**Purpose:** Handling multiple networks
**Sections:** Network selection, user experience, optimization

### 5.5 Webhook Integration
**File:** `en/examples/webhooks.md`
**Status:** To be created
**Purpose:** Complete webhook implementation
**Sections:** Endpoint setup, signature verification, retry handling

---

## Navigation Structure

```
Home
├── Guide
│   ├── Getting Started
│   │   ├── Introduction
│   │   ├── Address Pool Setup ⭐ (CRITICAL FIRST STEP)
│   │   └── Quick Start with MCP ⭐
│   ├── Core Concepts
│   │   ├── Testnet vs Mainnet
│   │   ├── Supported Networks
│   │   └── Supported Tokens
│   ├── Core Features
│   │   ├── Order Payment Service
│   │   ├── Deposit Service
│   │   ├── Payment Links
│   │   └── Traditional API Integration
│   └── Advanced
│       ├── Webhooks
│       ├── Address Management
│       └── Security Best Practices
├── API Reference
│   ├── Overview
│   ├── Authentication
│   ├── Orders
│   ├── Deposits
│   ├── Payment Links
│   ├── Webhooks
│   └── Address Pool
└── Examples
    ├── Order Payment (E-commerce)
    ├── Deposit Service (Gaming)
    ├── Payment Links (Events)
    ├── Multi-Chain Strategy
    └── Webhook Integration
```

---

## Priority Summary

**✅ Phase 1 (Completed with full content):**
- Address Pool Setup (NEW - CRITICAL PREREQUISITE)
- Quick Start with MCP
- Testnet vs Mainnet
- Supported Networks
- Supported Tokens

**📝 Phase 2 (Next priority - skeleton created):**
- Introduction (update)
- Order Payment Service
- Deposit Service
- Payment Links
- Traditional API Integration

**⏳ Phase 3-5 (Future):**
- Advanced features documentation
- Complete API reference
- Detailed examples

---

## Review Questions

1. **Structure**: Does the overall navigation make sense? Any missing sections?

2. **Priority**: Should we adjust the phase priorities?

3. **Phase 1 (detailed content)**: Any changes needed to existing detailed docs?

4. **Phase 2 (next to write)**: Which pages should we prioritize?

5. **Naming**: Are page titles and file names clear?

6. **Organization**: Should any pages be moved or regrouped?
