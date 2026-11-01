import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  pgInviteStore,
  recordInviteRequest,
  type InviteRow,
  type InviteStore,
} from "./invite-requests";

/**
 * The invite write path (CLAUDE.md T2). These replace the old Payload
 * collection-hook tests one for one: canonical handle, user-agent cap, default
 * source, dedupe window, email → status stamp, never-throw after the insert,
 * and the structured log line. The SQL layer is checked against a fake client
 * for parameterisation and transaction handling.
 */

const track = (n: number) => ({
  path: `requests/2026-07/abc/${n}.mp3`,
  originalName: `${n}.mp3`,
  sizeBytes: 4_000_000,
  url: `https://storage.test/${n}?token=t`,
});
const tracks = [track(1), track(2), track(3)];

/** Every method a typed vi.fn, so tests can read `.mock` and still pass it as
    an InviteStore. Overrides are any mock; the cast keeps the typed shape. */
function fakeStore(overrides: Partial<Record<keyof InviteStore, ReturnType<typeof vi.fn>>> = {}) {
  const defaults = {
    countByIpSince: vi.fn<InviteStore["countByIpSince"]>().mockResolvedValue(0),
    countByHandleSince: vi.fn<InviteStore["countByHandleSince"]>().mockResolvedValue(0),
    insert: vi.fn<InviteStore["insert"]>().mockResolvedValue({ id: 7, createdAt: "2026-07-12T10:00:00.000Z" }),
    setEmailOutcome: vi.fn<InviteStore["setEmailOutcome"]>().mockResolvedValue(undefined),
  };
  return { ...defaults, ...overrides } as typeof defaults;
}

const OLD_ENV = process.env;
let info: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  process.env = { ...OLD_ENV };
  delete process.env.INVITE_DEDUPE_WINDOW_MS;
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.env = OLD_ENV;
  info.mockRestore();
  error.mockRestore();
});

