#!/bin/bash
# Send 100 requests to the GraphQL endpoint
# Expected result: 30 successful responses (HTTP 200) and 70 rate-limited responses (HTTP 429)

ENDPOINT="http://localhost:4173/api/graphql"

echo "Testing rate limiting (Unauthenticated) - sending 100 requests to $ENDPOINT..."

success_count=0
rate_limited_count=0
other_count=0

for i in {1..100}
do
  # Send a simple query
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"query":"{ __typename }"}' $ENDPOINT)
  
  if [ "$RESPONSE" -eq 200 ]; then
    success_count=$((success_count+1))
    echo "Request $i: ✅ 200 OK"
  elif [ "$RESPONSE" -eq 429 ]; then
    rate_limited_count=$((rate_limited_count+1))
    echo "Request $i: 🔴 429 Too Many Requests"
  else
    other_count=$((other_count+1))
    echo "Request $i: ⚠️ Unexpected status $RESPONSE"
  fi
done

echo ""
echo "--- Summary ---"
echo "Successful (200): $success_count (Expected: 30)"
echo "Rate Limited (429): $rate_limited_count (Expected: 70)"
echo "Other: $other_count"
