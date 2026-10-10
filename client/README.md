# Common Ground client

See the [project README](../README.md) for installation and scripts. The client uses demo course content and progress, while account registration, login, session restoration, and logout use the backend API.

## API connection

The API defaults to `http://localhost:3000`. To use another backend, copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to its origin. The backend must allow this frontend origin through `FRONTEND_ORIGIN`; browser requests include the session cookie and use the backend CSRF-token endpoint.

Run the backend and its database setup first, then start this client with `npm.cmd run dev`. Register a student account or sign in with a provisioned account. Public registration cannot create administrator accounts.
