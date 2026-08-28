// =============================================================================
// Utility: Floorplan serialization + attendee location descriptions
// Issues: #4145 - Interactive "Event Layout" Floorplan Builder
//         #4157 - Interactive "Career Fair" Digital Map
// Description: Pure helpers converting between the in-memory asset model and
// the persisted wire JSON ({ x, y, width, height, type, assignment }), plus
// human-readable quadrant descriptions ("Northwest corner") used on the
// public attendee view.
// =============================================================================

import {
  AccessibilityPoi,
  AccessibilityPoiKind,
  DEFAULT_VENUE,
  FloorplanAsset,
  FloorplanAssetJson,
  FloorplanState,
  SponsorAssignment,
  SponsorAssignmentJson,
  VenueBounds,
} from "./types";

/** In-memory -> wire for an assignment, including #4157 hiring_tags. */
export function assignmentToWire(assignment: SponsorAssignment): SponsorAssignmentJson {
  const wire: SponsorAssignmentJson = {
    sponsorId: assignment.sponsorId ?? null,
    companyName: assignment.companyName,
  };
  if (assignment.hiringTags && assignment.hiringTags.length > 0) {
    wire.hiring_tags = assignment.hiringTags;
  }
  return wire;
}

/** Wire -> in-memory for an assignment; tolerates missing/malformed tags. */
export function assignmentFromWire(
  raw: Partial<SponsorAssignmentJson> | null,
): SponsorAssignment | null {
  if (!raw || typeof raw !== "object" || !raw.companyName) return null;
  return {
    sponsorId: typeof raw.sponsorId === "string" ? raw.sponsorId : null,
    companyName: raw.companyName,
    hiringTags: Array.isArray(raw.hiring_tags)
      ? raw.hiring_tags.filter((t): t is string => typeof t === "string").map((t) => t.trim())
      : undefined,
  };
}

/** Serialize one asset to the #4145 wire contract. */
export function toWireJson(asset: FloorplanAsset): FloorplanAssetJson {
  return {
    id: asset.id,
    type: asset.kind,
    label: asset.label,
    x: Math.round(asset.x * 100) / 100,
    y: Math.round(asset.y * 100) / 100,
    width: Math.round(asset.width * 100) / 100,
    height: Math.round(asset.height * 100) / 100,
    assignment: asset.assignment ? assignmentToWire(asset.assignment) : null,
    base_price: asset.base_price,
  };
}

/** Full document saved to events.floorplan_json. */
export function toFloorplanState(assets: FloorplanAsset[], venue: VenueBounds): FloorplanState {
  return {
    assets: assets.map(toWireJson),
    venue,
    updatedAt: new Date().toISOString(),
  };
}

/** Defensive parse of saved accessibility POIs (#4420); never throws. */
const POI_KINDS: AccessibilityPoiKind[] = ["ramp", "elevator", "ada_bathroom", "stairs"];

export function parseAccessibilityPois(raw: unknown): AccessibilityPoi[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (p): p is Partial<AccessibilityPoi> =>
        !!p &&
        typeof p === "object" &&
        POI_KINDS.includes((p as Partial<AccessibilityPoi>).kind as AccessibilityPoiKind),
    )
    .map((p) => ({
      id: typeof p.id === "string" ? p.id : `poi_${Math.random().toString(36).slice(2, 10)}`,
      kind: p.kind as AccessibilityPoiKind,
      label: typeof p.label === "string" ? p.label : "",
      x_ft: Number(p.x_ft) || 0,
      y_ft: Number(p.y_ft) || 0,
    }));
}

/** Defensive parse of a saved floorplan_json blob (never throws). */
export function parseFloorplanState(raw: unknown): {
  assets: FloorplanAsset[];
  venue: VenueBounds;
} {
  if (!raw || typeof raw !== "object") return { assets: [], venue: DEFAULT_VENUE };
  const state = raw as Partial<FloorplanState>;

  const venue: VenueBounds =
    state.venue && typeof state.venue.width_ft === "number"
      ? {
          width_ft: Number(state.venue.width_ft),
          height_ft: Number(state.venue.height_ft),
          fire_exits: Array.isArray(state.venue.fire_exits)
            ? state.venue.fire_exits
            : DEFAULT_VENUE.fire_exits,
          accessibility_pois: parseAccessibilityPois(state.venue.accessibility_pois),
        }
      : DEFAULT_VENUE;

  const assets: FloorplanAsset[] = Array.isArray(state.assets)
    ? state.assets
        .filter(
          (a): a is FloorplanAssetJson =>
            !!a &&
            typeof a === "object" &&
            typeof (a as Partial<FloorplanAssetJson>).type === "string",
        )
        .map((a) => ({
          id: a.id,
          kind: a.type,
          label: a.label ?? "",
          x: Number(a.x) || 0,
          y: Number(a.y) || 0,
          width: Number(a.width) || 1,
          height: Number(a.height) || 1,
          assignment: assignmentFromWire(a.assignment),
          base_price: a.base_price || 0,
        }))
    : [];

  return { assets, venue };
}

export type Quadrant =
  | "Northwest corner"
  | "North side"
  | "Northeast corner"
  | "West side"
  | "Central area"
  | "East side"
  | "Southwest corner"
  | "South side"
  | "Southeast corner";

/**
 * Human-readable position of an asset inside the venue, e.g. "Northwest corner".
 * Used by the attendee view: "TacoCorp is at Table 12 in the Northwest corner."
 */
export function describeLocation(
  asset: Pick<FloorplanAsset, "x" | "y" | "width" | "height">,
  venue: VenueBounds,
): Quadrant {
  const centerX = asset.x + asset.width / 2;
  const centerY = asset.y + asset.height / 2;

  // Normalize to 0..1 within the venue
  const nx = venue.width_ft > 0 ? centerX / venue.width_ft : 0.5;
  const ny = venue.height_ft > 0 ? centerY / venue.height_ft : 0.5;

  // Central band tolerance: anything within the middle third counts as central
  const horizontal: "west" | "central" | "east" =
    nx < 0.35 ? "west" : nx > 0.65 ? "east" : "central";
  const vertical: "north" | "central" | "south" =
    ny < 0.35 ? "north" : ny > 0.65 ? "south" : "central";

  if (vertical === "central" && horizontal === "central") return "Central area";
  if (vertical === "north" && horizontal === "central") return "North side";
  if (vertical === "south" && horizontal === "central") return "South side";
  if (vertical === "central" && horizontal === "west") return "West side";
  if (vertical === "central" && horizontal === "east") return "East side";

  const vWord = vertical === "north" ? "North" : vertical === "south" ? "South" : "";
  const hWord = horizontal === "west" ? "west" : "east";
  return `${vWord}${hWord} corner` as Quadrant;
}

/**
 * The full attendee-facing sentence for an assigned asset:
 * "TacoCorp is at Table 12 in the Northwest corner."
 */
export function describeAssignment(asset: FloorplanAsset, venue: VenueBounds): string {
  const where = describeLocation(asset, venue);
  if (asset.assignment?.companyName) {
    return `${asset.assignment.companyName} is at ${asset.label} in the ${where}.`;
  }
  return `${asset.label} is in the ${where}.`;
}
