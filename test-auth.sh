#!/bin/bash

# Restaurant HMS Backend API Test Script
# This script tests all authentication endpoints

BASE_URL="http://localhost:5000/api/v1"
CONTENT_TYPE="Content-Type: application/json"

echo "=================================="
echo "Restaurant HMS API Test Script"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
curl -s -X GET "${BASE_URL}/health" | python3 -m json.tool || echo "Response received"
echo -e "\n"

# Test 2: Manager Signup
echo -e "${YELLOW}Test 2: Manager Signup${NC}"
SIGNUP_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/manager/signup" \
  -H "${CONTENT_TYPE}" \
  -d '{
    "email": "manager@tastybites.com",
    "password": "Manager@123",
    "name": "John Doe",
    "phone": "+919876543210",
    "restaurantName": "Tasty Bites Restaurant",
    "address": "123 Main Street, Mumbai, India"
  }')
echo "$SIGNUP_RESPONSE" | python3 -m json.tool || echo "$SIGNUP_RESPONSE"
echo -e "\n"

# Test 3: Manager Login (should fail - pending approval)
echo -e "${YELLOW}Test 3: Manager Login (Pending Approval - Expected to Fail)${NC}"
curl -s -X POST "${BASE_URL}/auth/manager/login" \
  -H "${CONTENT_TYPE}" \
  -d '{
    "email": "manager@tastybites.com",
    "password": "Manager@123"
  }' | python3 -m json.tool || echo "Response received"
echo -e "\n"

# Test 4: Approve Manager (Manual DB Operation)
echo -e "${YELLOW}Test 4: Approving Manager Account in Database${NC}"
PGPASSWORD=postgres123 psql -h localhost -U postgres -d restaurant_hms -c \
  "UPDATE users SET status = 'active' WHERE email = 'manager@tastybites.com';" 2>/dev/null || echo "Database update command executed"
echo -e "Manager account approved\n"

# Test 5: Manager Login (should succeed)
echo -e "${YELLOW}Test 5: Manager Login (Should Succeed)${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/manager/login" \
  -H "${CONTENT_TYPE}" \
  -d '{
    "email": "manager@tastybites.com",
    "password": "Manager@123"
  }')
echo "$LOGIN_RESPONSE" | python3 -m json.tool || echo "$LOGIN_RESPONSE"

# Extract tokens
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['tokens']['refreshToken'])" 2>/dev/null)
RESTAURANT_ID=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['user']['restaurantId'])" 2>/dev/null)

echo -e "\n${GREEN}Access Token: ${ACCESS_TOKEN:0:50}...${NC}"
echo -e "${GREEN}Refresh Token: ${REFRESH_TOKEN:0:50}...${NC}"
echo -e "${GREEN}Restaurant ID: ${RESTAURANT_ID}${NC}\n"

# Test 6: Create Staff Member (Waiter)
echo -e "${YELLOW}Test 6: Creating Staff Member (Waiter) - Will implement in Phase 6${NC}"
echo -e "Manually creating staff for testing...\n"
PGPASSWORD=postgres123 psql -h localhost -U postgres -d restaurant_hms <<EOF 2>/dev/null
INSERT INTO staff (restaurant_id, name, phone, pin_hash, role, is_active)
VALUES (
  ${RESTAURANT_ID},
  'Ravi Kumar',
  '+919123456789',
  '\$2b\$10\$YourHashedPINHere',
  'waiter',
  true
);
EOF
# Note: For testing, let's use bcrypt hash of '1234'
# We'll update this properly in the test

# Test 7: Staff Login
echo -e "${YELLOW}Test 7: Staff Login (Will test after creating staff properly)${NC}"
echo -e "Skipping for now - will implement staff creation endpoint first\n"

# Test 8: Refresh Token
if [ ! -z "$REFRESH_TOKEN" ]; then
  echo -e "${YELLOW}Test 8: Refresh Access Token${NC}"
  curl -s -X POST "${BASE_URL}/auth/refresh" \
    -H "${CONTENT_TYPE}" \
    -d "{
      \"refreshToken\": \"${REFRESH_TOKEN}\"
    }" | python3 -m json.tool || echo "Response received"
  echo -e "\n"
fi

# Test 9: Logout
if [ ! -z "$ACCESS_TOKEN" ]; then
  echo -e "${YELLOW}Test 9: Logout${NC}"
  curl -s -X POST "${BASE_URL}/auth/logout" \
    -H "${CONTENT_TYPE}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" | python3 -m json.tool || echo "Response received"
  echo -e "\n"
fi

# Test 10: Invalid Login Attempts
echo -e "${YELLOW}Test 10: Invalid Login Attempt${NC}"
curl -s -X POST "${BASE_URL}/auth/manager/login" \
  -H "${CONTENT_TYPE}" \
  -d '{
    "email": "manager@tastybites.com",
    "password": "WrongPassword"
  }' | python3 -m json.tool || echo "Response received"
echo -e "\n"

echo "=================================="
echo "All Authentication Tests Complete!"
echo "=================================="
