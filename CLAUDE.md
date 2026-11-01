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
- Rule IDs (`G3`, `DB4`) are stable. Cite them in commits/PRs and when superseding a rule.
- **Maintenance:** write rules as invariants, present tense, no dates in the body. Retire a
  rule when its subject is gone. Long debugging narratives belong in §16, not here. Soft
  budget ~240 lines — over it means something belongs elsewhere.

## 1. DANGER — confirm with the user before each of these
- **D2** Local `.env` `DATABASE_URL` is the **production** database (there is no dev DB).
  Submitting the invite form — locally or deployed — writes a real row there, stores real files
  and sends a real email to the client via Resend. There is no sandbox.
- **D3** `vercel env pull --environment=production` is a live secrets pull.
- **D4** Dropping a table or column, or any other DDL, requires a row count against live first
  and runs as hand-written SQL in a transaction — there is no ORM and no migrations dir.
- **D6** Client-owned accounts (domain, hosting, analytics, socials): delegated access only.
  Never park the client's business on personal accounts.

## 2. What this is
Website for **Luka Rajhl** (beat producer, Skopje) — the user's first client, built as the
first instance of a reusable client-site template. One public page that updates itself (scheduled
catalogue refresh, hourly YouTube revalidation) — **no CMS, and none planned**. Analytics/AI
dashboard is Phase 2. The reusable *process* lives in the Obsidian vault (§13).

## 3. Stack — ground truth is `package.json`
Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 (CSS-first `@theme`, no
`tailwind.config.js`) · Postgres via Supabase, plain `pg` · Vercel · pnpm · ESLint (no
Prettier) · Vitest (no e2e). `src/`, alias `@/*`. Layout: `app/` · `app/actions/` ·
`components/site/` · `data/` · `lib/`.

- **S1** The public site renders from `src/data/content.ts` +
  `src/data/beatstars-catalogue.json` and **never reads the database**. The only DB access is
  the invite server action, through `src/lib/invite-requests.ts` → `src/lib/db.ts`.
- **S5** No CMS. Payload was removed (its admin was never used after setup; Luka reviews
  applications from the notification email). Don't reintroduce a CMS or an admin panel — content
  comes from BeatStars and `content.ts`, and that is a client decision, not a refactor.
- **S3** shadcn/ui is **not installed** and there is no `components/ui/`. Don't import from
  it. Adding it is a decision to raise, not a detail to slip in.

## 4. Definition of done
- **DoD1** `pnpm lint && pnpm test && pnpm build` all pass. Report failures verbatim. Never
  weaken, skip, or delete a test to get green.
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
- **G6** Merge conflicts by file class: **`src/data/beatstars-catalogue.json`** → re-run the fetch script, never
  hand-merge. **This file** → keep both rules, then de-duplicate deliberately.
- **G7** `.github/workflows/refresh-catalogue.yml` refreshes the catalogue twice daily and
  lands it on `main`. **Scheduled workflows only ever run the default branch's copy** —
  editing the workflow on a branch changes nothing until it merges. Because `main` is
  protected the job must **not** `git push` to it (that fails `GH006`); it force-pushes one
  commit to a disposable carrier branch, opens a PR, and squash-merges it with
  `GITHUB_TOKEN` (needs `contents: write` **+** `pull-requests: write`). The force-push is
  deliberate and safe — the carrier branch only ever holds that one commit. If a future
  protection change blocks the merge too, add a repo-admin bypass allowance rather than
  restoring a direct push.
- **G8** Symptom → first check: the live "Browse all N beats" number looks stale →
  `gh run list` before anything else. Nothing else surfaces a failed refresh.

## 8. Database
- **DB1** Postgres holds invite requests only: `invite_requests` + `invite_requests_tracks`
  (created by Payload originally; the new code writes the same shape — 1-based `_order`, 24-hex
  track ids — so old and new rows read alike). `users`, `users_sessions` and `payload_*` are
  leftovers from Payload, read by nothing. BeatStars, not the DB, is the source of truth for
  beats and kits.
- **DB3** Schema changes are hand-written, idempotent SQL in a transaction (D4). Nothing pushes
  schema: not `pnpm dev`, not the build, not a deploy. Table names in `invite-requests.ts` are
  unqualified on purpose (see its header).
- **DB4** Connection resolves `DATABASE_URL` → `POSTGRES_URL`. The Supabase↔Vercel
  integration injects `POSTGRES_URL`; `DATABASE_URL` exists only in local `.env`. `sslmode`
  must be stripped from the URL or it overrides the explicit `ssl` option and Supabase's
  self-signed chain is rejected. See `pgConnectionString()` in `src/lib/db.ts` — don't
  "simplify" it. `pg` stays in `serverExternalPackages` (`next.config.ts`).
