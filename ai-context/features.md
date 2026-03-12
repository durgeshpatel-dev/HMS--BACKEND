# Features — Hotel Management System

This document lists all **currently implemented features** in the HMS project.

> ⚠️ This project is mostly complete. Do NOT add new features unless explicitly requested.

---

## Authentication & Authorization

- [x] Manager signup with restaurant creation (starts as `pending_approval`)
- [x] Manager email + password login with JWT
- [x] Staff (Waiter/Cook) phone + PIN login with JWT
- [x] JWT access token + refresh token system
- [x] Automatic token refresh on expiry (mobile app)
- [x] Token storage in AsyncStorage (mobile) / localStorage (dashboard)
- [x] Role-based access control (RBAC): `manager`, `super_admin`, `waiter`, `cook`
- [x] Protected routes on dashboard (redirect to login if unauthenticated)
- [x] Auth rate limiting on login endpoints
- [x] Logout (token invalidation)
- [x] Pending approval page for new manager accounts

---

## Real-Time Communication (Socket.IO)

- [x] Socket.IO server initialized alongside Express
- [x] JWT authentication middleware on socket connections
- [x] Restaurant-scoped rooms (`restaurant:{id}`)
- [x] User-specific rooms (`user:{id}`)
- [x] Role-specific rooms (`role:{role}`)
- [x] Order created/updated broadcast to all restaurant clients
- [x] Table status updated broadcast
- [x] Billing request notification (Waiter → Manager)
- [x] Bill updated broadcast
- [x] Kitchen alert broadcast (Manager → Cook)
- [x] Menu/Category updated broadcast
- [x] Keep-alive ping/pong
- [x] Auto-reconnect with backoff (mobile app)
- [x] Reconnect callbacks to re-fetch data after reconnect (mobile app)
- [x] Socket state management via `SocketService` class (mobile)
- [x] Socket context/service in dashboard

---

## Menu Management (Manager — Dashboard)

- [x] Create, read, update, delete categories
- [x] Create, read, update, delete menu items
- [x] Toggle menu item availability (available / unavailable)
- [x] Category display order
- [x] Item customizations (JSON: name + options array)
- [x] Menu item image upload (via Multer, served as static files)
- [x] Vegetarian flag on menu items
- [x] Preparation time field
- [x] Real-time menu/category updates broadcast via Socket.IO

---

## Table Management (Manager — Dashboard)

- [x] Create, read, update, delete tables
- [x] Table location (Indoor, Outdoor, VIP)
- [x] Table capacity
- [x] Table status management (available / occupied / reserved / billing / cleaning)
- [x] Available tables filter endpoint
- [x] Table occupancy stats
- [x] Table status updates broadcast via Socket.IO
- [x] Table status grid on mobile (Waiter)

---

## Order Management (Waiter — Mobile App)

- [x] View available tables and select one
- [x] Browse menu by category
- [x] Add items to order with quantity and customizations
- [x] Item customization modal
- [x] Create new order (dine_in or parcel)
- [x] Manager-created orders start directly in `preparing` (no separate "Accept" step needed)
- [x] Add items to existing open order
- [x] Update or remove order items
- [x] View own orders (`/orders/my-orders`)
- [x] View order detail / order summary
- [x] Mark order as delivered/served
- [x] **Complete Order** — moves all table orders to `billing` status and shows a read-only bill summary
- [x] **Send to Manager** — sends a `billing:request` notification to manager dashboard after completing order
- [x] Cancel order
- [x] Receive in-app notification when kitchen marks order ready (via Socket.IO)
- [x] Offline banner when backend is unreachable
- [x] Offline queue for order actions (useOfflineQueue store)

> ❌ **Waiters CANNOT generate bills or process payments.** Only managers can do this via the web dashboard.
> The billing and payment flow is: Waiter → Complete Order → Send to Manager notification → Manager generates bill → Manager records payment.

---

## Kitchen Management (Cook — Mobile App)

