# Project Overview — Hotel Management System (HMS)

## Purpose
A full-stack restaurant/hotel order management platform that digitizes the complete dine-in and parcel order workflow — from a waiter taking an order on a mobile device, to the kitchen receiving it in real time, to the manager generating the bill.

---

## Project Modules

| Module | Technology | Location |
|---|---|---|
| Backend API | Node.js + Express + TypeScript | `HMS--BACKEND/` |
| Mobile App (Waiter & Cook) | React Native + Expo | `HMS-app/` |
| Web Dashboard (Manager) | React + Vite + Tailwind CSS | `HMS-deshboard/` |
| Database | PostgreSQL via Prisma ORM | `HMS--BACKEND/prisma/` |
| Real-time Communication | Socket.IO (server + clients) | Embedded in all three |

---

## User Roles

### 1. Waiter (Mobile App)
- Logs in with **phone number + PIN**
- Selects tables, creates orders, adds menu items
- Receives notifications when orders are ready
- Marks orders as served/completed
- Sends billing requests to the Manager

### 2. Cook / Kitchen (Mobile App)
- Logs in with **phone number + PIN**
- Views incoming orders in real time
- Marks items/orders as prepared
- Receives kitchen alerts from the Manager dashboard

### 3. Manager (Web Dashboard)
- Logs in with **email + password**
- Full control: menu, tables, staff, orders, billing, analytics
- The **only role that can generate a bill**
- Receives billing requests from Waiters via notifications
- Marks payments as collected

---

## Tech Stack

### Backend
- **Runtime:** Node.js (TypeScript)
- **Framework:** Express v5
- **ORM:** Prisma with PostgreSQL adapter
- **Auth:** JWT (Access + Refresh tokens), bcrypt for password hashing
- **Real-time:** Socket.IO v4
- **Validation:** Zod schemas
- **File Upload:** Multer
- **Rate Limiting:** express-rate-limit

### Mobile App
- **Framework:** React Native + Expo SDK 54
- **Routing:** Expo Router (file-based)
- **State Management:** Zustand
- **HTTP Client:** Axios
- **Real-time:** socket.io-client
- **Push Notifications:** expo-notifications
- **Storage:** AsyncStorage (via @react-native-async-storage)

### Web Dashboard
- **Framework:** React 19 + Vite 7
- **Styling:** Tailwind CSS
- **Routing:** React Router DOM v7
- **Charts:** Recharts
- **PDF:** jsPDF + jspdf-autotable
- **HTTP Client:** Axios
- **Real-time:** socket.io-client

---

## Environment Variables

### Backend (`HMS--BACKEND/.env`)
```
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRY=1h
JWT_REFRESH_EXPIRY=30d
PORT=5000
NODE_ENV=development
API_VERSION=v1
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,http://localhost:8081
```

### Mobile App (`HMS-app/.env`)
```
EXPO_PUBLIC_API_BASE_URL=http://<local-ip>:5000/api/v1
EXPO_PUBLIC_SOCKET_URL=http://<local-ip>:5000
```

### Web Dashboard (`HMS-deshboard/.env`)
```
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

---

## Project Status
- **This project is complete and fully functional.**
- All core flows are implemented, tested (53/53 API tests pass at 100%), and working.
- Backend, Dashboard, and Mobile App all compile with zero TypeScript errors.
- Dashboard production build succeeds (Vite, 22.9s, 2,761 modules).
- Code has been audited: dead files removed, large files split, types consolidated.
- Focus on fixing bugs and improving reliability — not adding features.
