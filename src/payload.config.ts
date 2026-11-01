import path from "path";
import { fileURLToPath } from "url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig, type SharpDependency } from "payload";
import sharp from "sharp";

import { requirePayloadSecret } from "./lib/env";
import { InviteRequests } from "./collections/InviteRequests";
import { Users } from "./collections/Users";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

/**
 * Postgres connection string. Local dev sets DATABASE_URL by hand; on Vercel the
 * Supabase integration injects POSTGRES_URL instead (it never creates
 * DATABASE_URL), so fall back to it — this keeps the app working against a stock
 * Supabase↔Vercel setup and survives credential rotation.
 *
 * The integration's URL carries `sslmode=require`, which recent node-postgres
 * coerces to `verify-full` and then rejects Supabase's self-signed cert chain —
 * and that string param overrides the pool's explicit `ssl` option. Strip
 * `sslmode` so our `ssl: { rejectUnauthorized: false }` governs (TLS stays on,
 * only the chain check is skipped).
 */
function pgConnectionString(): string {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    return url.toString();
  } catch {
    return raw;
  }
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: "· Luka Rajhl",
    },
  },
  // Only these two are load-bearing. Beats/Kits/Channels/Media collections and a
  // SiteSettings global used to live here, mirroring src/data/content.ts, but
  // nothing ever read them — the public site renders from src/data/content.ts and
  // src/data/beatstars-catalogue.json. They were removed rather than left as empty
  // publicly-readable endpoints.
  collections: [Users, InviteRequests],
  editor: lexicalEditor(),
  // Throws rather than falling back to "" — an empty signing secret makes every
  // admin session forgeable. See requirePayloadSecret() for the build-phase
  // carve-out that keeps `next build` from hard-failing on it.
  secret: requirePayloadSecret(),
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      // See pgConnectionString() above: resolves DATABASE_URL → POSTGRES_URL and
      // strips `sslmode` so the explicit ssl option below is what applies.
      connectionString: pgConnectionString(),
      // TLS stays on; only Supabase's self-signed chain check is skipped.
      ssl: { rejectUnauthorized: false },
    },
  }),
  // Cast: sharp's overloaded default export isn't structurally assignable to
  // Payload's single-signature SharpDependency type (declaration-only friction;
  // the value is a valid sharp instance at runtime).
  sharp: sharp as unknown as SharpDependency,
  // No plugins: the @payloadcms/storage-s3 adapter was only ever attached to the
  // `media` collection. With no upload collections left there is nothing to store,
  // so the S3/Supabase Storage wiring (and its four S3_* env vars) is gone too.
});
