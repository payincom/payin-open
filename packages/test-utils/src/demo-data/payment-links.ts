/**
 * Demo Payment Links Generator
 *
 * Generates sample payment links with various configurations
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { customAlphabet } from 'nanoid';
import { DEMO_ORGANIZATIONS } from './constants.js';
import { getOwnerUser } from './organizations.js';

// Match the slug generation logic from payment-link.service.ts
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SLUG_LENGTH = 10;
const slugGenerator = customAlphabet(BASE58, SLUG_LENGTH);

interface PaymentLinkTemplate {
  title: string;
  description: string | null;
  amount: string;
  currency: string;
  chainOptions: string[];
  slug?: string;
  status: 'draft' | 'published';
  isArchived?: boolean;
  daysAgo?: number; // Number of days ago this link was created
}

/**
 * Generate demo payment links
 */
export async function generatePaymentLinks(db: Pool): Promise<void> {
  console.log('  🔗 Creating payment links...');

  let totalLinks = 0;

  for (const org of DEMO_ORGANIZATIONS) {
    const owner = getOwnerUser(org.id);
    if (!owner) {
      console.warn(`     ⚠ No owner found for ${org.slug}, skipping payment links`);
      continue;
    }

    const templates = generatePaymentLinkTemplatesForOrg(org.slug);

    for (const template of templates) {
      const linkId = randomUUID();
      // Generate unique slug using business logic (nanoid with BASE58)
      const finalSlug = await ensureUniqueSlug(db, template.slug || slugGenerator());

      // Calculate timestamps based on daysAgo
      const daysAgo = template.daysAgo || 0;
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      const updatedAt = new Date(createdAt); // Same as created for demo data

      // Published links have published_at set to creation time
      const publishedAt = template.status === 'published' ? new Date(createdAt) : null;

      // Create payment link
      await db.query(
        `INSERT INTO paymentlinks
         (id, organization_id, created_by, title, description,
          amount, currency, chain_options, slug, status, is_archived,
          created_at, updated_at, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (slug) DO NOTHING`,
        [
          linkId,
          org.id,
          owner.id,
          template.title,
          template.description,
          template.amount,
          template.currency,
          template.chainOptions,
          finalSlug,
          template.status,
          template.isArchived || false,
          createdAt,
          updatedAt,
          publishedAt,
        ]
      );

      totalLinks++;
    }

    console.log(`     ✓ ${org.slug}: ${templates.length} payment links`);
  }

  console.log(`     ✓ Total: ${totalLinks} payment links`);
}

/**
 * Ensure slug is unique (matches business logic from payment-link.service.ts)
 */
async function ensureUniqueSlug(db: Pool, slug: string): Promise<string> {
  const result = await db.query(`SELECT slug FROM paymentlinks WHERE slug = $1`, [slug]);
  if (result.rowCount && result.rowCount > 0) {
    // Slug is taken, generate a new one
    return ensureUniqueSlug(db, slugGenerator());
  }
  return slug;
}

/**
 * Generate payment link templates for an organization
 */
function generatePaymentLinkTemplatesForOrg(orgSlug: string): PaymentLinkTemplate[] {
  // Customize templates based on organization
  if (orgSlug === 'tech-corp') {
    return [
      {
        title: 'Pro Subscription',
        description: 'Monthly subscription for Pro plan',
        amount: '99.00',
        currency: 'USDT',
        chainOptions: ['ethereum-sepolia', 'polygon-amoy'],
        status: 'published' as const,
        daysAgo: 45, // Created 45 days ago
      },
      {
        title: 'Enterprise License',
        description: 'Annual enterprise license',
        amount: '999.00',
        currency: 'USDT',
        chainOptions: ['ethereum-sepolia', 'polygon-amoy', 'tron-nile'],
        status: 'published' as const,
        daysAgo: 30, // Created 30 days ago
      },
      {
        title: 'Custom Services',
        description: 'Pay for custom development services',
        amount: '0.00',
        currency: 'USDT',
        chainOptions: ['ethereum-sepolia', 'polygon-amoy'],
        status: 'draft' as const,
        daysAgo: 3, // Created 3 days ago
      },
    ];
  } else if (orgSlug === 'game-studio') {
    return [
      {
        title: 'Game Credits',
        description: 'Purchase in-game credits',
        amount: '0.00',
        currency: 'USDC',
        chainOptions: ['ethereum-sepolia', 'polygon-amoy'],
        status: 'published' as const,
        daysAgo: 60, // Created 60 days ago
      },
      {
        title: 'Premium Pass',
        description: 'Monthly premium gaming pass',
        amount: '19.99',
        currency: 'USDC',
        chainOptions: ['ethereum-sepolia', 'polygon-amoy'],
        status: 'published' as const,
        daysAgo: 15, // Created 15 days ago
      },
      {
        title: 'VIP Membership',
        description: 'VIP access and exclusive content',
        amount: '49.99',
        currency: 'USDC',
        chainOptions: ['ethereum-sepolia', 'polygon-amoy', 'tron-nile'],
        status: 'draft' as const,
        daysAgo: 7, // Created 7 days ago
      },
    ];
  } else if (orgSlug === 'e-commerce') {
    return [
      {
        title: 'Product Checkout',
        description: 'Pay for your order',
        amount: '0.00',
        currency: 'USDT',
        chainOptions: ['ethereum-sepolia', 'polygon-amoy'],
        status: 'published' as const,
        daysAgo: 90, // Created 90 days ago
      },
      {
        title: 'Gift Card',
        description: 'Purchase a gift card',
        amount: '50.00',
        currency: 'USDT',
        chainOptions: ['ethereum-sepolia', 'polygon-amoy'],
        status: 'published' as const,
        daysAgo: 20, // Created 20 days ago
      },
      {
        title: 'Donation',
        description: 'Support our cause',
        amount: '0.00',
        currency: 'USDT',
        chainOptions: ['ethereum-sepolia', 'polygon-amoy', 'tron-nile'],
        status: 'draft' as const,
        isArchived: true,
        daysAgo: 120, // Created 120 days ago (old archived link)
      },
    ];
  }

  // Default templates
  return [
    {
      title: 'Default Payment',
      description: 'General purpose payment link',
      amount: '0.00',
      currency: 'USDT',
      chainOptions: ['ethereum-sepolia', 'polygon-amoy'],
      status: 'published' as const,
      daysAgo: 10,
    },
  ];
}
