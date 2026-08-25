// =============================================================================
// Types: Floorplan Domain Model
// Issues: #3675 / #4145 - Interactive "Event Layout" Floorplan Builder
//         #4157 - Interactive "Career Fair" Digital Map
//         #4420 - Real-Time "Accessibility Need" Venue Map
// Description: Shared types for the 2D drag-and-drop floorplan tool. All
// coordinates are expressed in FEET so the canvas can scale to any venue.
// The persisted shape is the JSON contract requested by #4145:
//   { x, y, width, height, type, assignment }
// Assignments may also carry `hiring_tags` (#4157) used by the career-fair
// search ("Internship", "Software Engineer", majors, ...).
// Venues may also carry static `accessibility_pois` (#4420) - ramps,
// elevators, ADA bathrooms and stairs used to route wheelchair users.
// =============================================================================

export type AssetKind = "rect_table" | "round_table" | "stage" | "speaker" | "chair_row" | "exit";

/** Sponsor assigned to a table/booth, e.g. { sponsorId: "42", companyName: "TacoCorp" }. */
export interface SponsorAssignment {
  sponsorId: string | null;
  companyName: string;
  /** What this booth is hiring for, e.g. ["Internship", "Software Engineer"]. */
  hiringTags?: string[];
}

/** Wire shape of an assignment as persisted in floorplan_json (#4157). */
export interface SponsorAssignmentJson {
  sponsorId: string | null;
  companyName: string;
  /** snake_case on the wire to match the rest of the JSON contract. */
  hiring_tags?: string[];
}

export interface FloorplanAsset {
  id: string;
  kind: AssetKind;
  label: string;
  x: number; // top-left, feet
  y: number; // top-left, feet
  width: number; // feet
  height: number; // feet
  assignment?: SponsorAssignment | null;
}

/** Wire format for a single asset, exactly as specified by issue #4145. */
export interface FloorplanAssetJson {
  id: string;
  type: AssetKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  assignment: SponsorAssignmentJson | null;
}

export interface FireExit {
  x_ft: number;
  y_ft: number;
  side: "top" | "bottom" | "left" | "right";
}

/**
 * Static accessibility feature placed by the venue manager (#4420).
 * A point feature in feet; `stairs` marks a non-accessible entrance that
 * wheelchair routes must avoid (and which renders dimmed on the map).
 */
export type AccessibilityPoiKind = "ramp" | "elevator" | "ada_bathroom" | "stairs";

export interface AccessibilityPoi {
  id: string;
  kind: AccessibilityPoiKind;
  label: string;
  x_ft: number;
  y_ft: number;
}

export interface VenueBounds {
  width_ft: number;
  height_ft: number;
  fire_exits: FireExit[];
  /** #4420 static POIs persisted inside the venue JSON. */
  accessibility_pois?: AccessibilityPoi[];
}

/** Full document persisted on events.floorplan_json (wire format). */
export interface FloorplanState {
  assets: FloorplanAssetJson[];
  venue?: VenueBounds;
  updatedAt: string;
}

/** Default dimensions (ft) for each palette asset kind. */
export const ASSET_DEFAULTS: Record<
  AssetKind,
  { width: number; height: number; label: string; color: string }
> = {
  rect_table: { width: 6, height: 3, label: "Rect Table", color: "#6366f1" },
  round_table: { width: 5, height: 5, label: "Round Table", color: "#8b5cf6" },
  stage: { width: 20, height: 12, label: "Stage", color: "#0ea5e9" },
  speaker: { width: 3, height: 3, label: "Speaker", color: "#f59e0b" },
  chair_row: { width: 10, height: 4, label: "Chair Row", color: "#10b981" },
  exit: { width: 4, height: 2, label: "Exit", color: "#ef4444" },
};

/** The required clearance (ft) around every fire exit door. */
export const FIRE_EXIT_CLEARANCE_FT = 6;

/** Pixels per foot used by the SVG canvas scaler. */
export const FT_TO_PX = 8;

/** Fallback venue used when an event has no saved bounds yet. */
export const DEFAULT_VENUE: VenueBounds = {
  width_ft: 100,
  height_ft: 60,
  fire_exits: [
    { x_ft: 20, y_ft: 0, side: "top" },
    { x_ft: 80, y_ft: 60, side: "bottom" },
  ],
  accessibility_pois: [],
};

let assetCounter = 0;

export function makeAsset(kind: AssetKind, x: number, y: number, index: number): FloorplanAsset {
  const d = ASSET_DEFAULTS[kind];
  return {
    id: `asset_${Date.now()}_${index}_${assetCounter++}`,
    kind,
    label: `${d.label} ${index + 1}`,
    x,
    y,
    width: d.width,
    height: d.height,
    assignment: null,
  };
}

/** Display defaults for accessibility POIs (#4420). Blue = wheelchair usable. */
export const POI_DEFAULTS: Record<
  AccessibilityPoiKind,
  { label: string; color: string; accessible: boolean }
> = {
  ramp: { label: "Ramp", color: "#2563eb", accessible: true },
  elevator: { label: "Elevator", color: "#2563eb", accessible: true },
  ada_bathroom: { label: "ADA Restroom", color: "#2563eb", accessible: true },
  stairs: { label: "Stairs", color: "#64748b", accessible: false },
};

let poiCounter = 0;

/** Factory for a new POI dropped by a venue manager (#4420). */
export function makePoi(
  kind: AccessibilityPoiKind,
  x_ft: number,
  y_ft: number,
  index: number,
): AccessibilityPoi {
  const d = POI_DEFAULTS[kind];
  return {
    id: `poi_${Date.now()}_${index}_${poiCounter++}`,
    kind,
    label: d.label,
    x_ft: Math.round(x_ft * 100) / 100,
    y_ft: Math.round(y_ft * 100) / 100,
  };
}