- [x] View kitchen orders in real time
- [x] Order board with pending, preparing, ready columns
- [x] Mark order as preparing
- [x] Mark order as ready
- [x] Receive new order notifications instantly (via Socket.IO + polling fallback every 10s when socket is unavailable)
- [x] View item customizations per order
- [x] View special notes on orders
- [x] Receive kitchen alerts from Manager

---

## Billing & Payments (Manager ONLY — Web Dashboard)

> ⚠️ **Billing is a manager-only operation.** Waiters notify the manager; manager handles all bill generation and payment recording.

- [x] Receive billing request notification from Waiters (`billing:request` socket event)
- [x] View table in "Billing" status on the Billing Dashboard
- [x] Generate bill for a table's orders (calculates subtotal, tax at per-restaurant `taxPercentage` from settings, total)
- [x] Apply discount percentage at bill generation (0–100%)
- [x] Extra charges at bill generation (e.g., packaging/manual charges)
- [x] Record payment (cash, card, UPI)
- [x] Partial payment support (multiple payment records per bill)
- [x] Bill payment status tracking (`unpaid`, `partial`, `paid`)
- [x] Bill number generation
- [x] Print bill (browser print) — shows GSTIN number if configured in settings
- [x] Discount and extra charges shown on bill only when applied
- [x] Billing dashboard page on web dashboard



---

## Staff Management (Manager — Dashboard)

- [x] View all staff (waiters + cooks)
- [x] Create new staff member (phone + PIN)
- [x] Update staff details
- [x] Deactivate / delete staff
- [x] Staff management page on dashboard

---

## Analytics & Reports (Manager — Dashboard)

- [x] Sales analytics (by date range)
- [x] Top selling menu items
- [x] Order summary by status
- [x] Payment method breakdown (cash / card / UPI)
- [x] Waiter performance (orders per waiter)
- [x] Reports page with charts (Recharts)
- [x] PDF bill/report export (jsPDF + jspdf-autotable)

---

## Settings (Manager — Dashboard)

- [x] View and update restaurant settings
- [x] Currency setting (default: INR)
- [x] Tax percentage setting (configurable per restaurant, stored as `taxPercentage` in settings JSON, default 5%)
- [x] GST number field (stored as `gstNumber` in settings JSON, printed on bills as "GSTIN: ...")
- [x] Operating hours configuration
- [x] Feature toggles (table service, parcel orders, online orders)

---

## Parcel Orders

- [x] Create parcel order (no table required)
- [x] Only customer name is mandatory; phone/address optional
- [x] Parcel orders page on dashboard
- [x] Create parcel order from dashboard
- [x] Item-level instructions/notes in parcel order flow
- [x] Add more items to existing parcel order (before billing)
- [x] Edit parcel order items (before billing)
- [x] Parcel bill generation with discount % + packaging charges
- [x] Print parcel bill

---

## Mobile App UI/UX

- [x] Animated splash screen
- [x] Tab navigation (Waiter: Orders, Tables, Settings / Cook: Kitchen, Settings)
- [x] Combined phone + PIN login screen (single page)
- [x] In-app notification panel (drawer)
- [x] Offline banner
- [x] Haptic feedback (expo-haptics)
- [x] Menu item card component with image support
- [x] Kitchen styles extracted to dedicated file
- [x] Order details split into sub-components (BillSummary, styles)

---

## Backend Infrastructure

- [x] Prisma migrations and seeding
- [x] Zod validation on all request bodies
- [x] Standardized JSON response format
- [x] Global error handler middleware
- [x] 404 not-found handler
- [x] CORS configured for local dev (multiple origins)
- [x] Static file serving for uploads
- [x] Rate limiting (currently disabled globally, enabled on auth routes)
- [x] Environment variable validation on startup
- [x] Graceful shutdown (SIGTERM / SIGINT) with proper cleanup sequence
- [x] Health check endpoint
- [x] PostgreSQL connection pool management (max=15, min=2, idle=30s, timeout=10s)
- [x] Pool exhaustion monitoring (logs warnings when connections are waiting)
- [x] Transaction timeouts (15s) on all database transactions
- [x] Shared utility modules (errors.util.ts, shared.util.ts)
- [x] Centralized error classes (AppError, NotFoundError, ValidationError)
