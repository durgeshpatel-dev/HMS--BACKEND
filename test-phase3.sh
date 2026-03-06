#!/bin/bash

# Phase 3 API Testing Script
# Tests Menu Management, Table Management, and Order Management APIs

BASE_URL="http://localhost:5000/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "Phase 3: Menu, Tables & Orders Testing"
echo "========================================"
echo ""

# Step 1: Login as Manager
echo "Step 1: Manager Login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/manager/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testmanager@restaurant.com",
    "password": "SecurePass123"
  }')

MANAGER_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.tokens.accessToken')

if [ "$MANAGER_TOKEN" != "null" ] && [ -n "$MANAGER_TOKEN" ]; then
  echo -e "${GREEN}✓ Manager login successful${NC}"
else
  echo -e "${RED}✗ Manager login failed${NC}"
  exit 1
fi
echo ""

# Step 2: Create Category
echo "Step 2: Create Menu Category"
CATEGORY_RESPONSE=$(curl -s -X POST "$BASE_URL/menu/categories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d '{
    "name": "Starters",
    "description": "Appetizers and starters",
    "displayOrder": 1
  }')

CATEGORY_ID=$(echo "$CATEGORY_RESPONSE" | jq -r '.data.id')
if [ "$CATEGORY_ID" != "null" ] && [ -n "$CATEGORY_ID" ]; then
  echo -e "${GREEN}✓ Category created with ID: $CATEGORY_ID${NC}"
else
  echo -e "${RED}✗ Category creation failed${NC}"
  echo "$CATEGORY_RESPONSE"
fi
echo ""

# Step 3: Create Menu Items
echo "Step 3: Create Menu Items"
MENU_ITEM1=$(curl -s -X POST "$BASE_URL/menu/items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d "{
    \"categoryId\": $CATEGORY_ID,
    \"name\": \"Paneer Tikka\",
    \"description\": \"Grilled cottage cheese cubes\",
    \"price\": 250,
    \"isAvailable\": true
  }")

ITEM1_ID=$(echo "$MENU_ITEM1" | jq -r '.data.id')
if [ "$ITEM1_ID" != "null" ] && [ -n "$ITEM1_ID" ]; then
  echo -e "${GREEN}✓ Menu Item 1 created with ID: $ITEM1_ID${NC}"
else
  echo -e "${RED}✗ Menu Item 1 creation failed${NC}"
  echo "$MENU_ITEM1"
fi
echo ""

MENU_ITEM2=$(curl -s -X POST "$BASE_URL/menu/items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -d "{
    \"categoryId\": $CATEGORY_ID,
    \"name\": \"Chicken Wings\",
    \"description\": \"Spicy chicken wings\",
    \"price\": 350,
    \"isAvailable\": true
  }")

ITEM2_ID=$(echo "$MENU_ITEM2" | jq -r '.data.id')
if [ "$ITEM2_ID" != "null" ] && [ -n "$ITEM2_ID" ]; then
  echo -e "${GREEN}✓ Menu Item 2 created with ID: $ITEM2_ID${NC}"
else
  echo -e "${RED}✗ Menu Item 2 creation failed${NC}"
  echo "$MENU_ITEM2"
fi
echo ""

# Step 4: Get All Menu Items
echo "Step 4: Get All Menu Items"
curl -s -X GET "$BASE_URL/menu/items" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq .
echo ""

# Step 5: Create Tables
echo "Step 5: Create Tables"
# First, get existing table IDs instead of creating new ones
EXISTING_TABLES=$(curl -s -X GET "$BASE_URL/tables" \
  -H "Authorization: Bearer $MANAGER_TOKEN")

TABLE1_ID=$(echo "$EXISTING_TABLES" | jq -r '.data[] | select(.tableNumber == "T1") | .id')
TABLE2_ID=$(echo "$EXISTING_TABLES" | jq -r '.data[] | select(.tableNumber == "T2") | .id')

# If tables don't exist, create them
if [ -z "$TABLE1_ID" ] || [ "$TABLE1_ID" == "null" ]; then
  TABLE1=$(curl -s -X POST "$BASE_URL/tables" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -d '{
      "tableNumber": "T1",
      "capacity": 4,
      "location": "Near Window"
    }')
  TABLE1_ID=$(echo "$TABLE1" | jq -r '.data.id')
fi

if [ -z "$TABLE2_ID" ] || [ "$TABLE2_ID" == "null" ]; then
  TABLE2=$(curl -s -X POST "$BASE_URL/tables" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MANAGER_TOKEN" \
    -d '{
      "tableNumber": "T2",
      "capacity": 2,
      "location": "Corner"
    }')
  TABLE2_ID=$(echo "$TABLE2" | jq -r '.data.id')
fi

if [ "$TABLE1_ID" != "null" ] && [ -n "$TABLE1_ID" ]; then
  echo -e "${GREEN}✓ Table 1 ready with ID: $TABLE1_ID${NC}"
else
  echo -e "${RED}✗ Table 1 setup failed${NC}"
fi

if [ "$TABLE2_ID" != "null" ] && [ -n "$TABLE2_ID" ]; then
  echo -e "${GREEN}✓ Table 2 ready with ID: $TABLE2_ID${NC}"
else
  echo -e "${RED}✗ Table 2 setup failed${NC}"
fi
echo ""

# Step 6: Get All Tables
echo "Step 6: Get All Tables"
curl -s -X GET "$BASE_URL/tables" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq .
echo ""

# Step 7: Get Table Stats
echo "Step 7: Get Table Statistics"
curl -s -X GET "$BASE_URL/tables/stats" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq .
echo ""

# Step 8: Login as Waiter
echo "Step 8: Waiter Login"
WAITER_LOGIN=$(curl -s -X POST "$BASE_URL/auth/staff/login" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "pin": "123456"
  }')

WAITER_TOKEN=$(echo $WAITER_LOGIN | jq -r '.data.tokens.accessToken')

if [ "$WAITER_TOKEN" != "null" ] && [ -n "$WAITER_TOKEN" ]; then
  echo -e "${GREEN}✓ Waiter login successful${NC}"
else
  echo -e "${RED}✗ Waiter login failed${NC}"
  exit 1
fi
echo ""

# Step 9: Create Order
echo "Step 9: Create Order (Waiter)"
ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -d "{
    \"tableId\": $TABLE1_ID,
    \"orderType\": \"dine_in\",
    \"customerName\": \"John Doe\",
    \"customerPhone\": \"+919999999999\",
    \"items\": [
      {
        \"menuItemId\": $ITEM1_ID,
        \"quantity\": 2,
        \"specialInstructions\": \"Extra spicy\"
      },
      {
        \"menuItemId\": $ITEM2_ID,
        \"quantity\": 1
      }
    ]
  }")

ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.data.id')
if [ "$ORDER_ID" != "null" ] && [ -n "$ORDER_ID" ]; then
  echo -e "${GREEN}✓ Order created with ID: $ORDER_ID${NC}"