describe("recordInviteRequest — what gets stored", () => {
  it("stores the canonical lowercased @handle", async () => {
    const store = fakeStore();
    await recordInviteRequest({ instagram: "Luka.Rajhl", tracks }, { store, send: vi.fn().mockResolvedValue({ ok: true }) });
    expect((store.insert.mock.calls[0][0] as InviteRow).instagram).toBe("@luka.rajhl");
  });

  it("rejects an invalid handle before touching the store", async () => {
    const store = fakeStore();
    await expect(
      recordInviteRequest({ instagram: "no spaces allowed", tracks }, { store, send: vi.fn() }),
    ).rejects.toThrow(/Instagram username/);
    expect(store.insert).not.toHaveBeenCalled();
    expect(store.countByHandleSince).not.toHaveBeenCalled();
  });

  it("caps an over-long user agent at 500 chars", async () => {
    const store = fakeStore();
    await recordInviteRequest(
      { instagram: "luka", tracks, userAgent: "x".repeat(900) },
      { store, send: vi.fn().mockResolvedValue({ ok: true }) },
    );
    expect((store.insert.mock.calls[0][0] as InviteRow).userAgent).toHaveLength(500);
  });

  it("defaults source to invite-form and nulls absent optionals", async () => {
    const store = fakeStore();
    await recordInviteRequest({ instagram: "luka", tracks }, { store, send: vi.fn().mockResolvedValue({ ok: true }) });
    expect(store.insert.mock.calls[0][0]).toMatchObject({
      source: "invite-form",
      ip: null,
      userAgent: null,
      elapsedMs: null,
      tracks,
    });
  });

  it("keeps an explicit source", async () => {
    const store = fakeStore();
    await recordInviteRequest(
      { instagram: "luka", tracks, source: "second-cta" },
      { store, send: vi.fn().mockResolvedValue({ ok: true }) },
    );
    expect((store.insert.mock.calls[0][0] as InviteRow).source).toBe("second-cta");
  });

  it("propagates an insert failure so the visitor is told to retry", async () => {
    const send = vi.fn();
    const store = fakeStore({ insert: vi.fn().mockRejectedValue(new Error("db down")) });
    await expect(recordInviteRequest({ instagram: "luka", tracks }, { store, send })).rejects.toThrow("db down");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("recordInviteRequest — duplicates", () => {
  it("stores a new lead as new when no same-handle lead is in the window", async () => {
    const store = fakeStore();
    await recordInviteRequest({ instagram: "luka", tracks }, { store, send: vi.fn().mockResolvedValue({ ok: true }) });
    expect((store.insert.mock.calls[0][0] as InviteRow).status).toBe("new");
    expect(store.countByHandleSince.mock.calls[0][0]).toBe("@luka");
  });

  it("stores a repeat as duplicate and sends no second email", async () => {
    const send = vi.fn();
    const store = fakeStore({ countByHandleSince: vi.fn().mockResolvedValue(1) });
    const res = await recordInviteRequest({ instagram: "luka", tracks }, { store, send });
    expect((store.insert.mock.calls[0][0] as InviteRow).status).toBe("duplicate");
    expect(res.status).toBe("duplicate");
    expect(send).not.toHaveBeenCalled();
    expect(store.setEmailOutcome).not.toHaveBeenCalled();
  });

  it("looks back 24h by default and honours INVITE_DEDUPE_WINDOW_MS", async () => {
    const store = fakeStore();
    const send = vi.fn().mockResolvedValue({ ok: true });
    let before = Date.now();
    await recordInviteRequest({ instagram: "luka", tracks }, { store, send });
    let since = (store.countByHandleSince.mock.calls[0][1] as Date).getTime();
    expect(before - since).toBeGreaterThanOrEqual(24 * 3600_000 - 100);
    expect(before - since).toBeLessThan(24 * 3600_000 + 2_000);

    process.env.INVITE_DEDUPE_WINDOW_MS = "1000";
    before = Date.now();
    await recordInviteRequest({ instagram: "luka", tracks }, { store, send });
    since = (store.countByHandleSince.mock.calls[1][1] as Date).getTime();
    expect(before - since).toBeGreaterThanOrEqual(900);
    expect(before - since).toBeLessThan(2000);
  });
});

describe("recordInviteRequest — email and status", () => {
  it("emails the owner with the stored row, then stamps emailed", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    const store = fakeStore();
    const res = await recordInviteRequest({ instagram: "luka", tracks, ip: "203.0.113.5" }, { store, send });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual({ instagram: "@luka", createdAt: "2026-07-12T10:00:00.000Z", tracks });
    expect(send.mock.calls[0][0]).not.toHaveProperty("ip");
    expect(store.setEmailOutcome).toHaveBeenCalledWith(7, { status: "emailed", sentAt: expect.any(String) });
    expect(res).toEqual({ id: 7, status: "emailed" });
  });

  it("stamps email_failed with the error when the send fails", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, error: "domain not verified" });
    const store = fakeStore();
    const res = await recordInviteRequest({ instagram: "luka", tracks }, { store, send });
    expect(store.setEmailOutcome).toHaveBeenCalledWith(7, { status: "email_failed", error: "domain not verified" });
    expect(res.status).toBe("email_failed");
  });

  it("never throws once the lead is stored, even if the stamp fails", async () => {
    const store = fakeStore({ setEmailOutcome: vi.fn().mockRejectedValue(new Error("db gone")) });
    await expect(
      recordInviteRequest({ instagram: "luka", tracks }, { store, send: vi.fn().mockResolvedValue({ ok: true }) }),
    ).resolves.toMatchObject({ id: 7 });
  });
});

describe("recordInviteRequest — logging", () => {
  it("logs one structured line with no handle or email body", async () => {
    await recordInviteRequest(
      { instagram: "luka", tracks, ip: "203.0.113.5", elapsedMs: 4200 },
      { store: fakeStore(), send: vi.fn().mockResolvedValue({ ok: true }) },
    );
    expect(info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(info.mock.calls[0][0] as string)).toEqual({
      evt: "invite_request",
      id: 7,
      status: "new",
      ip: "203.0.113.5",
      elapsedMs: 4200,
    });
  });

  it("nulls missing ip/elapsedMs", async () => {
    await recordInviteRequest({ instagram: "luka", tracks }, { store: fakeStore(), send: vi.fn().mockResolvedValue({ ok: true }) });
    const logged = JSON.parse(info.mock.calls[0][0] as string);
    expect(logged.ip).toBeNull();
    expect(logged.elapsedMs).toBeNull();
    expect(JSON.stringify(logged)).not.toContain("luka");
  });
});

