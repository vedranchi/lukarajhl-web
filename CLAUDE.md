# CLAUDE.md — operating rules for this repo

## 0. Using this file
- **Scope:** standing rules and pointers. This file is **not a status report** — it records
  what is always true, never what is currently deployed.
- **Precedence, highest first:**
  1. **Live system state** — the code, `git`/`gh`, the database. If this file disagrees with
     the system, the system wins and this file is wrong: fix it in the same session.
  2. **An explicit instruction from the user in this session** — except §1 DANGER, which
     always needs confirmation first.
  3. **This file.**
  4. `docs/`, vault notes, commit messages, past handoffs.
- Two rules conflict → the more specific one wins. Equally specific → ask.
- Rule IDs (`G3`, `DB2`) are stable. Cite them in commits/PRs and when superseding a rule.
- **Maintenance:** write rules as invariants, present tense, no dates in the body. Retire a
  rule when its subject is gone. Long debugging narratives belong in §16, not here. Soft
  budget ~240 lines — over it means something belongs elsewhere.

## 1. DANGER — confirm with the user before each of these
- **D1** `pnpm dev` runs Payload's schema push against the **live production database**
  (local `.env` `DATABASE_URL` is the prod pooler; there is no dev DB). After a collection or
  field change, the first `pnpm dev` **drops the removed tables/columns in production**.
- **D2** Submitting the invite form — locally or deployed — writes a real row and sends a
  real email to the client via Resend. There is no sandbox.
- **D3** `vercel env pull --environment=production` is a live secrets pull.
- **D4** Deleting a collection or field requires a `totalDocs` check against live first.
- **D5** Rotating `PAYLOAD_SECRET` invalidates existing admin sessions.
- **D6** Client-owned accounts (domain, hosting, analytics, socials): delegated access only.
  Never park the client's business on personal accounts.

## 2. What this is
Website for **Luka Rajhl** (beat producer, Skopje) — the user's first client, built as the
first instance of a reusable client-site template. Public marketing site now; analytics/AI
admin dashboard is Phase 2. The reusable *process* lives in the Obsidian vault (§13).

## 3. Stack — ground truth is `package.json`
Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 (CSS-first `@theme`, no
`tailwind.config.js`) · Payload 3 embedded at `/admin` · Postgres via Supabase · Vercel ·
pnpm · ESLint (no Prettier) · Vitest (no e2e). `src/`, alias `@/*`. Layout: `app/` ·
`app/(payload)/` · `app/actions/` · `collections/` · `components/retro/` · `data/` · `lib/`.

- **S1** The public site renders from `src/data/content.ts` +
  `src/data/beatstars-catalogue.json` and **never reads Payload**. The only Payload call
  outside `app/(payload)/` is the invite server action, via the Local API (`src/lib/payload.ts`).
- **S2** Generated — never hand-edit, regenerate: `src/payload-types.ts`
  (`pnpm generate:types`) and `src/app/(payload)/admin/importMap.js` (`pnpm generate:importmap`).
- **S3** shadcn/ui is **not installed** and there is no `components/ui/`. Don't import from
  it. Adding it is a decision to raise, not a detail to slip in.

## 4. Definition of done
- **DoD1** `pnpm lint && pnpm test && pnpm build` all pass. Report failures verbatim. Never
  weaken, skip, or delete a test to get green.
- **DoD2** Any collection or field change → run **both** `pnpm generate:types` and
  `pnpm generate:importmap`, and commit the output.
- **DoD3** "Fixed" means **merged to `main` and observed working in the deployed system**.
  Committed-on-a-branch is not fixed. A CI change is not fixed until a run passes **from
  `main`** (see G7).
- **DoD4** State plainly what was verified and what was not.

## 5. Terminology — use these exactly
- **Production / deployed** = the live Vercel deployment of `main`.
- **prod build** = a local `pnpm build && pnpm start`.
- **prod DB** = the Supabase database — reached by *both* of the above **and** by `pnpm dev`.

## 6. Session start & recovery
- **R1** Before any claim about what is deployed or what CI is doing: `git fetch`, compare
  `HEAD` to `origin/main` (local `main` goes stale), then `gh run list`. This file records
  intent; only the system records state.
- **R2** Resuming interrupted work, in order: `git fetch` → `git status` →
  `git log origin/main..HEAD` → newest file in `docs/handoffs/` → `gh run list`.
- **R3** `docs/` is **gitignored**, so `docs/handoffs/` and `docs/plans/` exist only on this
  machine. Never cite them as if a fresh clone, another contributor, or a cloud agent could
  read them.

