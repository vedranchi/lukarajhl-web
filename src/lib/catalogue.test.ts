import { describe, expect, it } from "vitest";
import catalogue from "@/data/beatstars-catalogue.json";
import { lowestLeasePrice, splitBeatTitle } from "./catalogue";

describe("splitBeatTitle", () => {
  it("pulls the quoted name out of a dashed title", () => {
    expect(splitBeatTitle('fakemink + easter pink type beat - "go away"')).toEqual({
      name: "go away",
      tags: "fakemink + easter pink type beat",
    });
  });

  it("handles a title with no dash before the quotes", () => {
    expect(splitBeatTitle('fakemink + suzy sheer + snow strippers type beat "leave now"')).toEqual({
      name: "leave now",
      tags: "fakemink + suzy sheer + snow strippers type beat",
    });
  });

  it("keeps punctuation inside the name", () => {
    expect(splitBeatTitle('fakemink + feng type beat - "why did you leave?"').name).toBe("why did you leave?");
  });

  it("accepts curly quotes and keeps apostrophes", () => {
    expect(splitBeatTitle("nettspend type beat – “don't stop”")).toEqual({
      name: "don't stop",
      tags: "nettspend type beat",
    });
  });

  it("keeps text after the quotes as part of the tags", () => {
    expect(splitBeatTitle('"prague" | esdeekid type beat')).toEqual({ name: "prague", tags: "esdeekid type beat" });
  });

  it("falls back to the last dash when nothing is quoted", () => {
    expect(splitBeatTitle("feng type beat - white noise")).toEqual({ name: "white noise", tags: "feng type beat" });
  });

  it("returns the whole title as the name when there is nothing to split", () => {
    expect(splitBeatTitle("untitled")).toEqual({ name: "untitled", tags: null });
    expect(splitBeatTitle('"just a name"')).toEqual({ name: "just a name", tags: null });
    expect(splitBeatTitle('type beat ""')).toEqual({ name: 'type beat ""', tags: null });
  });

  // Only "non-empty": the refresh workflow rewrites this file unattended, and a
  // future title with nothing to split is legitimate (it renders whole).
  it("gives every beat in the committed catalogue a non-empty name", () => {
    for (const beat of catalogue.beats) {
      expect(splitBeatTitle(beat.title).name.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("lowestLeasePrice", () => {
  const beat = (price: string | null) => ({ license: { price } });

  it("returns the cheapest paid price as written", () => {
    expect(lowestLeasePrice([beat("$34.99"), beat("$29.99"), beat("$49.99")])).toBe("$29.99");
  });

  it("ignores free, missing and unparseable prices", () => {
    expect(lowestLeasePrice([beat(null), beat("$0"), beat("Free"), beat("$19.99")])).toBe("$19.99");
  });

  it("is null when nothing has a price", () => {
    expect(lowestLeasePrice([])).toBeNull();
    expect(lowestLeasePrice([beat(null)])).toBeNull();
  });
});
