// =============================================================================
// Tests: Career Fair booth search index (#4157)
// =============================================================================

import { describe, it, expect } from "vitest";
import { buildSearchIndex, parseHiringTags, searchBooths } from "./search";
import { FloorplanAsset } from "./types";

const asset = (id: string, patch: Partial<FloorplanAsset> = {}): FloorplanAsset => ({
  id,
  kind: "rect_table",
  label: `Table ${id}`,
  x: 0,
  y: 0,
  width: 6,
  height: 3,
  assignment: null,
  ...patch,
});

const booths: FloorplanAsset[] = [
  asset("1", {
    label: "Table A",
    assignment: {
      sponsorId: "s1",
      companyName: "TacoCorp",
      hiringTags: ["Internship", "Software Engineer", "CS Major"],
    },
  }),
  asset("2", {
    label: "Table B",
    assignment: {
      sponsorId: "s2",
      companyName: "BitWorks",
      hiringTags: ["Full-time", "Data Analyst"],
    },
  }),
  asset("3", { label: "Stage" }), // no sponsor -> never matches
];

describe("parseHiringTags (#4157)", () => {
  it("splits on commas and trims whitespace", () => {
    expect(parseHiringTags(" Internship , Data Analyst ,, CS ")).toEqual([
      "Internship",
      "Data Analyst",
      "CS",
    ]);
  });

  it("de-duplicates case-insensitively and drops empties", () => {
    expect(parseHiringTags("Internship, internship,,,INTERNSHIP")).toEqual(["Internship"]);
    expect(parseHiringTags("   ")).toEqual([]);
  });
});

describe("searchBooths (#4157)", () => {
  it("returns null for empty/whitespace queries (no filtering)", () => {
    expect(searchBooths(booths, "")).toBeNull();
    expect(searchBooths(booths, "   ")).toBeNull();
  });

  it("matches by company name, case-insensitively", () => {
    expect(searchBooths(booths, "tacocorp")).toEqual(new Set(["1"]));
    expect(searchBooths(booths, "BITWORKS")).toEqual(new Set(["2"]));
  });

  it("matches by hiring tag (role/major)", () => {
    expect(searchBooths(booths, "internship")).toEqual(new Set(["1"]));
    expect(searchBooths(booths, "data analyst")).toEqual(new Set(["2"]));
  });

  it("matches partial words like 'intern'", () => {
    expect(searchBooths(booths, "Intern")).toEqual(new Set(["1"]));
  });

  it("ANDs multiple terms across fields of the same booth", () => {
    // Both terms must match Table A's indexed fields
    expect(searchBooths(booths, "tacocorp internship")).toEqual(new Set(["1"]));
    // No booth is both a taco company and full-time
    expect(searchBooths(booths, "tacocorp full-time")).toEqual(new Set());
  });

  it("matches table labels too (and excludes non-table assets)", () => {
    expect(searchBooths(booths, "table")).toEqual(new Set(["1", "2"]));
  });

  it("never matches assets without an assignment on tag terms", () => {
    expect(searchBooths(booths, "stage")).toEqual(new Set(["3"]));
    expect(searchBooths(booths, "internship")).not.toContain("3");
  });

  it("accepts a prebuilt index", () => {
    const index = buildSearchIndex(booths);
    expect(searchBooths(booths, "analyst", index)).toEqual(new Set(["2"]));
    expect(index.size).toBe(3);
  });
});
