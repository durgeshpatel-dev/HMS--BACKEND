# API Reference — Hotel Management System

## Base URL
```
http://localhost:5000/api/v1
```

## Authentication
All protected endpoints require a Bearer JWT token in the header:
```
Authorization: Bearer <access_token>
```

### Role-Based Access
- `manager` — Web Dashboard users (email + password login)
- `waiter` — Mobile App staff
- `cook` — Mobile App kitchen staff
- `super_admin` — Super-level manager (same as manager + extra permissions)

---

## Health Check

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Server health check |
| GET | `/api/v1/health` | None | API health check |

---

## Auth Endpoints — `/api/v1/auth`

### Manager Signup
```
POST /auth/manager/signup
Body: { restaurantName, email, password, phone, restaurantAddress? }
Response: { success, message }
Note: Account starts as 'pending_approval' — needs approval before login
```

### Manager Login
```
POST /auth/manager/login
Body: { email, password }
Response: { success, data: { user: { id, name, email, role, restaurantId }, tokens: { accessToken, refreshToken, expiresIn } } }
```

### Staff Login (Waiter / Cook)
```
POST /auth/staff/login
Body: { phone, pin }
Response: { success, data: { user: { id, name, phone, role, restaurantId }, tokens: { accessToken, refreshToken, expiresIn } } }
```

### Refresh Token
```
POST /auth/refresh
Body: { refreshToken }
Response: { success, data: { accessToken } }
```

### Logout
```
POST /auth/logout
Auth: Required
Response: { success, message }
```

---

## Menu Endpoints — `/api/v1/menu`

### Categories
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/menu/categories` | All | Get all categories |
| GET | `/menu/categories/:id` | All | Get category by ID |
| POST | `/menu/categories` | manager | Create category |
| PUT | `/menu/categories/:id` | manager | Update category |
| DELETE | `/menu/categories/:id` | manager | Delete category |

### Menu Items
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/menu/items` | All | Get all menu items |
| GET | `/menu/items/:id` | All | Get item by ID |
| POST | `/menu/items` | manager | Create menu item |
| PUT | `/menu/items/:id` | manager | Update menu item |
| DELETE | `/menu/items/:id` | manager | Delete menu item |
| PATCH | `/menu/items/:id/availability` | manager | Toggle item availability |

**Create/Update Menu Item Body:**
```json
{
  "categoryId": 2,
  "name": "Butter Chicken",
  "description": "...",
  "price": 280.00,
  "preparationTime": 15,
  "isVegetarian": false,
  "isAvailable": true,
  "customizations": [
    { "name": "Spice Level", "options": ["Mild", "Medium", "Spicy"] }
  ]
}
```

---

## Table Endpoints — `/api/v1/tables`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/tables` | All | Get all tables |
| GET | `/tables/available` | All | Get available tables only |
| GET | `/tables/stats` | All | Table occupancy stats |
| GET | `/tables/:id` | All | Get table by ID |
| POST | `/tables` | manager | Create table |
| PUT | `/tables/:id` | manager | Update table |
| PATCH | `/tables/:id/status` | All | Update table status |
| DELETE | `/tables/:id` | manager | Delete table |

**Table Status Values:** `available`, `occupied`, `reserved`, `billing`, `cleaning`

---

## Order Endpoints — `/api/v1/orders`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/orders` | All | Get all orders |
| GET | `/orders/kitchen` | All | Get kitchen orders (pending/preparing/ready) |
| GET | `/orders/my-orders` | waiter | Get waiter's own orders |
| GET | `/orders/:id` | All | Get order by ID |
| POST | `/orders` | waiter, manager | Create new order |
| PUT | `/orders/:id` | All | Update order (status, items, notes) |
| POST | `/orders/:id/items` | waiter, manager | Add items to existing order |
| PUT | `/orders/:orderId/items/:itemId` | All | Update specific order item |
| DELETE | `/orders/:orderId/items/:itemId` | waiter, manager | Remove order item |
| POST | `/orders/:id/cancel` | waiter, manager | Cancel an order |
| POST | `/orders/billing-request` | waiter, manager | Send billing request to manager |

**Create Order Body:**
```json
{
  "tableId": 3,
  "orderType": "dine_in",
  "customerName": null,
  "customerPhone": null,
  "items": [
    {
      "menuItemId": 12,
      "quantity": 2,
      "customizations": { "spice": "medium" }
    }
  ],
  "specialNotes": "No onions"
}
```

**Update Order Body:**
```json
{
  "status": "ready",
  "kitchenStatus": "ready",
  "specialNotes": "..."
}
```

**Order Status Values:** `pending`, `confirmed`, `preparing`, `ready`, `served`, `billing`, `completed`, `cancelled`

---

## Bill Endpoints — `/api/v1/bills`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/bills` | All | List bills (query: status, startDate, endDate) |
| GET | `/bills/order/:orderId` | All | Get bill for specific order |
| GET | `/bills/:id` | All | Get bill by ID |
| POST | `/bills/order/:orderId/generate` | manager, waiter | Generate bill for an order |
| POST | `/bills/:id/payment` | manager, waiter | Record payment against a bill |

**Generate Bill Body:**
```json
{
  "discountPercentage": 10,
  "discountAmount": 120,
  "extraCharges": 20
}
```

Notes:
- `discountPercentage` is the primary manager input in dashboard flows.
- `discountAmount` is still accepted for backward compatibility.
- `extraCharges` is optional and used for manual charges like packaging.

**Record Payment Body:**
```json
{
  "amount": 450.00,
  "paymentMethod": "cash",
  "transactionId": null
}
```

**Payment Method Values:** `cash`, `card`, `upi`

**Bill Payment Status Values:** `unpaid`, `partial`, `paid`

---

## Manager Endpoints — `/api/v1/manager`
> Access: `manager`, `super_admin` only

| Method | Path | Description |
|---|---|---|
| GET | `/manager/staff` | Get all staff |
| POST | `/manager/staff` | Create staff member |
| PUT | `/manager/staff/:id` | Update staff member |
| DELETE | `/manager/staff/:id` | Delete staff member |

**Create Staff Body:**
```json
{
  "name": "Rahul",
  "phone": "9876543210",
  "pin": "1234",
  "role": "waiter"
}
```

---

## Settings Endpoints — `/api/v1/settings`
> Access: `manager`, `super_admin` only

| Method | Path | Description |
|---|---|---|
| GET | `/settings` | Get restaurant settings |
| PUT | `/settings/info` | Update restaurant info (name, phone, address) |
| PUT | `/settings` | Update restaurant settings (tax, GST, features, hours) |

---

## Analytics Endpoints — `/api/v1/analytics`
> Access: `manager`, `super_admin` only

| Method | Path | Description |
|---|---|---|
| GET | `/analytics/sales` | Sales analytics (query: startDate, endDate) |
| GET | `/analytics/top-items` | Top selling menu items |
| GET | `/analytics/order-summary` | Order count by status |
| GET | `/analytics/payment-breakdown` | Revenue by payment method |
| GET | `/analytics/waiter-performance` | Orders per waiter |

---

## Upload Endpoints — `/api/v1/upload`
- `POST /upload` — Upload file (multipart/form-data, field name: `file`)
- `DELETE /upload` — Delete uploaded file (body: `{ filename }`)
- Images served at: `http://localhost:5000/uploads/<filename>`

---

## Standard Response Format

### Success
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ]
}
```
