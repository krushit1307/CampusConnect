import { describe, expect, it } from "vitest";
import {
  compareVersionVectors,
  EventDocument,
  incrementVersionVector,
  mergeArrays,
  mergeEventDocuments,
} from "./conflictResolution";

describe("conflictResolution - Version Vectors", () => {
  it("compares equal version vectors correctly", () => {
    const v1 = { clientA: 2, clientB: 1 };
    const v2 = { clientA: 2, clientB: 1 };
    expect(compareVersionVectors(v1, v2)).toBe("EQUAL");
  });

  it("detects dominating version vector", () => {
    const v1 = { clientA: 3, clientB: 1 };
    const v2 = { clientA: 2, clientB: 1 };
    expect(compareVersionVectors(v1, v2)).toBe("DOMINATES");
  });

  it("detects subordinate version vector", () => {
    const v1 = { clientA: 1, clientB: 1 };
    const v2 = { clientA: 2, clientB: 1 };
    expect(compareVersionVectors(v1, v2)).toBe("SUBORDINATE");
  });

  it("detects concurrent version vectors", () => {
    const v1 = { clientA: 2, clientB: 1 };
    const v2 = { clientA: 1, clientB: 2 };
    expect(compareVersionVectors(v1, v2)).toBe("CONCURRENT");
  });

  it("increments version vector sequence count", () => {
    const v = { clientA: 1 };
    const updated = incrementVersionVector(v, "clientA");
    expect(updated.clientA).toBe(2);
  });
});

describe("conflictResolution - 3-Way Array Merge", () => {
  it("merges additions from both clients without data loss", () => {
    const base = ["general"];
    const local = ["general", "sports"];
    const server = ["general", "technology"];

    const merged = mergeArrays(base, local, server);
    expect(merged).toContain("general");
    expect(merged).toContain("sports");
    expect(merged).toContain("technology");
    expect(merged.length).toBe(3);
  });

  it("respects removals when one client deletes a tag", () => {
    const base = ["general", "deprecated", "sports"];
    const local = ["general", "sports"]; // Removed 'deprecated'
    const server = ["general", "deprecated", "sports", "tech"]; // Added 'tech'

    const merged = mergeArrays(base, local, server);
    expect(merged).not.toContain("deprecated");
    expect(merged).toContain("general");
    expect(merged).toContain("sports");
    expect(merged).toContain("tech");
  });
});

describe("conflictResolution - 3-Way Event Merge", () => {
  const baseEvent: EventDocument = {
    title: "Annual Hackathon 2026",
    description: "Build cool projects together",
    location: "Main Auditorium",
    tags: ["tech", "coding"],
    custom_fields: {
      capacity: 100,
      prizePool: "$5000",
    },
    version: 1,
    version_vector: { adminA: 1 },
  };

  it("merges independent changes from local and server seamlessly", () => {
    // Admin A (local) updates description
    const localEvent: EventDocument = {
      ...baseEvent,
      description: "Build cool AI projects together",
    };

    // Admin B (server) updates location
    const serverEvent: EventDocument = {
      ...baseEvent,
      location: "Virtual & Hall A",
    };

    const result = mergeEventDocuments(baseEvent, localEvent, serverEvent, "adminA");

    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts.length).toBe(0);
    expect(result.mergedDocument.description).toBe("Build cool AI projects together");
    expect(result.mergedDocument.location).toBe("Virtual & Hall A");
  });

  it("merges tag additions from two concurrent edits cleanly", () => {
    const localEvent: EventDocument = {
      ...baseEvent,
      tags: ["tech", "coding", "ai"],
    };

    const serverEvent: EventDocument = {
      ...baseEvent,
      tags: ["tech", "coding", "web3"],
    };

    const result = mergeEventDocuments(baseEvent, localEvent, serverEvent, "adminA");

    expect(result.hasConflicts).toBe(false);
    expect(result.mergedDocument.tags).toContain("ai");
    expect(result.mergedDocument.tags).toContain("web3");
    expect(result.mergedDocument.tags).toContain("tech");
    expect(result.mergedDocument.tags).toContain("coding");
  });

  it("flags unresolvable conflict when both admins edit the same scalar field to different values", () => {
    const localEvent: EventDocument = {
      ...baseEvent,
      title: "Campus Hackathon 2026 (AI Edition)",
    };

    const serverEvent: EventDocument = {
      ...baseEvent,
      title: "Global Hackathon 2026",
    };

    const result = mergeEventDocuments(baseEvent, localEvent, serverEvent, "adminA");

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].field).toBe("title");
    expect(result.conflicts[0].localValue).toBe("Campus Hackathon 2026 (AI Edition)");
    expect(result.conflicts[0].serverValue).toBe("Global Hackathon 2026");
  });

  it("handles nested object merges and flags nested conflicts", () => {
    const localEvent: EventDocument = {
      ...baseEvent,
      custom_fields: {
        capacity: 200,
        prizePool: "$5000",
      },
    };

    const serverEvent: EventDocument = {
      ...baseEvent,
      custom_fields: {
        capacity: 100,
        prizePool: "$10,000",
      },
    };

    const result = mergeEventDocuments(baseEvent, localEvent, serverEvent, "adminA");

    // Local changed capacity (100 -> 200), Server changed prizePool ($5000 -> $10,000)
    expect(result.hasConflicts).toBe(false);
    const customFields = result.mergedDocument.custom_fields as Record<string, unknown>;
    expect(customFields.capacity).toBe(200);
    expect(customFields.prizePool).toBe("$10,000");
  });
});
