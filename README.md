# Assessa

Online assessment and examination platform built with TanStack Start, React, TypeScript, Tailwind CSS, and Supabase.

## Development

```sh
npm install
npm run dev
```

Requires Node.js 20+.

## Environment variables

Copy `.env.example` to `.env` and fill in values.

| Variable | Source |
|---|---|
| `SUPABASE_PROJECT_ID` | Dashboard → **Project Settings → General → Reference ID** |
| `VITE_SUPABASE_PROJECT_ID` | Same as `SUPABASE_PROJECT_ID` |
| `SUPABASE_URL` | `https://<SUPABASE_PROJECT_ID>.supabase.co` |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_…` | Dashboard → **API Keys** (publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → **API Keys** (service_role — server only) |
| `SUPABASE_DB_PASSWORD` | Dashboard → **Database** password (for migrations) |
| `SUPABASE_DB_REGION` | e.g. `ap-south-1` (Session pooler region) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Used by `npm run db:seed` |
| `AI_GATEWAY_API_KEY` | Optional AI insights |

## Database scripts

```sh
npm run db:migrate          # apply supabase/migrations
npm run db:migrate:new -- name
npm run db:seed             # seed admin + baseline levels
npm run db:setup            # migrate + seed
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new) — framework preset is **TanStack Start** (`vercel.json`).
3. Add environment variables (Production + Preview):

   **Client (Vite)**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`

   **Server**
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_PROJECT_ID`
   - `AI_GATEWAY_API_KEY` (optional)

4. Deploy. Nitro targets Vercel Functions automatically during the Vercel build.
5. In Supabase Auth → URL configuration, add:
   - `https://<your-vercel-domain>/auth/callback`
   - Site URL: `https://<your-vercel-domain>`

## Auth notes

- Sign in / sign up: `/auth`
- Google SSO requires the Google provider enabled in Supabase Auth → Providers
- Participant share links (no login): `/take/:examId`

## Built with

- TanStack Start / Router / Query
- TypeScript · React · Tailwind CSS
- Supabase · Nitro · Vercel
