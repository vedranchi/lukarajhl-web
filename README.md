# lukarajhl.com

Marketing site for **Luka Rajhl**, a beat producer based in Skopje. A single page covering his
BeatStars catalogue, both YouTube channels and a Spotify playlist, plus an application form for
his private Telegram group.

| | |
|---|---|
| Production | https://lukarajhl.com |
| Preview | https://rajhlpreview.vercel.app (serves `prod-dev`) |

## Overview

The public page is statically rendered and revalidates hourly. It reads from committed data in
`src/data/` and updates itself — the catalogue refreshes on a schedule and the YouTube lists
revalidate hourly — so there is no CMS and nothing to edit by hand. The site stays up if the
database or a third-party API is unavailable. The database exists for one purpose: recording
applications to the private Telegram group.

- **Beats** — top 10 by BeatStars play count, in a classic-iPod player. Audio streams from
  BeatStars; a single `<audio>` element serves the whole page.
- **Sound kits** — client-authored descriptions linking to each kit's BeatStars page.
- **Channels** — recent uploads from both YouTube channels, via the YouTube Data API.
- **Spotify** — playlist embed, kept mutually exclusive with the beat player.
- **Private Telegram** — an Instagram handle plus three mp3s, uploaded to private storage,
  recorded as a lead and emailed to the client. The email is the review workflow; there is no
  admin panel. Leads are in the `invite_requests` table (Supabase table editor) if one is needed.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Postgres (`pg`) and Storage via
Supabase · Resend · Vercel · pnpm · Vitest · ESLint.

```
src/
  app/              the page, metadata routes (sitemap, robots, OG image), the invite server action
  components/site/  UI
  data/             content.ts (authored) + beatstars-catalogue.json (generated)
  lib/              invite storage, validation, uploads, email, YouTube — unit-tested
scripts/            catalogue refresh, applicant-audio retention sweep, SQL
assets/design/      design references (not served)
assets/fonts/       fonts for the share image (OFL)
```

## Requirements

- Node ≥ 20.9 (CI runs 22; no version is pinned in the repo)
- pnpm
- Access to the project's Supabase database and storage bucket

## Local development

```bash
pnpm install
cp .env.example .env    # every key the app reads is documented there
pnpm build && pnpm start
```

`pnpm dev` works too. Nothing touches the database at startup or build time; the schema is
two plain tables changed only by hand-written SQL.

> **There is no development database.** Local, preview and production all share one Postgres
> instance and one storage bucket. The invite form has no sandbox: submitting it from anywhere
> writes a real lead, stores real files and emails the client. See `CLAUDE.md` §1.

## Environment configuration

`.env.example` is the authoritative list. Summary:

| Variable | Required | Notes |
|---|---|---|
| `INVITE_CLAIM_SECRET` | uploads | Signs upload claims. Falls back to the legacy `PAYLOAD_SECRET` |
| `DATABASE_URL` | yes (local) | Supabase pooler URI |
| `POSTGRES_URL` | production | Injected by the Supabase↔Vercel integration; fallback for `DATABASE_URL` |
| `SUPABASE_URL` | uploads | |
| `SUPABASE_SERVICE_ROLE_KEY` | uploads | Bypasses row-level security — server-side only, never `NEXT_PUBLIC_*` |
| `INVITE_TRACKS_BUCKET` | no | Defaults to `invite-tracks`; must be private |
| `RESEND_API_KEY` | email | |
| `INVITE_NOTIFY_TO` | email | Recipient of application notifications |
| `INVITE_FROM` | no | Defaults to the Resend onboarding sender |
| `INVITE_RATE_LIMIT` | no | Submissions per IP per window (default 3) |
| `INVITE_RATE_WINDOW_MS` | no | Default 1 hour |
| `INVITE_DEDUPE_WINDOW_MS` | no | Repeat-handle window (default 24 hours) |
| `RETENTION_DAYS` | no | Retention sweep window (default 90) |
| `ALLOW_CATALOGUE_SHRINK` | no | Overrides the catalogue fetch script's shrink guard |
| `GOOGLE_SITE_VERIFICATION` | no | Search Console HTML-tag token; DNS verification needs nothing |

Without the Resend or Supabase keys the site still builds and runs; the invite form fails with a
"temporarily unavailable" message rather than erroring.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm dev` | Next dev server. The invite form writes to production — see above |
| `node scripts/fetch-beatstars.mjs` | Rewrites `src/data/beatstars-catalogue.json` |
| `node --env-file=.env scripts/purge-invite-tracks.mjs --dry-run` | Lists applicant audio past retention; omit the flag to delete |

## Data

Beats and kits are generated, not hand-maintained. `scripts/fetch-beatstars.mjs` reads the
store's public catalogue and writes `src/data/beatstars-catalogue.json`, which is committed; a
scheduled GitHub Action refreshes it twice daily onto `main`. The script refuses to write an
empty or sharply reduced catalogue, so a degraded fetch fails the run rather than overwriting
good data.

At runtime the site makes exactly one call to BeatStars — the audio stream. It never fetches the
catalogue on request.

If the ranking looks stale, check `gh run list --workflow=refresh-catalogue.yml` first; nothing
in the UI surfaces a failed refresh.

Kit descriptions are client-authored and live in `src/data/content.ts`, not in the generated
JSON, so a refresh cannot overwrite them.

## Deployment

`main` is protected; every change reaches production through a pull request.

```
feature branch → prod-dev → preview review → PR to main → production
```

Pushing to `prod-dev` deploys the client preview. Merging to `main` deploys production, and must
use a merge commit — squashing would permanently diverge `prod-dev` from `main`. Roll back with
Vercel's instant rollback, or a revert PR for the repository. Never force-push `main`.

## Security and privacy

Applications contain personal data and unreleased third-party music. The storage bucket is
private and enforces its own size and MIME limits, object paths are server-generated and bound
to an HMAC claim, uploads are re-validated server-side after transfer, and applicant audio is
deleted after 90 days by the retention sweep. The tables are closed to Supabase's Data API
(`scripts/sql/lock-down-data-api.sql`). Do not paste lead data into issues, commits or pull
requests.

## Contributing

`CLAUDE.md` holds the operating rules: dangerous operations, the deploy workflow, design
decisions and the constraints that have already cost a debugging session. Read it before making
structural changes.
