// ─── Accessibility Route Campus Mapper Types ──────────────────────────────

export type PathwaySurface = "paved" | "concrete" | "tile" | "gravel" | "grass" | "carpet";
export type ObstacleType = "stairs" | "curb" | "narrow" | "steep-grade" | "construction" | "door-threshold" | "none";
export type FacilityType = "ramp" | "elevator" | "automatic-door" | "tactile-paving" | "rest-area" | "accessible-restroom";
export type RouteDifficulty = "easy" | "moderate" | "challenging";
export type ReportStatus = "pending" | "verified" | "disputed" | "resolved";
export type TransitType = "bus-stop" | "shuttle-stop" | "parking" | "building-entrance";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

export interface TransitStop {
  id: string;
  name: string;
  type: TransitType;
  position: GeoPoint;
  accessible: boolean;
  hasShelter: boolean;
  nearestParkingAccessible: boolean;
  description: string;
}

export interface VenueEntrance {
  id: string;
  venueId: string;
  venueName: string;
  entranceName: string;
  position: GeoPoint;
  hasAutomaticDoor: boolean;
  hasRamp: boolean;
  doorWidthCm: number;
  description: string;
}

export interface AccessiblePathway {
  id: string;
  name: string;
  geometry: GeoJSONLineString;
  surface: PathwaySurface;
  widthMeters: number;
  hasRamp: boolean;
  hasTactilePaving: boolean;
  hasHandrails: boolean;
  gradePercentage: number;
  obstacles: PathwayObstacle[];
  facilities: PathwayFacility[];
  verifiedBy: string;
  verifiedAt: Date;
  lastInspected: Date;
  crowdsourceUpdated: boolean;
  averageRating: number;
  totalRatings: number;
}

export interface PathwayObstacle {
  id: string;
  type: ObstacleType;
  position: GeoPoint;
  description: string;
  workaround?: string;
  severity: "minor" | "moderate" | "severe" | "blocking";
  reportedBy: string;
  reportedAt: Date;
}

export interface PathwayFacility {
  id: string;
  type: FacilityType;
  position: GeoPoint;
  name: string;
  description: string;
  operational: boolean;
  lastChecked: Date;
}

export interface AccessibleRoute {
  id: string;
  name: string;
  description: string;
  transitStopId: string;
  transitStop: TransitStop;
  venueEntranceId: string;
  venueEntrance: VenueEntrance;
  pathwayIds: string[];
  pathways: AccessiblePathway[];
  totalDistanceMeters: number;
  estimatedTimeMinutes: number;
  difficulty: RouteDifficulty;
  wheelchairFriendly: boolean;
  visuallyFriendly: boolean;
  mobilityAidCompatible: boolean;
  turns: RouteTurn[];
  overallRating: number;
  totalRatings: number;
  verified: boolean;
  lastUpdated: Date;
  reportedIssues: number;
}

export interface RouteTurn {
  instruction: string;
  distanceMeters: number;
  pathwayId: string;
  waypoint: GeoPoint;
  landmark?: string;
  caution?: string;
}

export interface AccessibilityReport {
  id: string;
  reporterName: string;
  reporterRole: string;
  pathwayId?: string;
  routeId?: string;
  type: "obstacle" | "facility-issue" | "route-blocked" | "new-route" | "rating" | "update";
  title: string;
  description: string;
  position?: GeoPoint;
  images: string[];
  severity: "minor" | "moderate" | "severe" | "blocking";
  status: ReportStatus;
  submittedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  helpfulVotes: number;
}

export interface AccessibilityStats {
  totalPathways: number;
  verifiedPathways: number;
  totalRoutes: number;
  totalReports: number;
  pendingReports: number;
  averageRouteRating: number;
  wheelchairCoveragePercent: number;
  lastCommunityUpdate: Date;
}

export interface AccessibilityFilterState {
  searchQuery: string;
  minRating: number;
  difficulty: RouteDifficulty[];
  wheelchairOnly: boolean;
  visualAidsOnly: boolean;
  transitType: TransitType[];
  surfaceType: PathwaySurface[];
  maxDistance: number;
  sortBy: "rating" | "distance" | "difficulty" | "newest";
}
