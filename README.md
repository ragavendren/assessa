# Assessa

Online assessment platform — TanStack Start, React, TypeScript, Tailwind CSS, Supabase, Vercel.

## Application URLs (Vercel)

| Environment                   | Git branch   | Deploy             | URL                                                                                         |
| ----------------------------- | ------------ | ------------------ | ------------------------------------------------------------------------------------------- |
| **Production**                | `main`       | `vercel --prod`    | **https://assessa.sstcloud.com.au**                                                         |
| **Production** (Vercel alias) | `main`       | `vercel --prod`    | **https://assessa-ragavendrenv-5507s-projects.vercel.app**                                  |
| **Development**               | `develop`    | preview (not prod) | **https://assessa-git-develop-ragavendrenv-5507s-projects.vercel.app**                      |
| **PR preview**                | pull request | preview            | Unique URL on the PR (e.g. `https://assessa-<hash>-ragavendrenv-5507s-projects.vercel.app`) |

GitHub Actions:

- **CI** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — mandatory gate on every push/PR to `main` and `develop`
  - `npm run format:check` (Prettier)
  - `npm run lint` (ESLint)
  - `npm run typecheck` (TypeScript)
  - `npm run build` (production build)
- **Deploy** [`.github/workflows/deploy-vercel.yml`](.github/workflows/deploy-vercel.yml) — runs only after **CI succeeds**
  - Push `main` → production
  - Push `develop` → development preview
  - Manual: **Actions → Deploy to Vercel → Run workflow**

