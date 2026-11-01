import { describe, expect, it } from "vitest";
import { pgConnectionString } from "./db";

/** CLAUDE.md DB4: these quirks are why the connection works on Vercel at all. */
describe("pgConnectionString", () => {
  it("prefers DATABASE_URL and falls back to the integration's POSTGRES_URL", () => {
    expect(pgConnectionString({ DATABASE_URL: "postgres://a@h/db", POSTGRES_URL: "postgres://b@h/db" })).toContain("a@h");
    expect(pgConnectionString({ POSTGRES_URL: "postgres://b@h/db" })).toContain("b@h");
  });

  it("strips sslmode/ssl so the pool's explicit ssl option governs", () => {
    const out = pgConnectionString({ POSTGRES_URL: "postgres://u:p@h:6543/db?sslmode=require&ssl=true&pgbouncer=true" });
    expect(out).not.toMatch(/sslmode|ssl=/);
    expect(out).toContain("pgbouncer=true");
  });

  it("returns empty when nothing is configured", () => {
    expect(pgConnectionString({})).toBe("");
  });
});
