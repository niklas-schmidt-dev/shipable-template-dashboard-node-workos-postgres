# Node + WorkOS + Postgres Dashboard

This generated app uses React/Vite/Tailwind for the frontend, an Express-backed Node API in `api/`, WorkOS AuthKit login routes, sealed session cookies, and Postgres migrations in `db/migrations`.

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Run the API in another terminal:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/app \
WORKOS_API_KEY=sk_test_... \
WORKOS_CLIENT_ID=client_... \
WORKOS_REDIRECT_URI=http://localhost:8787/callback \
WORKOS_COOKIE_PASSWORD=replace-with-at-least-32-characters \
npm run dev:api
```

The dashboard still renders preview data when `DATABASE_URL` or WorkOS values are missing, so the template is inspectable before credentials are configured. For a real AuthKit flow, add `http://localhost:8787/callback` as a WorkOS redirect URI and `http://localhost:5173` as the app origin.

Apply the Postgres migrations:

```bash
for migration in db/migrations/*.sql; do psql "$DATABASE_URL" -f "$migration"; done
```

Run the API with the service start command:

```bash
npm run start
```

`npm run start` runs `npm run build:api` first and then starts the compiled server with Node from `.shipable/service/api/server.js`.

Security defaults:

- AuthKit callbacks verify OAuth state before sealing a session cookie.
- `WORKOS_COOKIE_PASSWORD` must be 32+ random characters.
- `/api/dashboard` requires an authenticated WorkOS session once WorkOS is configured.
- Sign-out uses `POST /logout`; API responses use no-store cache headers and generic error bodies.

Validate the full project:

```bash
npm run typecheck
npm run check:api
npm run build:api
npm run build
```

The service runtime listens on `PORT` when provided and defaults to `8787`. Health, session, and dashboard endpoints are `/api/health`, `/api/session`, and `/api/dashboard`; AuthKit routes are `/login`, `/callback`, and `/logout`.