## 7. Git, CI, deploy, rollback
- **G1** Don't commit or push unless asked. Branch off `main` first.
- **G2** `main` is the default branch and is **protected** — no direct pushes; changes land
  by PR (0 required approvals, no required status checks).
- **G3** Merging to `main` deploys production.
- **G4** Rollback: Vercel instant rollback for a site regression, a revert PR for the repo.
  Never force-push `main`.
- **G5** Conventional commits. Footer:
  `Co-Authored-By: Claude <model> <noreply@anthropic.com>`, using the model name the current
  session provides. Do not hardcode a model version in this file.
- **G6** Merge conflicts by file class: **generated files (S2)** → regenerate, never
  hand-merge. **`src/data/beatstars-catalogue.json`** → re-run the fetch script, never
  hand-merge. **This file** → keep both rules, then de-duplicate deliberately.
- **G7** `.github/workflows/refresh-catalogue.yml` refreshes the catalogue twice daily and
  lands it on `main`. **Scheduled workflows only ever run the default branch's copy** —
  editing the workflow on a branch changes nothing until it merges. Because `main` is
  protected the job must **not** `git push` to it (that fails `GH006`); it force-pushes one
  commit to a disposable carrier branch, opens a PR, and squash-merges it with
  `GITHUB_TOKEN` (needs `contents: write` **+** `pull-requests: write`). The force-push is
  deliberate and safe — the carrier branch only ever holds that one commit. `GITHUB_TOKEN`
  events start no workflows, so the job runs CI's checks itself before merging — keep them.
  If a future protection change blocks the merge too, add a repo-admin bypass allowance
  rather than restoring a direct push.
- **G8** Symptom → first check: the live "Browse all N beats" number looks stale →
  `gh run list` before anything else. Nothing else surfaces a failed refresh.

## 8. Database & CMS
- **DB1** Payload's surface is deliberately `Users` + `InviteRequests`. Don't add a CMS
  mirror of `content.ts` without also wiring the site to read it — BeatStars, not the CMS, is
  the source of truth for beats and kits.
- **DB2** No upload collections → no storage adapter. If an upload collection ever returns,
  an S3/Supabase Storage adapter is **mandatory**: Vercel is serverless with no disk, and a
  missing adapter silently writes to ephemeral storage where files vanish.
- **DB3** Migration ritual, in order: verify `totalDocs` on live (D4) → make the change →
  run `pnpm dev` **once, watched, as a deliberate migration** (D1) → `pnpm generate:types` +
  `pnpm generate:importmap` → commit.
- **DB4** Connection resolves `DATABASE_URL` → `POSTGRES_URL`. The Supabase↔Vercel
  integration injects `POSTGRES_URL`; `DATABASE_URL` exists only in local `.env`. `sslmode`
  must be stripped from the URL or it overrides the explicit `ssl` option and Supabase's
  self-signed chain is rejected. See `pgConnectionString()` in `src/payload.config.ts` —
  don't "simplify" it.
- **DB5** Invite-request rows are personal data (name + email). Never paste them into
  transcripts, commits, issues, or PRs.
- **DB7** A Payload version bump can add columns, and production never pushes schema — a
  missing column breaks every query that selects it (admin login included). Before bumping,
  diff `pnpm payload generate:db-schema` across the two versions (it runs with
  `disableDBConnect`, never touches the DB; delete the generated file after). Apply any
  additive column to prod **before** the merge deploys (D-confirm first).
- **DB6** `/api/graphql` 500s under `pnpm dev` (Turbopack's `require(esm)` of graphql 17).
  Production is unaffected — test GraphQL against a prod build; don't chase the dev 500.

## 9. Product & domain
- **P1** Don't rebuild commerce or licensing. BeatStars owns checkout, leases, contracts,
  and payouts. Embed or deep-link only.
- **P2** The site makes exactly **one** runtime call to BeatStars: the audio stream
  `https://main.v2.beatstars.com/stream?id=<numericId>&return=audio` (302s to a fresh signed
  S3 mp3, so it never expires). Play it as plain opaque cross-origin media — **do not set
  `crossOrigin`**; the S3 leg has no CORS headers and requiring CORS breaks playback. The
  synthesized loop at `public/audio/placeholder-loop.wav` is the fallback. **No other
  runtime call to BeatStars, ever** — no catalogue, sales, or analytics fetch at request
  time (ToS + fragility).
- **P3** Catalogue data is baked ahead of time by `scripts/fetch-beatstars.mjs` and committed
  as JSON. It reads BeatStars' undocumented-but-public Algolia index (app `NMMGZJQ6QI`,
  indexes `public_prod_inventory_track_index` / `…_soundkit_index`, filter
  `memberId:MR1947497`, **`Referer: https://www.beatstars.com/` required**, **100 hits/page
  max → paginate**) plus the v2 read API (`…/track?id=`, `…/soundkit?id=`) for canonical
  URLs. Popularity = `activities.play`. Top 10 beats + up to 10 kits are baked; a
  "Browse all N" CTA links out for the rest. **Kit URLs must be handle-scoped**:
  `https://www.beatstars.com/rajhl` + the v2 `relative_uri`. Bare
  `beatstars.com/sound-kits/<slug>` is not a route in their app and silently falls through
  to the generic Sound Kits browse page; `propage_uri` (`rajhl.beatstars.com/…`) and the
  `bsta.rs/k/<id>/` short link both 302 to a **private** page. Beats are different — their
  `beatstars_uri` (`/beat/<slug>`) is already the canonical public URL.
