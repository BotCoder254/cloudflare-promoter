# golinks playground

Single-repo full-stack playground for Cloudflare Workers + React using TypeScript end to end.

## Stack

- Cloudflare Vite plugin (`@cloudflare/vite-plugin`)
- React + React Router
- Worker runtime API + redirect resolver
- Cloudflare KV hot-path cache + rate-limit counters
- TanStack Query for server-state
- Drizzle ORM foundation for D1 (`src/shared/db/schema.ts`)
- Tailwind CSS with the provided token palette (`tailwind.config.cjs`)

## Frontend routes

- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/link/:slug/password`
- `/link/:slug/unavailable`
- `/dashboard`
- `/dashboard/links`
- `/dashboard/links/:id`
- `/dashboard/analytics`
- `/dashboard/settings`
- `/admin`

## Worker routes

- `/api/auth/*`
- `/api/settings`
- `/api/dashboard/summary`
- `/api/links`
- `/api/links/:id`
- `/api/links/:id/toggle-status`
- `/api/links/bulk`
- `/api/links/check-slug`
- `/api/public/links/:slug/verify-password`
- `/api/analytics/:id`
- `/api/version`
- `/health`
- `/:slug` redirect resolution

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run deploy`
- `npm run db:generate`
- `npm run db:migrate:local`
- `npm run db:migrate:remote`

## Feature 2: Authentication with Better Auth

- Email/password sign-up and sign-in with validation-backed payloads
- Social login with GitHub and/or Google (based on env provider config)
- Session-aware frontend app shell with protected dashboard and admin routes
- Linked provider management in settings (link/unlink social accounts)
- Forgot-password request flow and reset-password completion page
- Better Auth handler mounted under `/api/auth/*` with D1-backed `user`, `session`, and `account` tables

## Feature 3: Data architecture with Drizzle ORM + D1

- Typed Drizzle schema for auth + product tables: `user`, `session`, `account`, `links`, `visits`, and `daily_stats`
- Query/services split under Worker modules: `worker/db/auth.ts`, `worker/db/links.ts`, `worker/db/analytics.ts`, `worker/db/admin.ts`
- Dashboard and analytics use view-model APIs instead of exposing raw table shapes
- Migration discipline with Drizzle config + committed SQL files under `drizzle/migrations`
- `/health` includes D1 connectivity probe and latency measurement for operational checks

## Feature 4: Link management workflows

- Create flow supports auto slug/custom slug, debounced availability checks, private links, expiration, one-time links, and password protection
- Ownership-safe link APIs for list/detail/update/toggle/archive under authenticated session checks
- Reserved slug enforcement for app routes such as `login`, `dashboard`, `admin`, `api`, and health/assets routes
- Dashboard links table supports filters, sorting, pagination, copy URL, toggle status, analytics navigation, and QR actions
- Bulk workflows support select-visible, activate, pause, and archive actions
- Link detail page includes full metadata, QR actions, and recent analytics pulse

## Feature 5: Advanced link controls and secure public access

- Password-protected links use a 5-minute signed unlock cookie after successful password verification
- Public redirect policy now handles unavailable states with dedicated public pages
- One-time links use atomic consume markers to prevent multi-redirect races

## Feature 6: Redirect engine, analytics ingestion, KV caching, and abuse controls

- Public `/:slug` redirect resolution uses a normalized slug pipeline with KV-first lookup and D1 fallback
- KV redirect objects store safe hot-path fields (destination + policy flags + expiration + version marker) and are refreshed/invalidated on create/update/toggle/archive/consume flows
- Successful redirects ingest analytics events with timestamp, referrer, user-agent, country, and daily aggregate updates
- Redirect analytics writes run in background tasks (`waitUntil`) so the redirect hot path remains low-latency
- Sensitive routes now enforce deterministic KV-backed limits: auth mutation endpoints, link creation bursts, and protected-link password verification
- Abuse/suspicious behavior is logged to `security_events` for invalid slug probes, rate-limit hits, blocked policies, and password abuse attempts
- Dashboard and analytics screens use separate TanStack Query datasets for responsive live cards, modern charts, recent visits, and top-performing link widgets
- Added migration `0003_swift_firestar.sql` for `security_events` plus `visits_unique_probe_idx` hot-path index

### KV bindings

- Bind `LINKS_CACHE` for redirect cache objects.
- Optional: bind `RATE_LIMIT_KV`; if omitted, rate-limit counters fall back to `LINKS_CACHE`.

### Promotion smoke example

- Promotion validation can chain redirect + analytics checks (for example: hit `/${slug}`, then verify `/api/analytics/:id` reflects a new visit).

## Environment examples

- `.env.example`
- `.dev.vars.example`
