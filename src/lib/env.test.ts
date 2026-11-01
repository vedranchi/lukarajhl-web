import { describe, expect, it } from "vitest";
import { envInt } from "./env";

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