- **P4** Those endpoints are undocumented and can change without notice. Verify before
  relying on any detail in P3, and never present it to the user as guaranteed-current. The
  fetch script enforces sanity gates for exactly this reason: it refuses to write an empty
  catalogue or a >20% drop in total beats and exits non-zero instead (a red workflow run,
  stale-but-correct JSON stays live). Override with `ALLOW_CATALOGUE_SHRINK=1` only when the
  drop is real. It also leaves the file untouched when only `_generatedAt` would change.
- **P5** Sales and analytics data: CSV import or manual only.
- **P6** Integrations: **Instagram** Graph API needs a Business/Creator account + linked
  Facebook Page + Meta app review (Basic Display is deprecated) — conditional, manual
  fallback until approved. **YouTube** public stats via Data API v3 key
  (`YOUTUBE_API_KEY`); private metrics (watch time, revenue) need channel-owner OAuth. The
  per-channel Atom feed (`youtube.com/feeds/videos.xml?channel_id=`) is **retired** — it
  404s for every channel id, including channels that are demonstrably alive, so don't
  "simplify" `src/lib/youtube.ts` back onto it. Uploads come from `playlistItems.list`
  against the `UC…`→`UU…` uploads playlist, plus one batched `videos.list` for view counts.
  **Telegram** has no useful channel analytics — treat as a link. **Spotify** is the
  official embed iframe — don't proxy or scrape it.

- **P7** Prices shown outside BeatStars (meta description, share card) derive from
  the baked catalogue via `leasesFrom` in `content.ts` — never hardcode one, it goes stale on
  the next refresh. `siteUrl` there is the canonical origin for every absolute URL in
  metadata, sitemap and robots.

## 10. Design
Palette authority is `src/app/globals.css` (`@theme` + CSS vars). Read tokens from there;
never hardcode hex in components.
- **DS1** Dark charcoal + muted violet. **No light themes, ever.**
- **DS2** Amber and magenta are readout/tint colors only (LED-style displays, titlebar
  gradient tail, horizon glow). Violet stays the primary accent.
- **DS3** Approved concept: retro 2016 desktop media-player — beveled 3D chrome, violet
  gradient title bar, notched folder tabs, Winamp-style transport, marquee ticker, CRT
  scanlines, vaporwave grid, monospace type. Client-approved: changing the concept is a
  client decision, not a refactor.
- **DS4** Beats table columns: rank · title · play count · time · license. **No BPM/Key** —
  the client asked for them removed.
- **DS5** React 19 lint is strict: `react-hooks/refs` forbids reading `ref.current` in any
  function reachable from render (handlers included) — use effects/state.
  `react-hooks/purity` forbids `Date.now()` / `new Date()` in render — hoist to module scope.
- **DS6** Fonts: system monospace today. Any retro face goes through `next/font` — never a
  CDN `<link>`.

