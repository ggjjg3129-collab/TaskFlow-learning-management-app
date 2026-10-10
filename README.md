# Common Ground — Learning Management System

Common Ground is a bilingual (Arabic and English) Learning Management System with a React web client, an Express API, and PostgreSQL database support (including Neon). Students can register, browse and enroll in courses, read lessons, and track learning progress. Administrators can manage courses and lessons, view platform statistics, and review student enrollments and lesson progress.

**Deployment status: not deployed by this repository.** To run it for users, host the frontend and backend, configure their environment and trusted origins, and provision a PostgreSQL database.

## Technology

- Frontend: React, TypeScript, Vite, React Router
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL; Neon is supported
- Authentication: bcrypt password hashing and server-side PostgreSQL sessions

## Architecture and request flow

```text
Browser (React/Vite)
    │ credentialed HTTP requests; CSRF header on state changes
    ▼
Express API (authentication, validation, authorization)
    │ parameterized PostgreSQL queries
    ▼
PostgreSQL / Neon
```

The client uses `VITE_API_BASE_URL` as the API base URL; when unset, it defaults to `http://localhost:3000`. The Express API validates inputs and checks the current database-backed user role before protected operations. The repository layer performs parameterized PostgreSQL queries. Sessions are stored in PostgreSQL, and the frontend sends browser credentials with API calls.

## Features

- Student registration and sign-in, course discovery/search, course enrollment, lesson reading, and lesson progress.
- Admin-only course and lesson create, update, and delete operations; student and enrollment/progress summaries; and platform statistics.
- English and Arabic content/interface with LTR/RTL layout, plus saved language and theme preferences.

## Security controls

The API uses bcrypt password hashes, server-side sessions with session rotation after login, HTTP-only cookies, CSRF token validation for state-changing requests, role-based authorization, request validation, parameterized SQL queries, Helmet security headers, credentialed CORS restricted to the configured frontend origin, and authentication rate limiting. Production database URLs are configured for PostgreSQL TLS certificate and hostname verification (`sslmode=verify-full`). Rate limiting is process-local; deployments with multiple API instances need an appropriately configured shared gateway or equivalent protection.

Use HTTPS in deployment and configure secure cookies and trusted proxy settings for the hosting topology. Do not commit `.env` files or place server secrets in the frontend environment; only `VITE_*` values are exposed to the browser.

## Prerequisites

- Node.js 20.19+ (or 22.12+) and npm
- PostgreSQL database access for running the API
- A modern browser

## Installation and environment setup

Install each application’s dependencies from the project root:

```powershell
npm.cmd install --prefix client
npm.cmd install --prefix server
```

Create local environment files from the examples:

```powershell
Copy-Item client\.env.example client\.env
Copy-Item server\.env.example server\.env
```

Configure the **variable names** below in the respective local files. Keep all secret values private.

Client (`client/.env`):

- `VITE_API_BASE_URL` — API origin, for example the local API URL during development.

Server (`server/.env`):

- `DATABASE_URL` — PostgreSQL/Neon connection URL. Runtime configuration enforces `sslmode=verify-full`.
- `SESSION_SECRET` — session-signing secret; use at least 32 characters.
- `FRONTEND_ORIGIN` — exact browser origin permitted by credentialed CORS.
- `PORT` — API listening port.
- `COOKIE_SECURE` — set `true` for HTTPS deployment; use `false` only for local HTTP development.
- `TRUST_PROXY` — set `true` only when running behind the supported trusted HTTPS proxy.

The frontend defaults to `http://localhost:3000` for its API URL if `VITE_API_BASE_URL` is unset. The backend defaults and deployment constraints are described in [server/README.md](./server/README.md).

## Database initialization

From the server directory, the migration and seed commands are:

```powershell
Set-Location server
npm.cmd run migrate
npm.cmd run seed
```

**Database changes warning:** migrations modify the database named by `DATABASE_URL`; review the migration and target connection before running it. Do not run migrations against production without an explicit review and deployment plan. The seed command also writes demo course data to its target database; understand its behavior and target before using it.

To create the initial administrator, follow the safe, temporary environment-variable instructions in [server/README.md](./server/README.md). Public registration creates student accounts, not administrator accounts.

## Development

Run the client and server in separate PowerShell terminals from the project root:

```powershell
npm.cmd run dev --prefix server
```

```powershell
npm.cmd run dev --prefix client
```

The client normally runs at `http://localhost:5173`; the API normally runs at `http://localhost:3000`. Ensure `FRONTEND_ORIGIN` and `VITE_API_BASE_URL` agree with the local URLs.

## Checks and production builds

Client checks and build:

```powershell
Set-Location client
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Server checks, tests, and build:

```powershell
Set-Location server
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The frontend production bundle is written to `client/dist`. The backend TypeScript build writes compiled output under `server/dist`. Use the compiled server entry point with `npm.cmd start` from `server` after configuring its runtime environment and database. These commands build the project; they do not deploy it.

## Deployment

No deployment is claimed by this repository. A deployment requires hosting the static frontend and Node.js API, configuring the frontend API URL, setting the backend environment variables and trusted frontend origin, provisioning PostgreSQL/Neon, and applying reviewed database migrations to the intended database. Use HTTPS, secure cookies, and an accurately configured trusted proxy where applicable.

For backend setup details and API routes, see [server/README.md](./server/README.md).
