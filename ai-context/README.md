# AI Context — Hotel Management System

This folder contains structured documentation for the HMS project.  
Its purpose is to help any new AI chat instantly understand the system and continue development **safely without breaking anything**.

---

## 📁 Files in This Folder

| File | Contents |
|---|---|
| [project.md](project.md) | Project overview, tech stack, user roles, environment variables |
| [architecture.md](architecture.md) | How backend, frontend, mobile app, DB, and sockets connect |
| [system_flow.md](system_flow.md) | Complete order lifecycle step-by-step (the core flow) |
| [api.md](api.md) | All REST API endpoints, methods, roles, and request/response formats |
| [database.md](database.md) | All database tables, columns, types, and relationships |
| [features.md](features.md) | Full list of implemented features per module |
| [coding_rules.md](coding_rules.md) | Rules all developers and AI assistants must follow |
| [.copilot-rules.md](.copilot-rules.md) | Rules specifically for GitHub Copilot code generation |

---

## ⚡ Quick Project Summary

**Hotel Management System** — A restaurant order management platform with 3 panels:

| Panel | Technology | Role |
|---|---|---|
| Mobile App | React Native + Expo | Waiter + Cook |
| Web Dashboard | React + Vite + Tailwind | Manager |
| Backend API | Node.js + Express + TypeScript | Shared |
| Database | PostgreSQL via Prisma ORM | Shared |
| Real-time | Socket.IO | Shared |

---

## 🔁 Core Flow (Read This First)

```
Waiter selects table
  → Creates order (mobile app)
    → Order saved in DB
      → Kitchen sees it instantly (Socket.IO)
        → Cook marks it ready
          → Waiter gets notification
            → Waiter serves customer
              → Waiter sends billing request
                → Manager generates bill (dashboard)
                  → Manager records payment
                    → Table freed
```

---

## 🚦 Development Rules — TL;DR

1. **This project is mostly complete** — do not add features unless asked
2. **Never break API response shapes** — mobile app and dashboard depend on them
3. **Never rename socket events** — they are hardcoded on all 3 sides
4. **Always include `restaurantId`** in every database query
5. **Use defensive programming** — null checks, optional chaining everywhere
6. **Read before you write** — understand the full flow before making any change
7. **Small safe changes** — prefer fixing bugs over refactoring working code

---

## 📂 Codebase Locations

| What | Where |
|---|---|
| Backend source | `HMS--BACKEND/src/` |
| Prisma schema | `HMS--BACKEND/prisma/schema.prisma` |
| Backend utils | `HMS--BACKEND/src/utils/` (errors, shared, jwt, response, helpers) |
| Mobile app pages | `HMS-app/app/` |
| Mobile app services | `HMS-app/src/services/` |
| Mobile app state | `HMS-app/store/` (useRestaurantStore, storeMappers, useOfflineQueue) |
| Mobile app types | `HMS-app/types/restaurant.ts` (consolidated) |
| Mobile app utils | `HMS-app/utils/` (helpers, kitchen.helpers) |
| Dashboard pages | `HMS-deshboard/src/pages/` |
| Dashboard settings | `HMS-deshboard/src/pages/settings/` (split sub-components) |
| Dashboard reports | `HMS-deshboard/src/pages/reports/` (export helpers) |
| Dashboard services | `HMS-deshboard/src/services/` |
| Dashboard hooks | `HMS-deshboard/src/hooks/` (useToast, useSocket) |
| Socket init (backend) | `HMS--BACKEND/src/config/socket.ts` |
| Route definitions | `HMS--BACKEND/src/routes/` |
| Auth middleware | `HMS--BACKEND/src/middleware/auth.middleware.ts` |
| AI context docs | `HMS--BACKEND/ai-context/` |

---

## ⚙️ Backend API Base URL
```
http://localhost:5000/api/v1
```

## 🌐 Dashboard URL
```
http://localhost:5173
```

---

## Setup Instructions

## Project Structure

```
HMS all/
├── HMS--BACKEND/       — Node.js + Express + TypeScript API server
│   └── ai-context/     — Project documentation for AI assistants
├── HMS-app/            — React Native (Expo) mobile app (Waiter + Cook)
└── HMS-deshboard/      — React + Vite web dashboard (Manager)
```

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | v18+ | Backend + Dashboard |
| npm | v9+ | Package management |
| PostgreSQL | v14+ | Database |
| Expo CLI | Latest | Mobile app |
| Android Studio / Xcode | Latest | Mobile emulator (optional) |
| Expo Go app | Latest | Run on physical device |