describe("pgInviteStore (SQL layer)", () => {
  type Call = { text: string; values?: unknown[] };

  function fakePool(opts: { failOnTrack?: number } = {}) {
    const calls: Call[] = [];
    let trackInserts = 0;
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      if (text.includes("insert into invite_requests_tracks")) {
        trackInserts += 1;
        if (trackInserts === opts.failOnTrack) throw new Error("fk violation");
      }
      if (text.includes("insert into invite_requests ")) {
        return { rows: [{ id: 41, created_at: new Date("2026-07-12T10:00:00.000Z") }] };
      }
      if (text.startsWith("select count")) return { rows: [{ n: 2 }] };
      return { rows: [] };
    });
    const release = vi.fn();
    const pool = { query, connect: vi.fn(async () => ({ query, release })) } as unknown as Pool;
    return { pool, calls, release };
  }

  const row: InviteRow = {
    instagram: "@luka",
    tracks,
    status: "new",
    source: "invite-form",
    ip: "203.0.113.5",
    userAgent: "ua",
    elapsedMs: 4200,
  };

  it("counts with bound parameters, never interpolated values", async () => {
    const { pool, calls } = fakePool();
    const store = pgInviteStore(() => pool);
    const since = new Date("2026-07-12T09:00:00.000Z");
    expect(await store.countByIpSince("203.0.113.5' or 1=1 --", since)).toBe(2);
    expect(await store.countByHandleSince("@luka", since)).toBe(2);
    expect(calls[0].text).not.toContain("203.0.113.5");
    expect(calls[0].values).toEqual(["203.0.113.5' or 1=1 --", since.toISOString()]);
    expect(calls[1].values).toEqual(["@luka", since.toISOString()]);
  });

  it("inserts the row and its tracks in one transaction, in Payload's shape", async () => {
    const { pool, calls, release } = fakePool();
    const res = await pgInviteStore(() => pool).insert(row);

    expect(res).toEqual({ id: 41, createdAt: "2026-07-12T10:00:00.000Z" });
    expect(calls.map((c) => c.text.split(/\s+/).slice(0, 3).join(" "))).toEqual([
      "begin",
      "insert into invite_requests",
      "insert into invite_requests_tracks",
      "insert into invite_requests_tracks",
      "insert into invite_requests_tracks",
      "commit",
    ]);
    const trackRows = calls.filter((c) => c.text.includes("invite_requests_tracks")).map((c) => c.values!);
    expect(trackRows.map((v) => v[0])).toEqual([1, 2, 3]); // 1-based _order
    expect(trackRows.every((v) => v[1] === 41)).toBe(true); // _parent_id
    expect(trackRows.every((v) => /^[0-9a-f]{24}$/.test(String(v[2])))).toBe(true); // id
    expect(new Set(trackRows.map((v) => v[2])).size).toBe(3);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("rolls back and releases when a track insert fails", async () => {
    const { pool, calls, release } = fakePool({ failOnTrack: 2 });
    await expect(pgInviteStore(() => pool).insert(row)).rejects.toThrow("fk violation");
    expect(calls.at(-1)?.text).toBe("rollback");
    expect(calls.some((c) => c.text === "commit")).toBe(false);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("stamps the email outcome and bumps updated_at", async () => {
    const { pool, calls } = fakePool();
    const store = pgInviteStore(() => pool);
    await store.setEmailOutcome(41, { status: "emailed", sentAt: "2026-07-12T10:00:01.000Z" });
    await store.setEmailOutcome(41, { status: "email_failed", error: "x".repeat(5000) });
    expect(calls[0].text).toContain("updated_at = now()");
    expect(calls[0].values).toEqual([41, "emailed", "2026-07-12T10:00:01.000Z", null]);
    expect(calls[1].values?.slice(0, 3)).toEqual([41, "email_failed", null]);
    expect(String(calls[1].values?.[3])).toHaveLength(1000);
  });
});
