// =============================================================================
// Types: Floorplan Domain Model
// Issues: #3675 / #4145 - Interactive "Event Layout" Floorplan Builder
//         #4157 - Interactive "Career Fair" Digital Map
// Description: Shared types for the 2D drag-and-drop floorplan tool. All
// coordinates are expressed in FEET so the canvas can scale to any venue.
// The persisted shape is the JSON contract requested by #4145:
//   { x, y, width, height, type, assignment }
// Assignments may also carry `hiring_tags` (#4157) used by the career-fair
// search ("Internship", "Software Engineer", majors, ...).
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

export interface VenueBounds {
  width_ft: number;
  height_ft: number;
  fire_exits: FireExit[];
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
