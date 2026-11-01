import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  MAX_TRACK_BYTES,
  MIN_TRACK_BYTES,
  TRACK_COUNT,
  deleteObjects,
  prepareUploads,
  signDownloadUrl,
  recentUploadCount,
  statObject,
  uploadsAreFlooded,
  validateTrackInputs,
  verifyClaim,
} from "./track-uploads";

const OLD_ENV = process.env;

beforeEach(() => {
  process.env = {
    ...OLD_ENV,
    PAYLOAD_SECRET: "x".repeat(64),
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
    INVITE_TRACKS_BUCKET: "invite-tracks",
  };
});

afterEach(() => {
  process.env = OLD_ENV;
  vi.unstubAllGlobals();
});

const mp3 = (name = "beat.mp3", size = 5_000_000, type = "audio/mpeg") => ({ name, size, type });
const three = () => [mp3("a.mp3"), mp3("b.mp3"), mp3("c.mp3")];

describe("validateTrackInputs", () => {
  it("accepts exactly three mp3s", () => {
    const res = validateTrackInputs(three());
    expect(res.ok).toBe(true);
  });

  it("rejects fewer than three and says how many were attached", () => {
    const res = validateTrackInputs([mp3(), mp3()]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("You attached 2");
  });

  it("rejects more than three", () => {
    expect(validateTrackInputs([mp3(), mp3(), mp3(), mp3()]).ok).toBe(false);
  });

  it("rejects a non-array, so a malformed post cannot reach storage", () => {
    for (const bad of [undefined, null, "3", {}, 3]) {
      expect(validateTrackInputs(bad).ok).toBe(false);
    }
  });

  it("rejects entries that are not file descriptors", () => {
    expect(validateTrackInputs([mp3(), mp3(), "nope"]).ok).toBe(false);
    expect(validateTrackInputs([mp3(), mp3(), { name: "a.mp3", size: "big", type: "audio/mpeg" }]).ok).toBe(false);
  });

  it("rejects a wav even when the extension lies", () => {
    expect(validateTrackInputs([mp3(), mp3(), mp3("track.wav")]).ok).toBe(false);
    expect(validateTrackInputs([mp3(), mp3(), mp3("track.mp3", 5_000, "audio/wav")]).ok).toBe(false);
  });

  it("accepts the mime variants browsers actually report for mp3", () => {
    expect(validateTrackInputs([mp3("a.mp3", 5_000, "audio/mp3"), mp3(), mp3("c.MP3")]).ok).toBe(true);
  });

  it("rejects an oversized file and names it", () => {
    const res = validateTrackInputs([mp3(), mp3(), mp3("huge.mp3", MAX_TRACK_BYTES + 1)]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("huge.mp3");
  });

  it("rejects an empty or stub file", () => {
    expect(validateTrackInputs([mp3(), mp3(), mp3("stub.mp3", MIN_TRACK_BYTES - 1)]).ok).toBe(false);
  });

  it("accepts a file exactly on each boundary", () => {
    expect(validateTrackInputs([mp3("a.mp3", MIN_TRACK_BYTES), mp3(), mp3("c.mp3", MAX_TRACK_BYTES)]).ok).toBe(true);
  });
});

describe("prepareUploads + verifyClaim", () => {
  function mockSign() {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const path = String(url).split(`/invite-tracks/`)[1];
      return Promise.resolve({ ok: true, json: async () => ({ url: `/object/upload/sign/invite-tracks/${path}?token=t` }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("mints one signed target per track, with server-generated paths", async () => {
    mockSign();
    const res = await prepareUploads(three());
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.prepared.targets).toHaveLength(TRACK_COUNT);
    for (const [i, t] of res.prepared.targets.entries()) {
      // requests/<yyyy-mm>/<uuid>/<n>.mp3 — no part of this comes from the client
      expect(t.path).toMatch(new RegExp(`^requests/\\d{4}-\\d{2}/[0-9a-f-]{36}/${i + 1}\\.mp3$`));
      expect(t.uploadUrl.startsWith("https://project.supabase.co/storage/v1/")).toBe(true);
    }
    // the applicant's own filenames never become object paths
    expect(res.prepared.targets.some((t) => t.path.includes("a.mp3"))).toBe(false);
  });

  it("issues a claim that verifies against its own paths", async () => {
    mockSign();
    const res = await prepareUploads(three());
    if (!res.ok) throw new Error("expected ok");
    const paths = res.prepared.targets.map((t) => t.path);
    expect(verifyClaim(res.prepared.claim, paths)).toBe(true);
  });

  it("rejects a claim for paths it was not issued for", async () => {
    mockSign();
    const res = await prepareUploads(three());
    if (!res.ok) throw new Error("expected ok");
    const paths = res.prepared.targets.map((t) => t.path);
    expect(verifyClaim(res.prepared.claim, [...paths.slice(0, 2), "requests/2026-01/other/3.mp3"])).toBe(false);
    expect(verifyClaim(res.prepared.claim, paths.slice(0, 2))).toBe(false);
  });

  it("rejects a tampered signature, an expired claim and junk", async () => {
    mockSign();
    const res = await prepareUploads(three());
    if (!res.ok) throw new Error("expected ok");
    const paths = res.prepared.targets.map((t) => t.path);
    const [exp, sig] = res.prepared.claim.split(".");

    expect(verifyClaim(`${exp}.${sig.slice(0, -1)}x`, paths)).toBe(false);
    expect(verifyClaim(`${Date.now() - 1000}.${sig}`, paths)).toBe(false);
    for (const bad of ["", "nonsense", undefined, null, 42, `${exp}.`]) {
      expect(verifyClaim(bad, paths)).toBe(false);
    }
  });

  it("fails closed when PAYLOAD_SECRET is missing rather than signing with an empty key", async () => {
    mockSign();
    delete process.env.PAYLOAD_SECRET;
    const res = await prepareUploads(three());
    expect(res.ok).toBe(false);
    expect(verifyClaim("anything", ["a"])).toBe(false);
  });

  it("fails closed when storage is unconfigured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await prepareUploads(three());
    expect(res.ok).toBe(false);
  });

  it("reports failure when Supabase refuses to sign", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const res = await prepareUploads(three());
    expect(res.ok).toBe(false);
  });
});

describe("statObject", () => {
  const info = (over: Record<string, unknown> = {}) => ({
    ok: true,
    json: async () => ({ size: 5_000_000, content_type: "audio/mpeg", ...over }),
  });

  it("accepts a real mp3 of a sane size", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(info()));
    const res = await statObject("requests/2026-09/x/1.mp3");
    expect(res).toEqual({ ok: true, sizeBytes: 5_000_000 });
  });

  it("rejects an object that is not there", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    expect((await statObject("missing.mp3")).ok).toBe(false);
  });

  it("rejects a stored object whose real type is not mp3", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(info({ content_type: "audio/wav" })));
    expect((await statObject("x.mp3")).ok).toBe(false);
  });

  it("rejects a stored object outside the size bounds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(info({ size: MAX_TRACK_BYTES + 1 })));
    expect((await statObject("x.mp3")).ok).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(info({ size: 10 })));
    expect((await statObject("x.mp3")).ok).toBe(false);
  });
});

