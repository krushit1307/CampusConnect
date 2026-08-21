// =============================================================================
// Types: Floorplan Domain Model
// Issue: #3675 - Build an 'Interactive "Event Layout" Floorplan Creator'
// Description: Shared types for the 2D drag-and-drop floorplan tool. All
// coordinates are expressed in FEET so the canvas can scale to any venue.
// =============================================================================

export type AssetKind = 'rect_table' | 'round_table' | 'stage' | 'speaker' | 'chair_row';

export interface FloorplanAsset {
    id: string;
    kind: AssetKind;
    label: string;
    x: number;      // top-left, feet
    y: number;      // top-left, feet
    width: number;  // feet
    height: number; // feet
}

export interface FireExit { x_ft: number; y_ft: number; side: 'top' | 'bottom' | 'left' | 'right'; }

export interface VenueBounds { width_ft: number; height_ft: number; fire_exits: FireExit[]; }

export interface FloorplanState { assets: FloorplanAsset[]; updatedAt: string; }

/** Default dimensions (ft) for each palette asset kind. */
export const ASSET_DEFAULTS: Record<AssetKind, { width: number; height: number; label: string; color: string }> = {
    rect_table: { width: 6, height: 3, label: 'Rect Table', color: '#6366f1' },
    round_table: { width: 5, height: 5, label: 'Round Table', color: '#8b5cf6' },
    stage: { width: 20, height: 12, label: 'Stage', color: '#0ea5e9' },
    speaker: { width: 3, height: 3, label: 'Speaker', color: '#f59e0b' },
    chair_row: { width: 10, height: 4, label: 'Chair Row', color: '#10b981' },
};

/** The required clearance (ft) around every fire exit door. */
export const FIRE_EXIT_CLEARANCE_FT = 6;

/** Pixels per foot used by the SVG canvas scaler. */
export const FT_TO_PX = 8;

export function makeAsset(kind: AssetKind, x: number, y: number, index: number): FloorplanAsset {
    const d = ASSET_DEFAULTS[kind];
    return { id: `asset_${Date.now()}_${index}`, kind, label: `${d.label} ${index + 1}`, x, y, width: d.width, height: d.height };
}
