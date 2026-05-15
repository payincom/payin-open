#!/bin/bash

# Test script to verify payment link new fields are saved correctly

echo "======================================"
echo "Payment Link Fields Test"
echo "======================================"
echo ""

# Get access token
echo "1. Logging in as admin..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"admin123"}' | jq -r '.data.accessToken')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to login"
  exit 1
fi

echo "✅ Logged in successfully"
echo ""

# Get organization ID
echo "2. Getting organization..."
ORG_RESPONSE=$(curl -s -X GET http://localhost:3000/api/v1/organizations \
  -H "Authorization: Bearer $TOKEN")

ORG_ID=$(echo $ORG_RESPONSE | jq -r '.data[0].id')
ORG_NAME=$(echo $ORG_RESPONSE | jq -r '.data[0].name')

echo "✅ Using organization: $ORG_NAME ($ORG_ID)"
echo ""

# Create a test payment link with new fields
echo "3. Creating payment link with new fields..."
CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/payment-links \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-ID: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Payment Link",
    "description": "Testing new fields",
    "amount": "10.00",
    "currencies": [{
      "currency": "USDC",
      "chainOptions": ["ethereum-sepolia"],
      "isPrimary": true
    }],
    "amountType": "user_input",
    "ctaText": "Donate Now",
    "theme": "light"
  }')

LINK_ID=$(echo $CREATE_RESPONSE | jq -r '.data.id')

if [ -z "$LINK_ID" ] || [ "$LINK_ID" = "null" ]; then
  echo "❌ Failed to create payment link"
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi

echo "✅ Created payment link: $LINK_ID"
echo ""

# Verify the fields in database
echo "4. Verifying fields in database..."
DB_RESULT=$(psql "${DB_CONNECTION_STRING}" -t -c "SELECT amount_type, theme, cta_text FROM paymentlinks WHERE id = '$LINK_ID';")

echo "Database result: $DB_RESULT"
echo ""

# Parse the result
AMOUNT_TYPE=$(echo $DB_RESULT | awk '{print $1}')
THEME=$(echo $DB_RESULT | awk '{print $2}')
CTA_TEXT=$(echo $DB_RESULT | awk '{print $3}')

echo "Checking values:"
echo "  Amount Type: $AMOUNT_TYPE (expected: user_input)"
echo "  Theme: $THEME (expected: light)"
echo "  CTA Text: $CTA_TEXT (expected: Donate)"

if [ "$AMOUNT_TYPE" = "user_input" ] && [ "$THEME" = "light" ] && [ "$CTA_TEXT" = "Donate" ]; then
  echo ""
  echo "✅ ✅ ✅ All fields saved correctly! ✅ ✅ ✅"
else
  echo ""
  echo "❌ ❌ ❌ Fields not saved correctly! ❌ ❌ ❌"
  exit 1
fi

echo ""
echo "======================================"
echo "Test completed successfully!"
echo "======================================"
