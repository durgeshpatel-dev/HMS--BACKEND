# Database Reference — Hotel Management System

## ORM: Prisma
- **Provider:** PostgreSQL
- **Schema file:** `HMS--BACKEND/prisma/schema.prisma`
- **Client:** `@prisma/client` with `@prisma/adapter-pg`

All table names use **snake_case** via `@@map()`. Prisma model names are **PascalCase**.

---

## Tables

### `restaurants`
The top-level tenant record. Every other record belongs to a restaurant.

| Column | Type | Notes |
|---|---|---|
| `id` | Int (PK) | Auto-increment |
| `name` | VarChar(255) | Restaurant name |
| `email` | VarChar(255) | Unique |
| `phone` | VarChar(20) | |
| `address` | Text | Optional |
| `settings` | JSON | Currency, tax %, operating hours, features |
| `created_at` | DateTime | |
| `updated_at` | DateTime | Auto-update |

**Default settings JSON:**
```json
{
  "currency": "INR",
  "taxPercentage": 5,
  "gstNumber": "",
  "operating_hours": {},
  "features": {
    "table_service": true,
    "parcel_orders": true,
    "online_orders": false
  }
}
```

> **Key naming:** Use `taxPercentage` (camelCase). Older rows may have `tax_percentage` (snake_case) — all code reads both via `settings?.taxPercentage ?? settings?.tax_percentage ?? 5` for backwards compatibility.
> **`gstNumber`** is stored in this JSON (not a separate DB column). It prints on the bill as "GSTIN: ...". Max 20 characters.

---

### `users`
Manager/Admin accounts for the Web Dashboard.

| Column | Type | Notes |
|---|---|---|
| `id` | Int (PK) | |
| `restaurant_id` | Int (FK → restaurants) | |
| `email` | VarChar(255) | Unique |
| `password_hash` | VarChar(255) | bcrypt hash |
| `name` | VarChar(255) | |
| `phone` | VarChar(20) | Optional |
| `role` | VarChar(50) | `super_admin`, `manager` |
| `status` | VarChar(50) | `pending_approval`, `active`, `rejected`, `suspended` |
| `last_login` | DateTime | Optional |

> ⚠️ New signups start as `pending_approval`. A super_admin must activate them.

---

### `staff`
Waiter and Cook accounts for the Mobile App.

| Column | Type | Notes |
|---|---|---|
| `id` | Int (PK) | |
| `restaurant_id` | Int (FK → restaurants) | |
| `name` | VarChar(255) | |
| `phone` | VarChar(20) | **Unique** — used as login identifier |
| `pin_hash` | VarChar(255) | bcrypt hash of 4-digit PIN |
| `role` | VarChar(50) | `waiter`, `cook` |
| `is_active` | Boolean | Default: `true` |
| `last_login` | DateTime | Optional |

---

### `categories`
Menu categories (e.g., Starters, Main Course, Beverages).

| Column | Type | Notes |
|---|---|---|
| `id` | Int (PK) | |
| `restaurant_id` | Int (FK → restaurants) | |
| `name` | VarChar(255) | |
| `description` | Text | Optional |
| `display_order` | Int | For UI sorting |
| `is_active` | Boolean | Default: `true` |

---

### `menu_items`
Individual menu items.

| Column | Type | Notes |
|---|---|---|
| `id` | Int (PK) | |
| `restaurant_id` | Int (FK → restaurants) | |
| `category_id` | Int (FK → categories) | Optional, SetNull on delete |
| `name` | VarChar(255) | |
| `description` | Text | Optional |
| `price` | Decimal(10,2) | |
| `image_url` | Text | Optional, path to uploaded image |
| `preparation_time` | Int | Minutes |
| `is_vegetarian` | Boolean | Default: `false` |
| `is_available` | Boolean | Default: `true` |
| `customizations` | JSON | Array: `[{name, options:[]}]` |

---

### `tables`
Physical tables in the restaurant.

| Column | Type | Notes |
|---|---|---|
| `id` | Int (PK) | |
| `restaurant_id` | Int (FK → restaurants) | |
| `table_number` | VarChar(50) | Unique per restaurant |
| `capacity` | Int | Default: 4 |
| `location` | VarChar(100) | `Indoor`, `Outdoor`, `VIP` |
| `status` | VarChar(50) | `available`, `occupied`, `reserved`, `billing`, `cleaning` |
| `current_order_id` | Int (FK → orders) | Unique — current active order |

