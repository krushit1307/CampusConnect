export interface RawRsvpDietaryPoint {
  eventId: string;
  venueId: string;
  venueName: string;
  latitude: number;
  longitude: number;
  userId: string;
  dietaryRestrictions: string[];
  eventStartTimeIso: string;
  eventEndTimeIso: string;
}

export interface HeatmapDataPoint {
  venueId: string;
  venueName: string;
  latitude: number;
  longitude: number;
  dietaryTag: string;
  studentCount: number;
  intensityWeight: number; // 0.0 to 1.0 scale
}

export interface DiningLogisticsRecommendation {
  recommendedVenueName: string;
  targetDietaryTag: string;
  studentCount: number;
  reason: string;
}

/**
 * Calculates normalized heatmap intensity weight (capped at 1.0 for 100+ students).
 */
export function calculateHeatmapIntensity(studentCount: number, maxThreshold = 100): number {
  if (studentCount <= 0) return 0.0;
  const weight = studentCount / maxThreshold;
  return Number(Math.min(1.0, weight).toFixed(2));
}

/**
 * Aggregates spatial RSVP dietary restrictions for map visualization within a specified active time window.
 */
export function aggregateDietaryHeatmap(
  points: RawRsvpDietaryPoint[],
  targetDietaryTag?: string,
): HeatmapDataPoint[] {
  const venueMap = new Map<
    string,
    { venueName: string; lat: number; lng: number; tagCounts: Record<string, Set<string>> }
  >();

  for (const pt of points) {
    const key = pt.venueId;
    if (!venueMap.has(key)) {
      venueMap.set(key, {
        venueName: pt.venueName,
        lat: pt.latitude,
        lng: pt.longitude,
        tagCounts: {},
      });
    }

    const venueObj = venueMap.get(key)!;

    for (const tag of pt.dietaryRestrictions) {
      const normalizedTag = tag.trim().toLowerCase();
      if (targetDietaryTag && normalizedTag !== targetDietaryTag.toLowerCase()) {
        continue;
      }

      if (!venueObj.tagCounts[normalizedTag]) {
        venueObj.tagCounts[normalizedTag] = new Set<string>();
      }
      venueObj.tagCounts[normalizedTag].add(pt.userId);
    }
  }

  const result: HeatmapDataPoint[] = [];

  for (const [venueId, data] of venueMap.entries()) {
    for (const [tag, userSet] of Object.entries(data.tagCounts)) {
      const studentCount = userSet.size;
      if (studentCount > 0) {
        result.push({
          venueId,
          venueName: data.venueName,
          latitude: data.lat,
          longitude: data.lng,
          dietaryTag: tag,
          studentCount,
          intensityWeight: calculateHeatmapIntensity(studentCount),
        });
      }
    }
  }

  return result.sort((a, b) => b.studentCount - a.studentCount);
}

/**
 * Generates actionable food truck dispatch recommendations based on top dietary density clusters.
 */
export function generateDiningLogisticsRecommendation(
  heatmapPoints: HeatmapDataPoint[],
): DiningLogisticsRecommendation | null {
  if (heatmapPoints.length === 0) return null;

  const topCluster = heatmapPoints[0];

  return {
    recommendedVenueName: topCluster.venueName,
    targetDietaryTag: topCluster.dietaryTag,
    studentCount: topCluster.studentCount,
    reason: `Highest density cluster detected: ${topCluster.studentCount} ${topCluster.dietaryTag} students at ${topCluster.venueName}.`,
  };
}