---

## 1. Setup the Database

```bash
# Create a PostgreSQL database
psql -U postgres
CREATE DATABASE hms_db;
\q
```

---

## 2. Setup the Backend

```bash
cd "HMS--BACKEND"

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# (or manually create .env — see below)

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Optional: Seed the database
npx ts-node prisma/seed.ts

# Start development server
npm run dev
# or
npx ts-node --transpile-only src/server.ts
```

### Backend `.env` file:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/hms_db
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRY=1h
JWT_REFRESH_EXPIRY=30d
PORT=5000
NODE_ENV=development
API_VERSION=v1
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,http://localhost:8081
```

The backend runs at: **http://localhost:5000**

Health check: **http://localhost:5000/health**

---

## 3. Setup the Web Dashboard

```bash
cd "HMS-deshboard"

# Install dependencies
npm install

# Create environment file
echo "VITE_API_URL=http://localhost:5000/api/v1" > .env
echo "VITE_SOCKET_URL=http://localhost:5000" >> .env

# Start development server
npm run dev
```

The dashboard runs at: **http://localhost:5173**

---

## 4. Setup the Mobile App

```bash
cd "HMS-app"

# Install dependencies
npm install

# Create environment file (replace <YOUR-LOCAL-IP> with your machine's LAN IP)
echo "EXPO_PUBLIC_API_BASE_URL=http://<YOUR-LOCAL-IP>:5000/api/v1" > .env
echo "EXPO_PUBLIC_SOCKET_URL=http://<YOUR-LOCAL-IP>:5000" >> .env

# Start Expo
npx expo start

# For tunnel mode (if LAN doesn't work):
npx expo start --tunnel
```

Find your local IP on Linux/Mac:
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
# or
ifconfig | grep "inet " | grep -v 127.0.0.1
```

---

## 5. First-Time Setup (After Database Seed)

### Create a Manager Account
1. Open the web dashboard at http://localhost:5173
2. Click **Sign Up**
3. Fill in restaurant details and create account
4. Account will be `pending_approval`

### Activate the Manager Account
The seeded database may include a super_admin. Otherwise, use Prisma Studio to manually set `status = 'active'`:
```bash
cd "HMS--BACKEND"
npx prisma studio
# Open http://localhost:5555 → users table → set status to 'active'
```

### Create Staff (Waiter / Cook)
1. Log in to the dashboard as Manager
2. Go to **Staff Management**
3. Create Waiter and Cook accounts with phone + PIN

### Login to Mobile App
1. Open the mobile app
2. Enter staff phone number
3. Enter PIN
4. Select profile (if multiple staff share a device)

---

## Running All Services

Open three terminals:

**Terminal 1 — Backend:**
```bash
cd "HMS--BACKEND" && npm run dev
```

**Terminal 2 — Dashboard:**
```bash
cd "HMS-deshboard" && npm run dev
```

**Terminal 3 — Mobile App:**
```bash
cd "HMS-app" && npx expo start
```

---

## Useful Commands

### Backend
```bash
npm run dev              # Start with nodemon (hot reload)
npm run build            # Compile TypeScript
npm start                # Run compiled JS (production)
npx prisma studio        # Open database GUI at :5555
npx prisma migrate dev   # Apply pending migrations
npx prisma generate      # Regenerate Prisma client
```

### Dashboard
```bash
npm run dev      # Start Vite dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Mobile App
```bash
npx expo start           # Start Expo
npx expo start --tunnel  # Start with ngrok tunnel
npx expo start --android # Start targeting Android emulator
npx expo start --ios     # Start targeting iOS simulator
```

---

## Notes

- The mobile app auto-detects the local IP from Expo's `hostUri` when no `.env` is set. This works for LAN development.
- Socket.IO uses both `polling` and `websocket` transports for reliable connectivity.
- Image uploads are stored in `HMS--BACKEND/uploads/` and served at `/uploads/<filename>`.
- The global rate limiter is currently disabled (commented out in `app.ts`). Only auth routes are rate-limited.
