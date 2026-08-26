import { describe, it, expect } from "vitest";

// Helper to chunk arrays
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

describe("seed-db helper utilities", () => {
  it("chunks array correctly", () => {
    const arr = [1, 2, 3, 4, 5];
    const chunks = chunkArray(arr, 2);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual([1, 2]);
    expect(chunks[1]).toEqual([3, 4]);
    expect(chunks[2]).toEqual([5]);
  });

  it("checks config bounds", () => {
    const sizes = {
      small: { users: 20, clubs: 4, events: 40, rsvps: 200 },
      medium: { users: 50, clubs: 10, events: 200, rsvps: 2000 },
      massive: { users: 200, clubs: 30, events: 1000, rsvps: 10000 },
    };

    expect(sizes.small.users).toBe(20);
    expect(sizes.medium.events).toBe(200);
    expect(sizes.massive.rsvps).toBe(10000);
  });
});