- **DB5** Invite-request rows are personal data (Instagram handle, IP). Never paste them into
  transcripts, commits, issues, or PRs.

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

- **P7** Prices shown outside BeatStars (hero line, meta description, share card) derive from
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

## 10a. Security invariants
- **SEC1** `next.config.ts` owns the response headers for every route (HSTS, `X-Frame-Options`,
  nosniff, `Referrer-Policy`, `Permissions-Policy`, CSP). The CSP is deliberately limited to
  `frame-ancestors` / `base-uri` / `object-src` / `form-action`. **Do not add `media-src` or
  `img-src`**: the beat stream 302s to an unpredictable signed S3 host (P2) and CSP re-checks
  every redirect hop, so an allowlist kills playback. `script-src` would need nonces →
  middleware → loses the homepage's static prerender; revisit only if the page ever renders
  untrusted content. HSTS is `max-age=63072000` — the value Vercel sends by default; ours
  replaces it, so never set it lower. No `includeSubDomains`, no `preload` — both are the
  client's call on a client-owned domain (D6).
- **SEC3** The upload-claim HMAC key (`INVITE_CLAIM_SECRET`, falling back to the legacy
  `PAYLOAD_SECRET` the deployment already has) fails closed: under 16 characters, uploads report
  "unavailable" rather than signing forgeable claims.
- **SEC4** `.github/workflows/purge-invite-tracks.yml` enforces the agreed retention window on
  applicant audio. It *skips*, not fails, while `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
  are unset as repo secrets — confirm it is deleting, not skipping.
- **SEC6** The app's tables live in Supabase's `public` schema, which the Data API exposes, and
  Supabase grants `anon`/`authenticated` on every new table there by default. With RLS off,
  the publishable key reads `users` (hashes) and `invite_requests` and can INSERT an admin.
  `scripts/sql/lock-down-data-api.sql` (idempotent) enables RLS and revokes those grants;
  the app connects as `postgres` (BYPASSRLS) and is unaffected. Re-run it after creating any
  table. Nothing uses the Data API, so disabling it in the dashboard is stronger still (D6).
- **SEC5** `pnpm-workspace.yaml` `overrides` pin patch-level fixes for audit-flagged transitive
  deps no direct bump reaches. Re-check with `pnpm audit --prod`; drop one once upstream
  satisfies it alone.

## 11. Testing
- **T1** Tests are colocated `*.test.ts` in `src/lib/`.
  `pnpm test` / `pnpm test:watch`.
- **T2** The invite path (env parsing, validation, dedupe, rate limiting) is the
  security-relevant surface — keep it covered and extend the tests when changing it.
- **T3** The invite write path is unit-tested with a fake store, and its SQL has been run against
  temp-table copies of the live schema. A real submit (row + Resend email) is the only end-to-end
  test, and it triggers D2.

## 12. Environment & secrets
- **E1** Secrets are never committed. `.env.example` documents every key the app reads —
  update it in the same commit that introduces a key.
- **E2** `sharp` and `unrs-resolver` must stay in `allowBuilds` in `pnpm-workspace.yaml`, or
  pnpm's pre-run dependency check makes `pnpm build` exit 1.
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
- No dev/preview database exists; local and preview target production (D2). Whether to
  provision one is undecided.
- The leftover Payload tables (`users`, `users_sessions`, `payload_*`) can be dropped once the
  removal is deployed and verified (D4). `users` still holds the old admin's password hash.
- Branch lifetime, who merges, and stale-branch handling: undefined.

## 16. Reference — local-only, gitignored (see R3)
- Current status / next steps: newest file in `docs/handoffs/`
- Invite & access-control spec: `docs/plans/private-group-invite-payload-plan.md`
- Full project plan: `~/.claude/plans/i-am-building-a-tender-rivest.md`
- Post-mortems worth reading before re-debugging the same thing: the production-DB connection
  failure (three chained causes → DB4), the protected-branch refresh failure (→ G7), the CMS trim
  and Payload removal (→ S5/DB1).

## Commands
```bash
pnpm dev                              # the invite form here writes to the production DB (D2)
pnpm build && pnpm start              # prod build (§5)
pnpm lint · pnpm test · pnpm typecheck · pnpm test:watch
node scripts/fetch-beatstars.mjs      # rewrites src/data/beatstars-catalogue.json
gh run list --workflow=refresh-catalogue.yml

KS=~/Dev/knowledge-system; PY="$KS/.venv/bin/python"
"$PY" "$KS/scripts/search_notes.py" "terms" --project "Luka Rajhl" --json
"$PY" "$KS/scripts/create_note.py" "Title" --project "Luka Rajhl" --category Architecture --tags a,b
```
