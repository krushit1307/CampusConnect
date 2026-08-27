export type Vector1536 = number[];

export interface ClusterCentroid {
  clusterId: number;
  center: Vector1536;
}

export interface UserVectorProfile {
  userId: string;
  embedding: Vector1536;
  clusterId?: number;
}

export interface EventScore {
  eventId: string;
  title: string;
  score: number;
}

/**
 * Calculates cosine similarity distance between two equal-dimensional vectors.
 */
export function calculateCosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 1.0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 1.0;
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return 1 - similarity; // Distance = 1 - Cosine Similarity
}

/**
 * Assigns a user vector embedding to the nearest K-Means cluster centroid.
 */
export function assignNearestCluster(
  userEmbedding: Vector1536,
  centroids: ClusterCentroid[],
): number {
  if (centroids.length === 0) return 0;

  let minDistance = Infinity;
  let nearestClusterId = centroids[0].clusterId;

  for (const centroid of centroids) {
    const distance = calculateCosineDistance(userEmbedding, centroid.center);
    if (distance < minDistance) {
      minDistance = distance;
      nearestClusterId = centroid.clusterId;
    }
  }

  return nearestClusterId;
}

/**
 * Ranks recommended events based on popularity score within the user's cohort cluster.
 */
export function rankCohortEvents(events: EventScore[]): EventScore[] {
  return [...events].sort((a, b) => b.score - a.score);
}
