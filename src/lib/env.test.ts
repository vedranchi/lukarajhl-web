import { describe, expect, it } from "vitest";
import { MIN_SECRET_LENGTH, envInt, isPayloadCodegen, requirePayloadSecret, servedOverHttps } from "./env";

describe("envInt", () => {
  it("falls back when unset", () => {
    expect(envInt(undefined, 3)).toBe(3);
  });

  it("falls back when blank/whitespace", () => {
    expect(envInt("", 3)).toBe(3);
    expect(envInt("   ", 3)).toBe(3);
  });

  it("falls back when not a finite number", () => {
    expect(envInt("abc", 3)).toBe(3);
    expect(envInt("NaN", 3)).toBe(3);
  });

  it("honors an explicit 0", () => {
    expect(envInt("0", 3)).toBe(0);
  });

  it("parses a valid integer", () => {
    expect(envInt("5", 3)).toBe(5);
    expect(envInt("3600000", 60_000)).toBe(3_600_000);
  });
});

/**
 * Security regressions. Both helpers decide whether the admin login — the only
 * thing in front of the applicants' personal data — is safe, so a revert has to
 * turn a test red rather than pass silently.
 */
describe("servedOverHttps", () => {
  it("is true on Vercel production and preview (both HTTPS-only)", () => {
    expect(servedOverHttps({ VERCEL_ENV: "production" })).toBe(true);
    expect(servedOverHttps({ VERCEL_ENV: "preview" })).toBe(true);
  });

  it("is false locally, so a Secure cookie never breaks a local login", () => {
    expect(servedOverHttps({})).toBe(false);
    expect(servedOverHttps({ VERCEL_ENV: "development" })).toBe(false);
    // A local `pnpm build && pnpm start` serves http://localhost under
    // NODE_ENV=production — precisely the case NODE_ENV gating would get wrong.
    expect(servedOverHttps({ NODE_ENV: "production" })).toBe(false);
  });
});

describe("requirePayloadSecret", () => {
  const good = "x".repeat(MIN_SECRET_LENGTH);

  it("returns a secret of sufficient length", () => {
    expect(requirePayloadSecret({ PAYLOAD_SECRET: good }, false)).toBe(good);
  });

  it("throws rather than signing sessions with an empty secret", () => {
    expect(() => requirePayloadSecret({}, false)).toThrow(/PAYLOAD_SECRET/);
    expect(() => requirePayloadSecret({ PAYLOAD_SECRET: "" }, false)).toThrow(/PAYLOAD_SECRET/);
  });

  it("throws on a secret too short to be worth signing with", () => {
    expect(() => requirePayloadSecret({ PAYLOAD_SECRET: "short" }, false)).toThrow(/PAYLOAD_SECRET/);
    expect(() =>
      requirePayloadSecret({ PAYLOAD_SECRET: "y".repeat(MIN_SECRET_LENGTH - 1) }, false),
    ).toThrow(/PAYLOAD_SECRET/);
  });

  it("does not hard-fail `next build`, which only imports the config for routes", () => {
    expect(requirePayloadSecret({}, true)).toBe("");
    expect(requirePayloadSecret({ NEXT_PHASE: "phase-production-build" })).toBe("");
  });

  it("still throws at runtime when the build phase is over", () => {
    expect(() => requirePayloadSecret({ NEXT_PHASE: "phase-production-server" })).toThrow();
  });
});

describe("isPayloadCodegen", () => {
  const bin = ["/usr/bin/node", "/repo/node_modules/payload/bin.js"];

  it("matches the Payload code generators DoD2 and DB7 run", () => {
    expect(isPayloadCodegen([...bin, "generate:types"])).toBe(true);
    expect(isPayloadCodegen([...bin, "generate:importmap"])).toBe(true);
    expect(isPayloadCodegen([...bin, "generate:db-schema"])).toBe(true);
  });

  it("does not exempt the server or commands that touch the database", () => {
    expect(isPayloadCodegen(["/usr/bin/node", "/repo/node_modules/next/dist/bin/next", "start"])).toBe(false);
    expect(isPayloadCodegen([...bin, "migrate"])).toBe(false);
    expect(isPayloadCodegen([...bin, "run", "scripts/seed.ts"])).toBe(false);
  });
});
