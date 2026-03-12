# System Flow — Complete Order Lifecycle

## Overview
This document describes the **exact sequence of events** from when a customer sits at a table to when payment is collected. Every participant (Waiter, Cook, Manager) and every technical layer (Mobile App, Backend API, Socket.IO, Database) is shown.

---

## Step-by-Step Order Lifecycle

### Step 1 — Waiter Selects a Table
- **Actor:** Waiter (Mobile App)
- **Action:** Opens the Tables tab, sees a grid of tables with status (available / occupied / reserved / billing / cleaning)
- **API Call:** `GET /api/v1/tables` — fetches all tables for the restaurant
- **UI:** Waiter taps an **available** table

---

### Step 2 — Waiter Creates an Order
- **Actor:** Waiter (Mobile App)
- **Action:** Navigates to `create-order.tsx`, browses menu categories and items, selects items with optional customizations and quantities
- **API Call:** `GET /api/v1/menu/categories` + `GET /api/v1/menu/items`

---

### Step 3 — Order Submitted to Backend
- **Actor:** Waiter (Mobile App)
- **Action:** Taps "Place Order"
- **API Call:** `POST /api/v1/orders`
  ```json
  {
    "tableId": 3,
    "orderType": "dine_in",
    "items": [
      { "menuItemId": 12, "quantity": 2, "customizations": { "spice": "medium" } }
    ],
    "specialNotes": "No onions"
  }
  ```
- **Backend Action:**
  1. Creates `Order` record (status: `pending` for waiter-created orders, `preparing` for manager-created orders)
  2. Creates `OrderItem` records
  3. Updates `Table.status` to `occupied`
  4. Emits `order:created` via Socket.IO to `restaurant:{id}` room

---

### Step 4 — Kitchen Receives the Order
- **Actor:** Cook (Mobile App — kitchen tab)
- **Real-time:** Cook's app receives `order:created` socket event
- **UI:** New order card appears on the Kitchen board with item list, table number, and special notes
- **API:** Kitchen also polls `GET /api/v1/orders/kitchen` on load/reconnect

---

### Step 5 — Cook Prepares and Updates Status
- **Actor:** Cook (Mobile App)
- **Action:** Taps "Start Preparing" → order status moves to `preparing`
- **Socket Event Sent:** `order:updateStatus` → `{ orderId, status: "preparing" }`
- **Backend Action:** Updates `Order.status` + `Order.kitchenStatus`, emits `order:updated`

---

### Step 6 — Cook Marks Order as Ready
- **Actor:** Cook (Mobile App)
- **Action:** Taps "Mark Ready" → `PUT /api/v1/orders/:id` with `{ status: "ready" }`
- **Backend Action:**
  1. Updates `Order.status` to `ready`, `Order.kitchenStatus` to `ready`
  2. Emits `order:updated` to all clients
- **Notification:** Waiter's app receives socket event and shows in-app notification "Order #X is ready for Table Y"

---

### Step 7 — Waiter Serves the Order
- **Actor:** Waiter (Mobile App)
- **Action:** Picks up ready order from kitchen and serves to the customer's table
- **Optional API Call:** Waiter can tap "Mark Served" on the order detail screen
  - `PUT /api/v1/orders/:id` with `{ status: "served" }`
  - Backend emits `order:updated` to all clients

---

### Step 8 — Waiter Completes the Order (sends to billing)
- **Actor:** Waiter (Mobile App — `order/[orderId].tsx`)
- **Action:** Taps **"Complete Order"** button
- **API Calls (in sequence):**
  1. `PATCH /api/v1/tables/:id/status` with `{ status: "billing" }` — marks table as billing
  2. `PUT /api/v1/orders/:id` with `{ status: "billing" }` — for each order on the table
- **Backend Action:** Updates all orders and table to `billing` status, emits `order:updated` + `table:updated`
- **Mobile UI:** Waiter now sees a **read-only Bill Summary** panel showing all items, subtotal, and GST. A **"Send to Manager"** button appears.

> ⚠️ **WAITER CANNOT GENERATE A BILL OR PROCESS PAYMENT.** This is the manager's responsibility only.

---

### Step 9 — Waiter Notifies Manager for Billing
- **Actor:** Waiter (Mobile App)
- **Action:** Taps **"Send to Manager"** button on the bill summary
- **API Call:** `POST /api/v1/orders/billing-request`
  ```json
  {
    "tableId": 3,
    "orderId": 45,
    "tableLabel": "Table 3",
    "waiterName": "Ravi",
    "itemCount": 4,
    "total": 450.00
  }
  ```
- **Backend Action:** Emits `billing:request` socket event to manager's dashboard
- **Manager UI:** Toast notification appears: "🔔 Table 3 — Ravi requests billing!"
- **Waiter UI:** Waiter is redirected back to the Tables screen

---

### Step 10 — Manager Generates the Bill
- **Actor:** Manager (Web Dashboard — Billing Dashboard page)
- **Action:** Sees the billing request notification (toast + notification panel) → Navigates to Billing Dashboard → Selects the table (shown with purple "Billing" status) → Clicks **"Generate Bill"**
- **API Call:** `POST /api/v1/bills/order/:orderId/generate`
  ```json
  {
    "discountPercentage": 10,
    "discountAmount": 120,
    "extraCharges": 20
  }
  ```
- **Backend Action:**
  1. Calculates `subtotal`, `taxAmount`, `totalAmount`
  2. Creates `Bill` record (`paymentStatus: "unpaid"`)
  3. Updates `Order.status` to `billing`
  4. Emits `bill:updated` + `order:updated` events

---

### Step 11 — Manager Records Payment
- **Actor:** Manager (Web Dashboard)
- **Action:** Customer pays → Manager clicks "Mark as Paid"
- **API Call:** `POST /api/v1/bills/:id/payment`
  ```json
  {
    "amount": 450.00,
    "paymentMethod": "cash"
  }
  ```
- **Backend Action:**
  1. Creates `Payment` record
  2. Updates `Bill.paymentStatus` to `paid`
  3. Updates `Order.status` to `completed`
  4. Frees the `Table.status` back to `available`
  5. Emits `bill:updated`, `order:updated`, `table:updated`

---

## Parcel Order Flow (Simplified)
1. Manager or Waiter creates order with `orderType: "parcel"` — no table required
2. Only customer name is mandatory (phone/address optional)
3. Same kitchen flow (Steps 4–6) applies
4. Waiter completes order and notifies manager (Steps 8–9)
5. **Manager** generates bill and records payment (Steps 10–11), with optional discount % and extra charges

> The billing and payment step is always handled by the Manager via the web dashboard, for both dine-in and parcel orders.

---

## Order Status State Machine

```
pending → confirmed → preparing → ready → served → billing → completed
                                                        ↑
                                              (waiter completes order)
                               (cancel possible at: pending, confirmed)
```

### Table Status Flow
```
available → occupied → billing → available (after payment)
         → reserved
         → cleaning
```

---

## Notification Events Summary

| Trigger | Socket Event | Recipient |
|---|---|---|
| New order created | `order:created` | Cook, Manager |
| Order status changed | `order:updated` | Waiter, Manager |
| Order ready (kitchen) | `order:updated` (status=ready) | Waiter |
| Billing request | `billing:request` | Manager |
| Bill generated | `bill:updated` | All in restaurant |
| Payment recorded | `bill:updated` + `order:updated` | All in restaurant |
| Table freed | `table:updated` | All in restaurant |
| Kitchen alert | `kitchen:alert` | Cook |