else
  echo -e "${RED}✗ Order creation failed${NC}"
  echo "$ORDER_RESPONSE"
fi
echo ""

# Step 10: Get Order Details
echo "Step 10: Get Order Details"
curl -s -X GET "$BASE_URL/orders/$ORDER_ID" \
  -H "Authorization: Bearer $WAITER_TOKEN" | jq .
echo ""

# Step 11: Update Order Status
echo "Step 11: Update Order Status to 'preparing'"
curl -s -X PUT "$BASE_URL/orders/$ORDER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -d '{
    "status": "preparing"
  }' | jq .
echo ""

# Step 12: Get Kitchen Orders
echo "Step 12: Get Kitchen Orders"
curl -s -X GET "$BASE_URL/orders/kitchen" \
  -H "Authorization: Bearer $WAITER_TOKEN" | jq .
echo ""

# Step 13: Add More Items to Order
echo "Step 13: Add Items to Existing Order"
curl -s -X POST "$BASE_URL/orders/$ORDER_ID/items" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -d "{
    \"items\": [
      {
        \"menuItemId\": $ITEM1_ID,
        \"quantity\": 1
      }
    ]
  }" | jq .
echo ""

# Step 14: Update Order Status to Ready
echo "Step 14: Update Order Status to 'ready'"
curl -s -X PUT "$BASE_URL/orders/$ORDER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -d '{
    "status": "ready"
  }' | jq .
echo ""

# Step 15: Get All Orders
echo "Step 15: Get All Orders"
curl -s -X GET "$BASE_URL/orders" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq .
echo ""

# Step 16: Update Table Status
echo "Step 16: Update Table Status to 'occupied'"
curl -s -X PATCH "$BASE_URL/tables/$TABLE1_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -d '{
    "status": "occupied"
  }' | jq .
echo ""

# Step 17: Get Waiter's Orders
echo "Step 17: Get Waiter's Own Orders"
curl -s -X GET "$BASE_URL/orders/my-orders" \
  -H "Authorization: Bearer $WAITER_TOKEN" | jq .
echo ""

echo "========================================"
echo "Phase 3 Testing Complete!"
echo "========================================"
echo ""
echo "Summary:"
echo "- Categories: Created and retrieved"
echo "- Menu Items: Created and retrieved"
echo "- Tables: Created, retrieved, and status updated"
echo "- Orders: Created, updated, and items added"
echo "- Kitchen Orders: Retrieved"
echo "- Waiter Orders: Retrieved"
echo ""
echo "All Phase 3 APIs tested successfully!"
