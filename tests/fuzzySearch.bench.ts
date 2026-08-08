import { describe, it, bench, expect } from "vitest";
import { FuzzySearchEngine } from "../src/search/fuzzySearch";

// Generate 100,000 mock records
const NUM_RECORDS = 100_000;
const generateDataset = () => {
  const data: string[] = [];
  for (let i = 0; i < NUM_RECORDS; i++) {
    // some typical names and random noise
    if (i === 50000) {
      data.push("Milan Rathod - CampusConnect President");
    } else if (i === 75000) {
      data.push("Krushit Club of Engineers");
    } else {
      data.push(`Student ${i} - Major in Computer Science`);
    }
  }
  return data;
};

const dataset = generateDataset();

describe("FuzzySearchEngine Benchmarks", () => {
  let engine: FuzzySearchEngine;

  it("initializes WASM engine", async () => {
    engine = await FuzzySearchEngine.create(dataset);
    expect(engine).toBeDefined();
  });

  bench(
    "JS filtering (String.includes)",
    () => {
      const query = "milan".toLowerCase();
      const results = [];
      for (let i = 0; i < dataset.length; i++) {
        if (dataset[i].toLowerCase().includes(query)) {
          results.push(i);
        }
      }
      // We expect some results
      if (results.length === 0) throw new Error("No results");
    },
    { time: 1000 },
  );

  bench(
    "WASM fuzzy search (max_distance = 2)",
    async () => {
      // The benchmark needs to await the worker message.
      const results = await engine.search("milan", 2);
      if (results.length === 0) throw new Error("No results");
    },
    { time: 1000 },
  );
});
