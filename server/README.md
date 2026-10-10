# LMS API server

The server is the Node.js, Express, and TypeScript API for the Common Ground full-stack Learning Management System. It serves the React/Vite client with authentication, course and lesson data, enrollment and progress tracking, and Admin operations. PostgreSQL stores application data and server-side sessions; Neon PostgreSQL is supported.

The client sends credentialed HTTP requests to this API. Set the client’s `VITE_API_BASE_URL` to the API origin (the client defaults to `http://localhost:3000`). The API validates requests, resolves the current user and role from the database, and uses the repository layer for parameterized PostgreSQL queries.

**Deployment is not yet completed.** Hosting the API and frontend, configuring their environment and network origins, and preparing the target database are separate deployment tasks.

## Requirements

- Node.js 20.19+ (or 22.12+) and npm
- A PostgreSQL database (Neon is supported)

## Environment configuration

From this directory, install dependencies and create a local environment file:

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Configure these variable names in `server/.env`; do not commit that file or share its values:

- `DATABASE_URL` — PostgreSQL connection URL. The API runtime enforces TLS certificate and hostname verification by setting `sslmode=verify-full`.
- `SESSION_SECRET` — session signing secret, at least 32 characters.
- `FRONTEND_ORIGIN` — exact origin allowed for credentialed browser requests; defaults to `http://localhost:5173`.
- `PORT` — API port; defaults to `3000`.
- `COOKIE_SECURE` — `false` for local HTTP; must be `true` in production. Secure cookies use `SameSite=None`; local cookies use `SameSite=Lax`.
- `TRUST_PROXY` — `true` only behind the supported trusted HTTPS proxy; otherwise `false`.

The client has a separate `VITE_API_BASE_URL` setting in `client/.env`. Only `VITE_*` client variables are bundled into browser code; do not put server secrets in the client environment.

## Database initialization

Review `migrations/001_initial.sql` and confirm `DATABASE_URL` targets the intended database before running the migration:

```powershell
npm.cmd run migrate
```

**The migration creates or changes database objects. Review the migration and target carefully; do not run it against production without an explicit review and deployment plan.** The migration runner records applied versions in `schema_migrations` and skips a version it has already recorded.

To insert the bilingual demo courses after the schema exists:

```powershell
npm.cmd run seed
```

The seed command writes demo course and lesson rows. Existing course and lesson IDs are left unchanged. Check the target database before running it.

Create an Admin explicitly using the `create-admin` script. Public registration only creates Student accounts. The script reads `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`; provide these bootstrap values only in the process environment, not in committed files. Run:

```powershell
npm.cmd run create-admin
```

The command refuses to overwrite an existing account, and the password is stored as a bcrypt hash.

To reset an existing Admin password, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` temporarily in the process environment and run:

```powershell
npm.cmd run reset-admin-password
```

The script does not create or promote an account and revokes that Admin’s existing sessions. Never place credentials in source control.

## Development and verification

Run the API in development mode with automatic TypeScript reload:

```powershell
npm.cmd run dev
```

By default, the API listens at `http://localhost:3000`; `GET /api/health` provides a health response. Run these checks and build from the server directory:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The production build compiles TypeScript to `dist`. Start the compiled API with:

```powershell
npm.cmd start
```

`npm.cmd run migrate:built` and `npm.cmd run seed:built` are also available after building. They need the `migrations` directory alongside the compiled files and use the configured database; the production-target warning above applies.

## Authentication and security

- Registration validates input and creates Student accounts only. Passwords are hashed with bcrypt; login failures do not disclose whether an account exists.
- Login regenerates the session ID. Sessions are stored in PostgreSQL, use an HTTP-only cookie, roll with activity, and have a 24-hour cookie lifetime. Logout destroys the server-side session.
- Mutating requests, including registration, login, Admin course changes, enrollment, and lesson completion, require the session-bound CSRF token from `GET /api/auth/csrf` in the `X-CSRF-Token` header.
- Admin and Student authorization is checked on the server against the current database user. Student enrollment and progress endpoints use the signed-in user; lesson access and completion require enrollment.
- Helmet security headers, a 1 MB JSON request limit, parameterized repository queries, and credentialed CORS restricted to `FRONTEND_ORIGIN` are enabled.
- Authentication rate limiting allows up to 10 attempts per 15-minute window per process. Multi-instance deployments need an appropriately configured shared rate-limiting gateway.
- In production, set `COOKIE_SECURE=true`, serve over HTTPS, and configure `TRUST_PROXY` only for the actual trusted proxy arrangement.

## API functionality

### Authentication

- `GET /api/auth/csrf` — create or return the session CSRF token.
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/auth/me` — current authenticated user.

### Courses, lessons, and student learning

- `GET /api/courses?search=&category=` and `GET /api/courses/:courseId` — browse/filter courses and read course details.
- `GET /api/courses/:courseId/lessons` and `GET /api/lessons/:lessonId` — read lessons subject to authentication and enrollment rules.
- `POST /api/courses/:courseId/enroll` — enroll the signed-in Student.
- `GET /api/student/enrollments` and `GET /api/student/progress?courseId=` — retrieve the signed-in Student’s own enrollment and progress data.
- `POST /api/courses/:courseId/lessons/:lessonId/complete` — record completion for an enrolled Student.

### Administration

All Admin endpoints require authentication and the Admin role:

- `GET /api/admin/stats` — platform counts.
- `GET /api/admin/students` — student names/emails, enrolled courses, enrollment counts, and lesson progress; does not return password hashes or session data.
- `POST /api/admin/courses`, `PUT /api/admin/courses/:courseId`, `DELETE /api/admin/courses/:courseId` — create, update, and delete courses and ordered lessons.

Course requests are validated on the server. Validation errors use a `400` response; course and lesson persistence operations are handled by the PostgreSQL repository.
