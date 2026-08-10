import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FuzzySearchEngine } from "../src/search/fuzzySearch";

describe("FuzzySearchEngine Unit Tests", () => {
  let engine: FuzzySearchEngine;
  const dataset = [
    "Apple",
    "Banana",
    "Cherry",
    "Milan Rathod",
    "Campus Connect Club",
    "Rust Language",
    "WebAssembly is fast",
  ];

  beforeAll(async () => {
    engine = await FuzzySearchEngine.create(dataset);
  });

  afterAll(() => {
    if (engine) engine.terminate();
  });

  it("finds exact matches", async () => {
    const results = await engine.search("Apple", 0);
    expect(results.length).toBe(1);
    expect(results[0]).toBe(0);
  });

  it("finds partial/fuzzy matches with distance", async () => {
    // "Mlan" has distance 1 from "Milan"
    const results = await engine.search("Mlan", 1);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toBe(3); // Milan Rathod
  });

  it("returns empty array for no match", async () => {
    const results = await engine.search("Zebra", 0);
    expect(results.length).toBe(0);
  });

  it("handles empty query", async () => {
    const results = await engine.search("");
    // Our rust implementation returns empty results when query is empty,
    // or maybe returns all? Let's check the code: "if query_bytes.is_empty() { return self.results.as_ptr(); }"
    // So it returns 0 length results.
    expect(results.length).toBe(0);
  });

  it("can be called repeatedly without crashing", async () => {
    const r1 = await engine.search("Banana");
    const r2 = await engine.search("Cherry");
    const r3 = await engine.search("Apple");
    expect(r1.length).toBe(1);
    expect(r2.length).toBe(1);
    expect(r3.length).toBe(1);
  });
});