describe("signDownloadUrl / deleteObjects", () => {
  it("returns an absolute signed url", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ signedURL: "/object/sign/invite-tracks/x.mp3?token=t" }) }));
    expect(await signDownloadUrl("x.mp3")).toBe(
      "https://project.supabase.co/storage/v1/object/sign/invite-tracks/x.mp3?token=t",
    );
  });

  it("returns null instead of throwing when signing fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await signDownloadUrl("x.mp3")).toBeNull();
  });

  it("deletes by prefix list and no-ops on an empty list", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    expect(await deleteObjects(["a.mp3", "b.mp3"])).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ prefixes: ["a.mp3", "b.mp3"] });
    expect(await deleteObjects([])).toBe(false);
  });
});

describe("recentUploadCount / uploadsAreFlooded", () => {
  // Pinned mid-month by default. The month lookback depends on the date, and an
  // unpinned clock made the first test fail on the 1st of every month.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const monthOf = (createdAt: string) => createdAt.slice(0, 7);

  /** list returns folders (id:null) at the month prefix, files one level down.
      Each file lives under the month it was created in, like the real bucket,
      so a walk of two months never sees the same object twice. */
  function mockBucket(files: { created_at: string }[]) {
    return vi.fn().mockImplementation((_url: string, init: { body: string }) => {
      const { prefix } = JSON.parse(init.body) as { prefix: string };
      const month = /^requests\/(\d{4}-\d{2})$/.exec(prefix)?.[1];
      const folder = /^requests\/(\d{4}-\d{2})\/folder$/.exec(prefix)?.[1];
      const rows = month
        ? [{ name: "folder", id: null }]
        : files.filter((f) => monthOf(f.created_at) === folder);
      return Promise.resolve({ ok: true, json: async () => rows });
    });
  }

  it("counts only objects from the last hour, ignoring older ones", async () => {
    vi.stubGlobal("fetch", mockBucket([{ created_at: iso(10) }, { created_at: iso(30) }, { created_at: iso(240) }]));
    expect(await recentUploadCount()).toBe(2);
  });

  it("still sees last month's folder just after midnight on the 1st", async () => {
    vi.setSystemTime(new Date("2026-07-01T00:20:00Z"));
    // 10 min ago is July; 30 and 240 min ago are June, a different prefix.
    vi.stubGlobal("fetch", mockBucket([{ created_at: iso(10) }, { created_at: iso(30) }, { created_at: iso(240) }]));
    expect(await recentUploadCount()).toBe(2);
  });

  it("does not flood-block a normal trickle of applications", async () => {
    vi.stubGlobal("fetch", mockBucket([{ created_at: iso(5) }, { created_at: iso(6) }, { created_at: iso(7) }]));
    expect(await uploadsAreFlooded()).toBe(false);
  });

  it("blocks once the hourly ceiling is reached", async () => {
    vi.stubGlobal("fetch", mockBucket(Array.from({ length: 60 }, () => ({ created_at: iso(5) }))));
    expect(await uploadsAreFlooded()).toBe(true);
  });

  it("fails open rather than blocking real applicants when storage errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await uploadsAreFlooded()).toBe(false);
  });

  it("counts nothing when storage is unconfigured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(await recentUploadCount()).toBe(0);
  });
});
