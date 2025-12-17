#!/bin/bash

# Script to create DNS record for contactcenter.telnyx.solutions
# This requires a Cloudflare API Token with DNS:Edit permissions

echo "============================================"
echo "Creating DNS Record for Workers Deployment"
echo "============================================"
echo ""

# Check if CLOUDFLARE_API_TOKEN is set
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN environment variable is not set"
    echo ""
    echo "To create an API token:"
    echo "1. Go to https://dash.cloudflare.com/profile/api-tokens"
    echo "2. Click 'Create Token'"
    echo "3. Use 'Edit zone DNS' template"
    echo "4. Select the 'telnyx.solutions' zone"
    echo "5. Create the token and export it:"
    echo "   export CLOUDFLARE_API_TOKEN='your-token-here'"
    echo ""
    exit 1
fi

echo "Step 1: Getting Zone ID for telnyx.solutions..."
ZONE_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=telnyx.solutions" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json")

ZONE_ID=$(echo $ZONE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$ZONE_ID" ]; then
    echo "ERROR: Could not get zone ID for telnyx.solutions"
    echo "API Response: $ZONE_RESPONSE"
    exit 1
fi

echo "✓ Zone ID: $ZONE_ID"
echo ""

echo "Step 2: Creating DNS record for contactcenter.telnyx.solutions..."
echo "   - Type: AAAA"
echo "   - Name: contactcenter"
echo "   - Content: 100:: (placeholder for Workers)"
echo "   - Proxied: true (orange cloud)"
echo ""

DNS_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "AAAA",
    "name": "contactcenter",
    "content": "100::",
    "ttl": 1,
    "proxied": true,
    "comment": "DNS record for Workers deployment - contactcenter frontend and API"
  }')

SUCCESS=$(echo $DNS_RESPONSE | grep -o '"success":[^,]*' | cut -d':' -f2)

if [ "$SUCCESS" = "true" ]; then
    echo "✓ DNS record created successfully!"
    echo ""
    echo "DNS Record Details:"
    echo $DNS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $DNS_RESPONSE
    echo ""
    echo "============================================"
    echo "IMPORTANT: DNS propagation may take a few minutes"
    echo "============================================"
    echo ""
    echo "Frontend URL: https://contactcenter.telnyx.solutions/"
    echo "Backend API URL: https://contactcenter.telnyx.solutions/api/"
    echo ""
    echo "Test with:"
    echo "  curl https://contactcenter.telnyx.solutions/"
    echo "  curl https://contactcenter.telnyx.solutions/api/health"
else
    echo "ERROR: Failed to create DNS record"
    echo "API Response: $DNS_RESPONSE"
    exit 1
fi
