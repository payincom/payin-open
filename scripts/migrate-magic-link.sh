#!/bin/bash

# Magic Link Migration Script
# Applies database migrations for optional password authentication

set -e  # Exit on error

echo "🔧 PayIn Magic Link Migration Script"
echo "===================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo "Please set it with: export DATABASE_URL=postgresql://..."
  exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Confirm before proceeding
read -p "⚠️  This will modify the users table. Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Migration cancelled"
  exit 1
fi

echo ""
echo "📝 Applying migration 005_make_password_optional..."
echo ""

# Execute the migration SQL file
psql "$DATABASE_URL" -f packages/auth/src/database/migrations/005_make_password_optional.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration completed successfully!"
  echo ""
  echo "📊 Summary of changes:"
  echo "  - password_hash: NOW OPTIONAL (can be NULL)"
  echo "  - auth_type: NEW FIELD (password/oauth/magic_link)"
  echo "  - idx_users_auth_type: NEW INDEX"
  echo ""
  echo "🎉 Magic link authentication is now enabled!"
  echo ""
  echo "Next steps:"
  echo "1. Configure Supabase Email Magic Link"
  echo "2. Set environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)"
  echo "3. Restart your application"
  echo ""
  echo "📖 For detailed instructions, see: MAGIC_LINK_IMPLEMENTATION.md"
else
  echo ""
  echo "❌ Migration failed!"
  echo "Please check the error message above and try again."
  exit 1
fi