## 10a. Security invariants — the reasoning lives in the files named
- **SEC1** `next.config.ts` owns every response header. The CSP stays limited to navigation and
  embedding — **never add `media-src`/`img-src`** (the beat stream's signed-S3 redirect, P2).
  HSTS never below `max-age=63072000`; `includeSubDomains`/`preload` are the client's call (D6).
- **SEC2** The admin cookie is `Secure` on any production server (`servedOverHttps()`,
  `src/lib/env.ts`). A local prod build (§5) needs `ALLOW_INSECURE_ADMIN_COOKIE=1` in `.env`;
  Vercel ignores it.
- **SEC3** `PAYLOAD_SECRET` fails closed via `requirePayloadSecret()` (DB5); only `next build`
  and Payload's `generate:*` commands are exempt.
- **SEC4** `purge-invite-tracks.yml` enforces applicant-audio retention, and fails red while
  `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset as repo secrets.
- **SEC5** `pnpm-workspace.yaml` `overrides` pin audit fixes no direct bump reaches. Re-check
  with `pnpm audit --prod`; drop one once upstream satisfies it alone.
- **SEC6** `scripts/sql/lock-down-data-api.sql` (idempotent) closes the Supabase Data API to
  Payload's tables. Re-run it after any schema push (D1). Disabling the Data API in the
  dashboard is stronger still (D6).

## 11. Testing
- **T1** Tests are colocated `*.test.ts` (`src/lib/`, `src/collections/hooks/`).
  `pnpm test` / `pnpm test:watch`.
- **T2** The invite path (env parsing, validation, dedupe, rate limiting) is the
  security-relevant surface — keep it covered and extend the tests when changing it.
- **T3** Invite access control is verified by unit tests and against a prod build. **Not yet
  exercised end-to-end on the deployed site** (live submit → row + Resend email); doing so
  triggers D2.

## 12. Environment & secrets
- **E1** Secrets are never committed. `.env.example` documents every key the app reads —
  update it in the same commit that introduces a key.
- **E2** `sharp` and `unrs-resolver` must stay in `allowBuilds` in `pnpm-workspace.yaml`, or
  pnpm's pre-run dependency check makes `pnpm build` exit 1.
- **E3** `package.json` has `"type": "module"` — **required**, don't remove. Without it the
  Payload CLI loads the config through tsx's CJS `require()` hook and dies with
  `ERR_REQUIRE_ASYNC_MODULE`. `NODE_OPTIONS=--no-experimental-require-module` does **not**
  fix it (it trades one error for `ERR_REQUIRE_ESM`) — don't retry that route.

## 13. Knowledge system (Obsidian vault)
- **K1** This repo ↔ vault project **"Luka Rajhl"**; the reusable playbook ↔
  **"Client Delivery"**.
- **K2** **Never hand-edit** note frontmatter (`updated`, `tags`, `related`) or `Index.md` —
  use the scripts (`create_note.py`, `update_note.py`, `update_index.py`,
  `backlink_notes.py`, `archive_note.py`) via `~/Dev/knowledge-system/.venv/bin/python`.
  Filling a note's **body** with the Edit tool is expected and fine.
- **K3** Search before writing; **ask before creating, registering, or scaffolding** a note.
  Propose updating an existing note rather than duplicating it.
- **K4** This system owns `Projects/` only — never touch the vault's `Main/` or `tags/`.
- **K5** Capture knowledge after work that produced a reusable rule or a non-obvious fix:
  rules and gotchas → this file; engineering narrative → the vault. Routine changes need no
  note.

## 14. Process
Interview before big decisions. Prototype and get client sign-off before a full build. If a
client or user request conflicts with a rule here (rebuilding checkout, a light theme,
scraping at runtime), say so once with the reason, then follow the user's decision.

## 15. Open decisions — ask, don't assume
- No dev/preview database exists; local `pnpm dev` targets production (D1). Whether to
  provision one is undecided.
- Branch lifetime, who merges, and stale-branch handling: undefined.
- `graphql` is pinned to 17 while Payload's peer range is `^16.8.1`. That mismatch is what
  DB6 is: nothing on the site uses GraphQL, so the pin has never been worth unwinding.

## 16. Reference — local-only, gitignored (see R3)
- Current status / next steps: newest file in `docs/handoffs/`
- Invite & access-control spec: `docs/plans/private-group-invite-payload-plan.md`
- Full project plan: `~/.claude/plans/i-am-building-a-tender-rivest.md`
- Post-mortems worth reading before re-debugging the same thing: the Payload production-DB
  connection failure (three chained causes → DB4), the `type: module` CLI fix (→ E3), the
  protected-branch refresh failure (→ G7), the CMS trim (→ DB1/DB2).

## Commands
```bash
pnpm dev                              # DANGER D1 — schema push against the production DB
pnpm build && pnpm start              # prod build (§5)
pnpm lint · pnpm test · pnpm test:watch
pnpm generate:types · pnpm generate:importmap
node scripts/fetch-beatstars.mjs      # rewrites src/data/beatstars-catalogue.json
gh run list --workflow=refresh-catalogue.yml

KS=~/Dev/knowledge-system; PY="$KS/.venv/bin/python"
"$PY" "$KS/scripts/search_notes.py" "terms" --project "Luka Rajhl" --json
"$PY" "$KS/scripts/create_note.py" "Title" --project "Luka Rajhl" --category Architecture --tags a,b
```
