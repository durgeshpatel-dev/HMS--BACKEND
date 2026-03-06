#!/bin/bash

# Restaurant HMS Backend - Authentication Testing Script
# This script tests all authentication endpoints

BASE_URL="http://localhost:5000/api/v1"
HEALTH_URL="http://localhost:5000/health"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================"
echo "Restaurant HMS Backend API Tests"
echo "================================"
echo

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$HEALTH_URL" -m 5)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ Health check failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo

# Test 2: Manager Signup
echo -e "${YELLOW}Test 2: Manager Signup${NC}"
MANAGER_EMAIL="manager_test_$(date +%s)@restaurant.com"
SIGNUP_DATA=$(cat <<EOF
{
  "email": "$MANAGER_EMAIL",
  "password": "Test1234",
  "name": "Test Manager",
  "phone": "+919876543210",
  "restaurantName": "Test Restaurant",
  "restaurantAddress": "123 Test Street, Test City",
  "restaurantPhone": "+919876543211"
}
EOF
)

SIGNUP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/manager/signup" \
  -H "Content-Type: application/json" \
  -d "$SIGNUP_DATA" \
  -m 10)

HTTP_CODE=$(echo "$SIGNUP_RESPONSE" | tail -n 1)
BODY=$(echo "$SIGNUP_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
    echo -e "${GREEN}✓ Manager signup successful${NC}"
    echo "Response: $BODY"
    USER_ID=$(echo "$BODY" | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)
    echo "Manager Email: $MANAGER_EMAIL"
    echo "User ID: $USER_ID"
else
    echo -e "${RED}✗ Manager signup failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo

# Test 3: Manager Login (Pending Status)
echo -e "${YELLOW}Test 3: Manager Login (Should fail - Pending Approval)${NC}"
LOGIN_DATA=$(cat <<EOF
{
  "email": "$MANAGER_EMAIL",
  "password": "Test1234"
}
EOF
)

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/manager/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_DATA" \
  -m 10)

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n 1)
BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "403" ]; then
    echo -e "${GREEN}✓ Correctly rejected pending account${NC}"
    echo "Response: $BODY"
else
    echo -e "${YELLOW}⚠ Unexpected response (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo

# Instructions for manual approval
echo -e "${YELLOW}════════════════════════════════════${NC}"
echo -e "${YELLOW}MANUAL STEP REQUIRED:${NC}"
echo -e "${YELLOW}════════════════════════════════════${NC}"
echo
echo "To approve the manager account, run this SQL command:"
echo
echo -e "${GREEN}psql -U postgres -d restaurant_hms -c \"UPDATE users SET status = 'active' WHERE email = '$MANAGER_EMAIL';\"${NC}"
echo
echo "Or connect to PostgreSQL and run:"
echo -e "${GREEN}UPDATE users SET status = 'active' WHERE email = '$MANAGER_EMAIL';${NC}"
echo
echo "After approval, run this test again to test manager login."
echo

# Test 4: Invalid Login
echo -e "${YELLOW}Test 4: Invalid Login Credentials${NC}"
INVALID_LOGIN_DATA=$(cat <<EOF
{
  "email": "wrong@email.com",
  "password": "WrongPass123"
}
EOF
)

INVALID_LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/manager/login" \
  -H "Content-Type: application/json" \
  -d "$INVALID_LOGIN_DATA" \
  -m 10)

HTTP_CODE=$(echo "$INVALID_LOGIN_RESPONSE" | tail -n 1)
BODY=$(echo "$INVALID_LOGIN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Correctly rejected invalid credentials${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ Unexpected response (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo

# Test 5: Validation Errors
echo -e "${YELLOW}Test 5: Validation Error (Weak Password)${NC}"
WEAK_PASSWORD_DATA=$(cat <<EOF
{
  "email": "test@test.com",
  "password": "weak",
  "name": "Test",
  "phone": "+919876543210",
  "restaurantName": "Test Restaurant",
  "restaurantAddress": "Test Address",
  "restaurantPhone": "+919876543211"
}
EOF
)

VALIDATION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/manager/signup" \
  -H "Content-Type: application/json" \
  -d "$WEAK_PASSWORD_DATA" \
  -m 10)

HTTP_CODE=$(echo "$VALIDATION_RESPONSE" | tail -n 1)
BODY=$(echo "$VALIDATION_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "${GREEN}✓ Correctly rejected weak password${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ Unexpected response (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo

echo "================================"
echo "Testing Complete"
echo "================================"
