import type { CollectionConfig } from "payload";
import { servedOverHttps } from "@/lib/env";

/**
 * Users — Payload admin auth. This is the login the client (Luka) uses at
 * /admin, and the same auth layer the Phase-2 analytics dashboard builds on.
 */
export const Users: CollectionConfig = {
  slug: "users",
  admin: {
    useAsTitle: "email",
    group: "System",
  },
  // `auth: true` would take Payload's cookie defaults, which are
  // `{ sameSite: "Lax", secure: false }` — i.e. the admin session cookie ships
  // without `Secure` in production, so any plain-http request to the domain
  // would carry it. This is the login guarding the applicants' personal data
  // (CLAUDE.md DB5), so set both explicitly. `sameSite: "Lax"` matches the
  // default and is spelled out so a future change is a deliberate one; it is
  // also what keeps the admin's cookie off cross-site POSTs.
  auth: {
    cookies: {
      sameSite: "Lax",
      secure: servedOverHttps(),
    },
  },
  fields: [
    {
      name: "name",
      type: "text",
    },
  ],
};
