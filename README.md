# Common Ground — Learning Management System

A bilingual learning platform with a React and TypeScript web client, an Express and TypeScript API, and PostgreSQL persistence on Neon. The application supports student learning flows and protected administrator course management.

## Project links

- **Frontend:** [taskflow-learning-management-app.netlify.app](https://taskflow-learning-management-app.netlify.app/)
- **Backend API:** [taskflow-learning-management-api.onrender.com](https://taskflow-learning-management-api.onrender.com/)
- **Source repository:** [TaskFlow-learning-management-app](https://github.com/ggjjg3129-collab/TaskFlow-learning-management-app)
- **API health route:** [`/api/health`](https://taskflow-learning-management-api.onrender.com/api/health)

The frontend URL responded during the README review. The API health route returned HTTP 503 at that time, so API availability could not be confirmed. Service availability may change independently of this documentation.

## Architecture

```text
┌─────────────────────┐
│ Students / Admins   │
│ Web browser         │
└──────────┬──────────┘
           │ HTTPS
           ▼
┌─────────────────────────────────────┐
│ React + TypeScript + Vite           │
│ Netlify frontend                    │
└──────────┬──────────────────────────┘
           │ Credentialed API requests
           │ CSRF header for state changes
           ▼
┌─────────────────────────────────────┐
│ Node.js + Express + TypeScript      │
│ Render API                          │
│ Validation · Authentication         │
│ Role authorization · Repository     │
└──────────┬──────────────────────────┘
           │ Parameterized SQL
           ▼
┌─────────────────────────────────────┐
│ Neon PostgreSQL                     │
│ LMS data and server-side sessions   │
└─────────────────────────────────────┘
```

The client calls the API using `VITE_API_BASE_URL` and sends browser credentials with requests. The API validates input and derives the authenticated user and role from its PostgreSQL-backed session and user record. The repository layer performs parameterized database operations. The frontend and backend are hosted separately, so their origins and cookie settings must be configured to work together.

## Features

### Students

- Register and sign in.
- Browse courses, search by title, and filter by category.
- View course details, enroll, and read ordered lessons.
- Mark lessons complete, view progress, and continue learning from the dashboard.

### Administrators

- View platform statistics and registered students.
- Review student enrollments and lesson completion progress.
- Create, edit, and delete courses and their ordered bilingual lessons.

### Interface

- English and Arabic UI/content with LTR and RTL layouts.
- Persistent language and light/dark theme preferences.
- Responsive layouts and loading, validation, empty, success, and error states.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL on Neon |
| Sessions | `express-session`, `connect-pg-simple` |
| Validation | Zod |
| Security middleware | Helmet, CORS, `express-rate-limit` |

## Security and engineering notes

- Passwords are hashed with bcrypt; public registration creates Student accounts only.
- Login regenerates the session ID. Sessions are stored in PostgreSQL, use HTTP-only cookies, roll with activity, and have a 24-hour cookie lifetime. Logout destroys the server-side session.
- All state-changing requests require a session-bound CSRF token.
- Admin routes enforce the Admin role in the API. Student enrollment and progress operations use the authenticated user, and lesson access/completion checks enrollment.
- Request bodies are size-limited and validated; repository SQL uses parameters rather than interpolating user input.
- Helmet sets HTTP security headers. Credentialed CORS is restricted to the configured frontend origin.
- Authentication endpoints are rate-limited to 10 attempts per 15-minute window per server process. This limiter is process-local; multi-instance deployments need shared rate limiting at the platform or gateway layer.
- The API runtime forces PostgreSQL connection URLs to `sslmode=verify-full`.
- Production requires `COOKIE_SECURE=true`. With secure cookies, the server uses `SameSite=None` to support the separately hosted frontend. Configure `TRUST_PROXY` only for the actual trusted proxy setup.
- Do not place server credentials in client environment variables. Vite-exposed variables use the `VITE_` prefix and are included in browser code.

## Repository layout

```text
.
├── client/                 # React/Vite frontend
│   ├── public/
│   └── src/
├── server/                 # Express API and PostgreSQL access
│   ├── migrations/
│   └── src/
├── package.json            # Root scripts delegate to client
└── README.md
```

## Prerequisites

- Node.js 20.19+ (or 22.12+) and npm
- PostgreSQL access for local API/database use
- A modern browser

## Local setup

Install dependencies from the repository root:

```powershell
npm.cmd install --prefix client
npm.cmd install --prefix server
```

Create local environment files from the examples:

```powershell
Copy-Item client\.env.example client\.env
Copy-Item server\.env.example server\.env
```

Set these variable names in the relevant local or hosting environment. Keep secret values out of source control:

**Client (`client/.env`)**

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend API origin; defaults locally to `http://localhost:3000`. |

**Server (`server/.env`)**

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL/Neon connection URL. |
| `SESSION_SECRET` | Session-signing secret; at least 32 characters. |
| `FRONTEND_ORIGIN` | Exact origin allowed for credentialed browser requests. |
| `PORT` | API listening port; defaults to `3000`. |
| `COOKIE_SECURE` | `true` for HTTPS deployment; `false` only for local HTTP. |
| `TRUST_PROXY` | `true` only behind the supported trusted HTTPS proxy; otherwise `false`. |

Admin bootstrap/reset scripts also accept temporary `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` process environment variables. These are operational inputs, not persistent application configuration. See [server/README.md](./server/README.md) for their safe use.

## Development

Run frontend and backend in separate terminals from the repository root:

```powershell
npm.cmd run dev --prefix server
```

```powershell
npm.cmd run dev --prefix client
```

The client defaults to `http://localhost:5173`; the API defaults to `http://localhost:3000`. Set `FRONTEND_ORIGIN` to the client origin and `VITE_API_BASE_URL` to the API origin.

## Database setup

The server includes a versioned SQL migration and a demo-course seed command. From `server/`:

```powershell
npm.cmd run migrate
npm.cmd run seed
```

**Database safety:** the migration changes the database configured by `DATABASE_URL`. Review the migration and verify the target database before running it; do not run against production without an explicit review and deployment plan. The seed command writes demo course and lesson rows to the configured database. Review its behavior and target as well.

The API runtime enforces PostgreSQL TLS certificate and hostname verification. The migration and seed commands use their own database connections; confirm their connection configuration and target before running either against a production database.

## Checks and builds

Run client commands from the repository root:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run preview
```

The root `typecheck`, `lint`, `build`, and `preview` scripts delegate to the client. The frontend production output is `client/dist`.

Run API commands from `server/`:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
```

The API build output is `server/dist`. `npm.cmd start` runs the compiled API and requires the server environment and database to be configured. Tests use the server’s Node test runner and test repository; they do not require running migrations.

## Deployment workflow

The deployment targets are Netlify for the frontend, Render for the API, and Neon for PostgreSQL. This repository does not contain Netlify or Render deployment manifests; configure the hosting services using the application scripts and environment names above.

1. **Netlify frontend:** build the client using `npm run build --prefix client` and publish `client/dist`. Configure `VITE_API_BASE_URL` with the Render API origin. This value is public in the built browser application and must not contain a secret.
2. **Render API:** configure the server project directory and use the server build/start scripts (`npm run build` and `npm start`). Set `DATABASE_URL`, a strong `SESSION_SECRET`, `FRONTEND_ORIGIN` to the deployed Netlify origin, `COOKIE_SECURE=true`, and the appropriate `PORT` and `TRUST_PROXY` values.
3. **Neon PostgreSQL:** provision the database and configure its connection URL in Render. Review the migration and target before applying schema changes. Do not use development seed data in production without reviewing that decision.
4. Verify the API health route, frontend-to-API credentialed requests, CSRF-protected state changes, secure cookies, and the deployed database connection after configuration.

For backend route details and administration scripts, see [server/README.md](./server/README.md).
