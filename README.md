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

### GitHub Actions (recommended)

Workflow: [`.github/workflows/deploy-vercel.yml`](.github/workflows/deploy-vercel.yml)

Triggers on push/`workflow_dispatch` to `main` (production) and on PRs (preview).

1. Create a Vercel token: [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Add it as a repo secret named `VERCEL_TOKEN`:

   ```sh
   gh secret set VERCEL_TOKEN --repo ragavendren/assessa
   ```

3. In the Vercel project **assessa**, set environment variables (Production + Preview):

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

4. Run the workflow:

   ```sh
   gh workflow run "Deploy to Vercel" --repo ragavendren/assessa
   ```

5. In Supabase Auth → URL configuration, add:
   - `https://<your-vercel-domain>/auth/callback`
   - Site URL: `https://<your-vercel-domain>`

### Manual import (optional)

Import the repo in [Vercel](https://vercel.com/new) — framework preset is **TanStack Start** (`vercel.json`). Prefer Actions-only deploys if you enable the workflow above, or disable Vercel’s automatic Git deploys to avoid double builds.

## Auth notes

- Sign in / sign up: `/auth`
- Google SSO requires the Google provider enabled in Supabase Auth → Providers
- Participant share links (no login): `/take/:examId`

## Built with

- TanStack Start / Router / Query
- TypeScript · React · Tailwind CSS
- Supabase · Nitro · Vercel
