import { describe, it, expect } from "vitest";
import {
  calculateCosineDistance,
  assignNearestCluster,
  rankCohortEvents,
  ClusterCentroid,
} from "./vectorRecommendations";

describe("pgvector K-Means Recommendations Suite (#2684)", () => {
  const vecA = [1, 0, 0];
  const vecB = [1, 0, 0]; // Identical vector -> Distance 0
  const vecC = [0, 1, 0]; // Orthogonal vector -> Distance 1

  it("calculates vector cosine distance accurately", () => {
    expect(calculateCosineDistance(vecA, vecB)).toBeCloseTo(0);
    expect(calculateCosineDistance(vecA, vecC)).toBeCloseTo(1);
  });

  it("assigns user embedding to the closest cluster centroid", () => {
    const centroids: ClusterCentroid[] = [
      { clusterId: 101, center: [1, 0, 0] },
      { clusterId: 102, center: [0, 1, 0] },
    ];

    const targetUserVector = [0.9, 0.1, 0]; // Closer to centroid 101
    const assignedCluster = assignNearestCluster(targetUserVector, centroids);

    expect(assignedCluster).toBe(101);
  });

  it("ranks cohort recommended events by engagement score", () => {
    const unranked = [
      { eventId: "e1", title: "Chess Tournament", score: 3 },
      { eventId: "e2", title: "Esports Night", score: 15 },
      { eventId: "e3", title: "Anime Club Screening", score: 9 },
    ];

    const ranked = rankCohortEvents(unranked);

    expect(ranked[0].eventId).toBe("e2"); // Highest score
    expect(ranked[1].eventId).toBe("e3");
    expect(ranked[2].eventId).toBe("e1");
  });
});