Requires repo secret `VERCEL_TOKEN` ([create token](https://vercel.com/account/tokens)) with access to team **ragavendrenv-5507s-projects** / project **assessa**:

```sh
# Create a new token at vercel.com/account/tokens, then:
gh secret set VERCEL_TOKEN --repo ragavendren/assessa
```

If Actions fail with `User not found` / `Could not retrieve Project Settings`, regenerate the token and re-set the secret. Do **not** also define `VERCEL_TOKEN` under GitHub Environments (it overrides the repo secret).

Vercel project env vars must include Production **and** Preview (development/PR) values — see below. Sync from `.env` with `npm run env:sync-vercel`.

## Requirements

- Node.js **22.x**
- npm
- A Supabase project

## Quick start

```sh
cp .env.example .env   # fill in values
npm install
npm run db:setup       # migrate + seed admin
npm run dev            # http://localhost:3000
```

Local SSR loads **all** `.env` keys into `process.env` via `vite.config.ts` (not only `VITE_*`). Nitro is used for production builds only.

## Environment variables

| Variable                                           | Required     | Purpose                                                        |
| -------------------------------------------------- | ------------ | -------------------------------------------------------------- |
| `SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PROJECT_ID` | Yes          | Project reference ID                                           |
| `SUPABASE_URL` / `VITE_SUPABASE_URL`               | Yes          | `https://<ref>.supabase.co`                                    |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_…`              | Yes          | Publishable API key                                            |
| `SUPABASE_SERVICE_ROLE_KEY`                        | Yes          | Service role (server only)                                     |
| `SUPABASE_DB_PASSWORD`                             | Migrate      | Database password                                              |
| `SUPABASE_DB_REGION`                               | Migrate      | e.g. `ap-south-1`                                              |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`         | Seed         | Admin created by `db:seed`                                     |
| `APP_URL`                                          | Prod         | Public URL (`https://assessa.sstcloud.com.au`)                 |
| `GEMINI_API_KEY`                                   | Insights     | [Google AI Studio](https://aistudio.google.com/apikey) key     |
| `GEMINI_MODEL`                                     | No           | Default `gemini-3.5-flash-lite`                                |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`        | Google SSO   | Google Cloud OAuth Web client                                  |
| `SUPABASE_ACCESS_TOKEN`                            | Sync scripts | [Account token](https://supabase.com/dashboard/account/tokens) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL`             | Yes (mail)   | Resend — Auth hook + exam invites (verified domain)            |
| `SEND_EMAIL_HOOK_SECRET`                           | Yes (mail)   | Supabase Send Email Hook secret (`v1,whsec_…`)                 |
| `SUPABASE_RATE_LIMIT_EMAIL_SENT`                   | No           | Auth email triggers/hour (default `100`)                       |
| `AI_GATEWAY_API_KEY`                               | No           | Optional OpenRouter-style fallback                             |

## Scripts

```sh
npm run dev
npm run build
npm run format              # Prettier write
npm run format:check        # Prettier check (CI)
npm run lint
npm run typecheck
npm run ci                  # format:check + lint + typecheck + build
npm run db:migrate
npm run db:seed
npm run db:setup
npm run db:sync-auth-emails     # Resend SMTP + Assessa Auth templates
npm run db:inspect-auth-mail    # verify SMTP + raise/check rate limit
npm run db:sync-google-auth     # Google OAuth + Auth redirect URLs
npm run env:sync-vercel         # push selected .env keys to Vercel
```

## Auth & email

### Delivery: Resend API only (quota-aware)

Resend free tier is ~**100 emails/day**. Assessa only sends for critical flows:

| Trigger | When | Resend? |
| --- | --- | --- |
| Signup confirmation | User creates an account with email/password | Yes |
| Magic link / email OTP | Auth magic-link or email OTP sign-in | Yes |
| Password recovery | Forgot-password flow | Yes (account access) |
| Exam invite | Admin invites emails on create/update exam | Yes (1 per invitee) |
| Result ready | Attempt submitted | No — in-app notification |
| Badge earned | Badge unlocked | No — in-app notification |
| Auth invite / email change / reauth | Other Supabase Auth mail types | No — blocked by hook |

- **Auth path:** Supabase **Send Email Hook** → `POST /api/auth/send-email` → Resend
- **Exam invites:** app → Resend (`sendExamInvitationEmails`)
- Enable: `npm run db:sync-auth-emails` (needs `RESEND_*`, `APP_URL`, writes `SEND_EMAIL_HOOK_SECRET`)
- Verify: `npm run db:inspect-auth-mail`
- Deploy with `RESEND_*` + `SEND_EMAIL_HOOK_SECRET` (`npm run env:sync-vercel`)
- Supabase Auth also has an hourly trigger gate (`SUPABASE_RATE_LIMIT_EMAIL_SENT`, default 100/hour)

### Email / password routes

- `/auth`, `/forgot-password`, `/reset-password`, `/auth/callback`

### Google sign-in

Uses **Supabase Google OAuth** (not Firebase).

1. Create an OAuth 2.0 **Web** client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Authorized redirect URI: `https://<SUPABASE_PROJECT_ID>.supabase.co/auth/v1/callback`
3. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`
4. Run `npm run db:sync-google-auth`
5. Confirm Supabase Auth → URL config includes your site URL and `/auth/callback`

## AI insights

Dashboard + Admin “Generate” use Gemini via `GEMINI_API_KEY`.

- Default model: `gemini-3.5-flash-lite` (new AI Studio keys cannot use `gemini-2.5-flash`)
- Override with `GEMINI_MODEL` if needed
- Optional fallback: `AI_GATEWAY_*` (OpenAI-compatible gateway)

## Deploy

### Vercel environment variables

Set for **Production**, **Preview**, and **Development** targets:

**Client:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

**Server:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID`, `APP_URL`, `GEMINI_API_KEY` (optional `GEMINI_MODEL`), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

Do **not** set `GEMINI_MODEL` to `gemini-2.5-flash` for new keys.

For development previews, set `APP_URL` to the develop branch URL (or keep production URL if Auth redirects only allow prod — then add the develop URL in Supabase Auth redirect allow-list).

### CLI

```sh
npm run env:sync-vercel
npx vercel --prod          # production
npx vercel                 # preview / development build
```

### Git branches

```sh
# Production release
git push origin main

# Development deploy
git checkout -b develop   # once
git push -u origin develop
```

### Supabase Auth URLs

**Production**

- Site URL: `https://assessa.sstcloud.com.au`
- Redirect: `https://assessa.sstcloud.com.au/auth/callback`

**Development** (also add to Auth URL allow-list)

- `https://assessa-git-develop-ragavendrenv-5507s-projects.vercel.app/**`
- `https://assessa-git-develop-ragavendrenv-5507s-projects.vercel.app/auth/callback`
- `http://localhost:3000/**` and `/auth/callback`

## Admin notes

- Overview: assessments, cohort AI insight, Danger Zone wipe (`WIPE DATA`)
- Wipe keeps the seeded admin / current admin and gamification config
- Guest share links: `/take/:examId`

## Stack

TanStack Start · React · TypeScript · Tailwind · Supabase · Nitro · Vercel · Gemini · Resend
