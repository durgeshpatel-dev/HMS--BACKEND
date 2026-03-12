# Coding Rules — Hotel Management System

These rules **must be followed** by all developers and AI assistants working on this project.

---

## 🔴 CRITICAL RULES — Never Violate

### 1. Do Not Break Existing Working Features
- Before editing any file, understand what it does and where it is used.
- Search for all usages of a function/component before modifying its signature.
- Never delete code without first confirming it is unused everywhere.

### 2. Do Not Change API Contracts
- The mobile app and dashboard are already connected to backend APIs.
- Do NOT rename fields in API responses.
- Do NOT change the shape of response objects.
- Do NOT change route paths that are already in use.
- If you must change something, add a new field instead of renaming an existing one.

### 3. Do Not Break Real-Time Communication
- Socket.IO event names are hard-coded across backend, mobile app, and dashboard.
- Do NOT rename socket events without updating ALL sides.
- Always emit socket events after database-modifying operations (orders, bills, tables).

### 4. Do Not Remove Database Fields
- The Prisma schema is the source of truth.
- Do NOT remove columns from models — they may be used by other services.
- Avoid destructive migrations in a production environment.

### 5. Do Not Add Unnecessary Features
- This project is mostly complete.
- Only implement what is explicitly asked.
- Avoid scope creep.

### 6. Billing and Payment is a Manager-Only Operation
- **Waiters CANNOT generate bills or process payments.**
- The waiter's billing role is limited to:
  1. Tap "Complete Order" → moves orders to `billing` status
  2. Tap "Send to Manager" → sends `billing:request` socket notification
  3. Tapping a billing-status table in the tables tab shows an info message only
- **All actual bill generation and payment must go through the manager's web dashboard.**
- Do NOT add bill generation or payment buttons anywhere in the mobile app.
- `app/generate-bill.tsx` has been **deleted** — do not recreate it.

---

## 🟡 IMPORTANT RULES — Follow Always

### 6. Read Before You Write
- Always read the relevant files before making changes.
- Understand the full flow (controller → service → database) before touching any layer.
- Check related socket emit calls after modifying order/table/bill services.

### 7. Use Defensive Programming
- Always check for null/undefined before accessing properties.
- Use optional chaining (`?.`) and nullish coalescing (`??`).
- Validate inputs before processing them.
- Add `if` guards when modifying logic so existing behavior remains safe.

### 8. Maintain Backward Compatibility
- New fields must be **optional** unless there is a migration and all clients are updated.
- New API routes must not conflict with existing routes.
- New socket events must not replace existing ones — add alongside them.

### 9. Follow Existing Patterns

#### Backend (TypeScript)
- Controllers handle HTTP only: parse request, call service, send response.
- Services contain all business logic and Prisma queries.
- Always emit socket events from **service layer** (via `emitOrderUpdate`, etc.) or **controller** after service call.
- Use `sendSuccess()` and `sendError()` from `utils/response.util.ts`.
- All request bodies must be validated with a Zod schema before reaching the controller.
- Role-based guards use `requireRole(['manager'])` middleware — do not inline role checks in controllers.

#### Mobile App (TypeScript / React Native)
- All API calls go through `src/services/` — never call `axios` directly in components.
- State lives in Zustand stores (`useRestaurantStore`, `useNotificationStore`).
- Auth state and socket lifecycle are managed by `AuthProvider`.
- Use `expo-router` navigation — do not use `react-navigation` directly.
- File-based routing: page files live in `app/`.

#### Web Dashboard (JavaScript / React)
- API calls go through `src/services/` — never call `axios` directly in components.
- Auth state is in `AuthContext`.
- Notification state is in `NotificationContext`.
- Socket is managed inside the notification context — do not create additional socket connections.
- Use Tailwind CSS utility classes — do not add inline styles or CSS files unless necessary.

### 10. Error Handling
- Always wrap async operations in try/catch.
- Log errors with meaningful context (`console.error('context:', error)`).
- Return appropriate HTTP status codes (400 = bad input, 401 = not auth, 403 = no permission, 404 = not found, 500 = server error).
- Do not expose internal error details to clients in production.

### 11. Environment Variables
- Never hardcode secrets, URLs, or credentials in source code.
- All configurable values must come from `.env` files.
- Backend env vars are centralized in `src/config/env.ts`.
- Mobile env vars use `EXPO_PUBLIC_` prefix and are accessed via `process.env`.
- Dashboard env vars use `VITE_` prefix and are accessed via `import.meta.env`.

### 12. Multi-Tenancy Awareness
- Every database query on a shared table (orders, menu, tables, staff) **must** include `restaurantId` in the WHERE clause.
- Never query data across restaurants.
- `restaurantId` comes from the authenticated user's JWT payload.

### 13. TypeScript
- Do not use `any` unless absolutely unavoidable, and add a comment explaining why.
- Define types in `src/types/` for shared shapes.
- Use `interface` for object shapes and `type` for unions/intersections.

### 14. Prisma / Database
- Use Prisma's `select` to avoid over-fetching (only fetch needed fields).
- Use `include` for related data only when needed.
- Never write raw SQL unless Prisma cannot express the query.
- `unit_price` on `OrderItem` must always capture the current `MenuItem.price` at order creation time.
- After every Prisma schema field change, run both:
  - `npx prisma db push` (or migration flow)
  - `npx prisma generate`
  Then restart backend server so runtime client matches schema.

### 14a. Connection Pool & Transactions
- PostgreSQL pool is configured: `max=15, min=2, idleTimeout=30s, connectionTimeout=10s`.
- **All database transactions must have a 15-second timeout** using `SET LOCAL statement_timeout = '15000'`.
- Never hold a transaction open while doing slow operations (HTTP calls, file I/O).
- Pool exhaustion is monitored — if `waitingCount > 0`, a warning is logged every 5 seconds.
- Use `$transaction()` with the interactive mode for multi-step operations.

### 14b. Dashboard Hooks
- The `useToast` hook returns a `toast` object — it **must** be wrapped in `useMemo` to prevent infinite render loops when used as a dependency in `useEffect`.
- Always memoize objects returned from custom hooks if they will be used in dependency arrays.

### 16. Settings JSON Key Names
- Tax rate is stored as `taxPercentage` (camelCase) in the restaurant `settings` JSON.
- Always read with fallback: `settings?.taxPercentage ?? settings?.tax_percentage ?? 5` for backwards compatibility with older rows.
- GST number is stored as `gstNumber` in the same `settings` JSON (not a separate DB column).
- When writing new settings via `updateRestaurantSettings`, use `taxPercentage` (camelCase) only.

### 15. File Structure
- Do not create new directories without a clear reason.
- Follow existing naming conventions: `camelCase` for variables/functions, `PascalCase` for components/classes/types, `kebab-case` for file names.
- Route files are thin — only define paths and middleware chains.
- Business logic belongs in services only.

---

## 🟢 BEST PRACTICES

- Prefer small, targeted changes over large refactors.
- Test the affected flow manually after changes (or describe how to test it).
- Keep socket emit logic consistent: always emit after a successful DB write.
- When adding a new status value to an order/table, update ALL places that use that status (frontend UI, backend service, Prisma schema comments).
- Comment non-obvious logic — especially socket event sequences and auth flows.
- Keep API response shapes flat and simple — avoid deeply nested objects.
