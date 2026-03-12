# Architecture — Hotel Management System

## High-Level Overview

```
┌──────────────────┐     ┌──────────────────┐
│  Mobile App      │     │  Web Dashboard   │
│  (React Native)  │     │  (React + Vite)  │
│  Waiter / Cook   │     │  Manager         │
└────────┬─────────┘     └────────┬─────────┘
         │ HTTP (Axios)            │ HTTP (Axios)
         │ Socket.IO               │ Socket.IO
         └──────────┬──────────────┘
                    ▼
         ┌──────────────────────┐
         │   Backend API        │
         │   Node.js + Express  │
         │   TypeScript         │
         │   Port: 5000         │
         └──────┬──────┬────────┘
                │      │
                │      └──── Socket.IO Server
                │             (bi-directional events)
                ▼
         ┌──────────────────────┐
         │   PostgreSQL DB      │
         │   via Prisma ORM     │
         └──────────────────────┘
```

---

## Backend Architecture (`HMS--BACKEND/src/`)

```
src/
├── server.ts          — Entry point: starts HTTP server + Socket.IO
├── app.ts             — Express app setup, middleware, route mounting
├── config/
│   ├── env.ts         — All environment variables (validated on startup)
│   ├── database.ts    — Prisma client singleton
│   └── socket.ts      — Socket.IO server init + event handlers + emit helpers
├── routes/            — Route definitions (thin layer, delegates to controllers)
├── controllers/       — Request handling, response shaping
├── services/          — Business logic (database queries via Prisma)
├── middleware/        — Auth, CORS, error handling, rate limiting, validation
├── validators/        — Zod schemas for request body validation
├── utils/             — JWT helpers, response helpers, error classes, shared utilities
└── types/             — TypeScript type extensions
```

### Request Lifecycle
```
Client Request
  → CORS Middleware
  → express.json() parser
  → Route matcher (router)
  → requireAuth (JWT verify)
  → requireRole (RBAC)
  → validate (Zod schema)
  → Controller (maps request → service call)
  → Service (Prisma DB query)
  → Response (standardized JSON)
  → Socket.IO emit (if state-changing operation)
```

---

## Mobile App Architecture (`HMS-app/`)

```
HMS-app/
├── app/                    — Expo Router pages (file-based routing)
│   ├── index.tsx           — Splash / entry redirect
│   ├── phone-login.tsx     — Staff phone + PIN login
│   ├── (tabs)/             — Main tab navigation
│   │   ├── orders.tsx      — Waiter: active orders
│   │   ├── tables.tsx      — Waiter: table grid
│   │   ├── kitchen.tsx     — Cook: kitchen order board
│   │   ├── kitchenStyles.ts — Kitchen screen styles
│   │   └── settings.tsx    — App settings
│   ├── create-order.tsx    — New order creation
│   ├── order/              — Order detail pages
│   │   ├── [orderId].tsx   — Order detail view
│   │   ├── BillSummary.tsx — Bill summary component
│   │   └── orderDetailsStyles.ts — Order detail styles
│   ├── order-summary/      — Order summary view
│   └── kitchen/            — Kitchen-specific pages
├── providers/
│   └── AuthProvider.tsx    — Auth state + socket connect/disconnect
├── store/
│   ├── useRestaurantStore.ts   — Tables, menu, orders state (Zustand)
│   ├── useNotificationStore.ts — Notification queue (Zustand)
│   ├── storeMappers.ts         — API-to-store data mappers
│   └── useOfflineQueue.ts      — Offline action queue
├── src/
│   ├── services/           — API + socket service classes
│   └── config/api.config.ts — API base URL (auto-detects local IP)
├── utils/
│   ├── helpers.ts          — Shared utility functions
│   └── kitchen.helpers.ts  — Kitchen-specific helpers
├── types/
│   └── restaurant.ts       — All shared TypeScript types
└── components/
    ├── NotificationPanel.tsx   — In-app notification drawer
    └── OfflineBanner.tsx       — Shows when backend is unreachable
```

### Auth Flow (Mobile)
- Staff uses phone number → PIN
- JWT access token + refresh token stored in AsyncStorage
- `AuthProvider` manages token lifecycle, auto-refresh, socket connect
- Role: `waiter` or `cook` — determined at login, stored in token

---

## Web Dashboard Architecture (`HMS-deshboard/src/`)

```
src/
├── App.jsx             — Router setup, protected routes
├── main.jsx            — React DOM entry
├── pages/
│   ├── auth/           — Login, Signup, PendingApproval
│   ├── BillingDashboard.jsx
│   ├── KitchenDisplay.jsx
│   ├── MenuItems.jsx / MenuCategories.jsx
│   ├── StaffManagement.jsx
│   ├── Reports.jsx
│   ├── reports/reportExports.js — PDF/Excel export helpers
│   ├── Settings.jsx
│   ├── settings/               — Settings sub-components
│   │   ├── RestaurantInfoCard.jsx
│   │   ├── TaxBillingCard.jsx
│   │   ├── PaymentMethodsCard.jsx
│   │   └── TableConfigCard.jsx
│   ├── ParcelOrders.jsx
│   └── CreateParcelOrder.jsx
├── contexts/
│   ├── AuthContext.jsx         — Manager auth state
│   ├── NotificationContext.jsx — Real-time notification state
│   └── ThemeContext.jsx        — Dark/light theme
├── hooks/
│   ├── useToast.js             — Toast notification hook (memoized)
│   └── useSocket.js            — Socket connection hook
├── services/                   — Axios API wrappers per domain
└── config/api.config.js        — API_BASE_URL, SOCKET_URL, API_ENDPOINTS map
```

### Auth Flow (Dashboard)
- Manager uses email + password
- JWT tokens stored in localStorage
- `AuthContext` wraps entire app
- Protected routes redirect to login if unauthenticated

---

## Real-Time Communication

### Socket.IO Rooms
| Room Name | Who Joins | Purpose |
|---|---|---|
| `restaurant:{id}` | All authenticated users | Broadcast all restaurant events |
| `user:{id}` | Individual user | Targeted notifications |
| `role:{role}` | By role (waiter/cook) | Role-specific broadcasts |

### Key Socket Events
| Event | Direction | Payload |
|---|---|---|
| `order:created` | Server → Clients | New order object |
| `order:updated` | Server → Clients | Updated order object |
| `order:updateStatus` | Client → Server | `{ orderId, status }` |
| `table:updated` | Server → Clients | Updated table object |
| `table:updateStatus` | Client → Server | `{ tableId, status }` |
| `billing:request` | Server → Clients | Waiter billing request |
| `kitchen:alert` | Server → Clients | Kitchen alert message |
| `bill:updated` | Server → Clients | Updated bill object |
| `menu:updated` | Server → Clients | Updated menu item |
| `category:updated` | Server → Clients | Updated category |
| `ping` / `pong` | Client ↔ Server | Keep-alive |

---

## API Versioning
- All REST endpoints are under: `http://localhost:5000/api/v1/`
- Health check: `GET http://localhost:5000/health`
- API health: `GET http://localhost:5000/api/v1/health`
