-- Migration: Add amount_type, cta_text, and theme fields to paymentlinks table
-- Date: 2025-01-XX
-- Description: Adds support for user-input amounts, custom CTA text, and theme selection

-- Add new columns to paymentlinks table
ALTER TABLE paymentlinks
  ADD COLUMN IF NOT EXISTS amount_type VARCHAR(20) NOT NULL DEFAULT 'fixed' CHECK (amount_type IN ('fixed', 'user_input')),
  ADD COLUMN IF NOT EXISTS cta_text VARCHAR(100),
  ADD COLUMN IF NOT EXISTS theme VARCHAR(20) NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light'));

-- Add comment to document the columns
COMMENT ON COLUMN paymentlinks.amount_type IS 'Determines if payment link uses fixed amount or allows user input (e.g., for donations)';
COMMENT ON COLUMN paymentlinks.cta_text IS 'Custom call-to-action text for the checkout submit button';
COMMENT ON COLUMN paymentlinks.theme IS 'Theme for the checkout page (dark or light)';