---

### `orders`
Core transaction record.

| Column | Type | Notes |
|---|---|---|
| `id` | Int (PK) | |
| `restaurant_id` | Int (FK → restaurants) | |
| `table_id` | Int (FK → tables) | Nullable (parcel orders) |
| `order_number` | VarChar(50) | **Unique** — e.g. `ORD-2026-0001` |
| `order_type` | VarChar(50) | `dine_in`, `parcel` |
| `status` | VarChar(50) | See state machine below |
| `kitchen_status` | VarChar(50) | `pending`, `preparing`, `ready` |
| `customer_name` | VarChar(255) | Optional |
| `customer_phone` | VarChar(20) | Optional |
| `waiter_id` | Int (FK → staff) | Optional |
| `subtotal` | Decimal(10,2) | |
| `tax_amount` | Decimal(10,2) | |
| `discount_amount` | Decimal(10,2) | Default: 0 |
| `total_amount` | Decimal(10,2) | |
| `special_notes` | Text | Optional |
| `completed_at` | DateTime | Optional |

**Order Status Values:**
`pending` → `confirmed` → `preparing` → `ready` → `served` → `billing` → `completed`
`pending` / `confirmed` → `cancelled`

---

### `order_items`
Individual line items within an order.

| Column | Type | Notes |
|---|---|---|
| `id` | Int (PK) | |
| `order_id` | Int (FK → orders, CASCADE) | |
| `menu_item_id` | Int (FK → menu_items, RESTRICT) | Cannot delete item if used in order |
| `restaurant_id` | Int (FK → restaurants) | Denormalized for performance |
| `quantity` | Int | Default: 1 |
| `unit_price` | Decimal(10,2) | Price at time of order |
| `customizations` | JSON | `{"spice": "medium", "extras": [...]}` |
| `subtotal` | Decimal(10,2) | `quantity * unit_price` |

---

### `bills`
One bill per order (1:1 relationship).

| Column | Type | Notes |
|---|---|---|
| `id` | Int (PK) | |
| `restaurant_id` | Int (FK → restaurants) | |
| `order_id` | Int (FK → orders, CASCADE) | **Unique** |
| `bill_number` | VarChar(50) | **Unique** |
| `subtotal` | Decimal(10,2) | |
| `tax_amount` | Decimal(10,2) | |
| `discount_percentage` | Decimal(5,2) | Default: 0 (used for manager-entered % discount) |
| `discount_amount` | Decimal(10,2) | Default: 0 |
| `extra_charges` | Decimal(10,2) | Default: 0 (e.g., packaging/delivery/manual charges) |
| `total_amount` | Decimal(10,2) | |
| `payment_status` | VarChar(50) | `unpaid`, `partial`, `paid` |

---

### `payments`
Payment records associated with a bill (supports partial/split payments).

| Column | Type | Notes |
|---|---|---|
| `id` | Int (PK) | |
| `restaurant_id` | Int (FK → restaurants) | |
| `bill_id` | Int (FK → bills, CASCADE) | |
| `amount` | Decimal(10,2) | |
| `payment_method` | VarChar(50) | `cash`, `card`, `upi` |
| `transaction_id` | VarChar(255) | Optional (for card/UPI) |
| `status` | VarChar(50) | `success`, `failed`, `pending` |

---

## Entity Relationships

```
Restaurant (1) ─── (N) User
Restaurant (1) ─── (N) Staff
Restaurant (1) ─── (N) Category
Restaurant (1) ─── (N) MenuItem
Restaurant (1) ─── (N) Table
Restaurant (1) ─── (N) Order
Restaurant (1) ─── (N) Bill
Restaurant (1) ─── (N) Payment

Category (1) ─── (N) MenuItem
Table (1) ─── (N) Order
Order (1) ─── (N) OrderItem
Order (1) ─── (1) Bill
Bill (1) ─── (N) Payment
MenuItem (1) ─── (N) OrderItem
Staff (1) ─── (N) Order  [as waiter]
```

---

## Important Notes
- `unit_price` is **stored at order time** — price changes on menu items do NOT affect existing orders.
- `current_order_id` on `Table` is a unique FK pointing to the active order — it's set when the order is created and cleared when the order completes.
- `OrderItem` uses `onDelete: Restrict` for `menuItemId` — you **cannot delete a menu item** that exists in any order.
- All tables cascade delete from `Restaurant` — deleting a restaurant removes all related data.
