import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rootTokens, tokenReader } from "./css-tokens";

describe("rootTokens", () => {
  const css = `
@import "x";
:root {
  /* a comment with --fake: #000; inside */
  --bg: #CBC6DA;
  --bg-2:#D6D2E3;
  --hair-2: rgba(24, 19, 46, 0.26);
}
.other { --bg: #FFFFFF; }
`;

  it("reads declarations from :root, including dashed names and rgba values", () => {
    expect(rootTokens(css)).toEqual({ bg: "#CBC6DA", "bg-2": "#D6D2E3", "hair-2": "rgba(24, 19, 46, 0.26)" });
  });

  it("ignores comments and declarations outside :root", () => {
    expect(rootTokens(css).fake).toBeUndefined();
    expect(rootTokens(css).bg).toBe("#CBC6DA");
  });

  it("returns nothing when there is no :root block", () => {
    expect(rootTokens(".a { --bg: red; }")).toEqual({});
  });
});

describe("tokenReader", () => {
  it("throws on a missing token rather than returning undefined", () => {
    const t = tokenReader({ bg: "#CBC6DA" });
    expect(t("bg")).toBe("#CBC6DA");
    expect(() => t("nope")).toThrow(/--nope/);
  });

  // The share card reads these at build time; a rename in globals.css should
  // turn this red before it fails the build.
  it("finds every token the share card uses in the real globals.css", () => {
    const t = tokenReader(rootTokens(readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")));
    for (const name of ["bg", "bg-2", "bg-3", "surface", "surface-2", "ink", "muted", "accent", "accent-deep", "magenta", "amber-lit", "on-accent", "hair-2"]) {
      expect(t(name)).toMatch(/^(#|rgba\()/);
    }
  });
});
