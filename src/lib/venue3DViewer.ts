export type ModelFormat = "gltf" | "glb" | "obj" | "primitive";

export interface SpatialItem {
  id: string;
  type: "round_table" | "rect_table" | "stage" | "chair" | "podium";
  label: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  width: number;
  depth: number;
}

export interface Venue3DConfig {
  modelUrl: string | null;
  format: ModelFormat;
  widthMeters: number;
  depthMeters: number;
  heightMeters: number;
}

export const DEFAULT_VENUE_DIMENSIONS = {
  widthMeters: 30,
  depthMeters: 20,
  heightMeters: 6,
};

/**
 * Validates standard 3D web model URLs (.gltf, .glb, .obj) (#3447).
 */
export function isValid3DModelUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const cleanUrl = url.trim().toLowerCase();
  return (
    cleanUrl.endsWith(".gltf") ||
    cleanUrl.endsWith(".glb") ||
    cleanUrl.endsWith(".obj") ||
    cleanUrl.includes("models.gltf") ||
    cleanUrl.includes("models.glb")
  );
}

/**
 * Detects 3D model format from URL extension (#3447).
 */
export function detectModelFormat(url?: string | null): ModelFormat {
  if (!url) return "primitive";
  const cleanUrl = url.trim().toLowerCase();
  if (cleanUrl.endsWith(".glb")) return "glb";
  if (cleanUrl.endsWith(".obj")) return "obj";
  if (cleanUrl.endsWith(".gltf")) return "gltf";
  return "gltf";
}

/**
 * Calculates maximum circular table capacity for ballroom dimensions (#3447).
 * Accounts for table diameter + aisle clearance spacing.
 */
export function calculateTableCapacityFit(
  venueWidthMeters: number,
  venueDepthMeters: number,
  tableDiameterMeters = 1.8, // standard 6ft / 1.8m round gala table (seats 8-10)
  aisleSpacingMeters = 1.2
): { maxTables: number; maxGuests: number; columns: number; rows: number } {
  const effectiveWidth = Math.max(1, venueWidthMeters);
  const effectiveDepth = Math.max(1, venueDepthMeters);
  const totalOccupiedPerTable = tableDiameterMeters + aisleSpacingMeters;

  const columns = Math.max(1, Math.floor(effectiveWidth / totalOccupiedPerTable));
  const rows = Math.max(1, Math.floor(effectiveDepth / totalOccupiedPerTable));

  const maxTables = columns * rows;
  const maxGuests = maxTables * 8; // 8 guests per table

  return {
    maxTables,
    maxGuests,
    columns,
    rows,
  };
}

/**
 * Generates initial grid layout array of 3D table primitives (#3447).
 */
export function generateTableGridPrimitives(
  tableCount: number,
  venueWidthMeters = 30,
  venueDepthMeters = 20
): SpatialItem[] {
  const items: SpatialItem[] = [];
  const fit = calculateTableCapacityFit(venueWidthMeters, venueDepthMeters);
  const count = Math.min(tableCount, fit.maxTables);

  const startX = -venueWidthMeters / 2 + 2.5;
  const startZ = -venueDepthMeters / 2 + 2.5;
  const stepX = venueWidthMeters / (fit.columns + 1);
  const stepZ = venueDepthMeters / (fit.rows + 1);

  let placed = 0;
  for (let r = 0; r < fit.rows && placed < count; r++) {
    for (let c = 0; c < fit.columns && placed < count; c++) {
      items.push({
        id: `table-${placed + 1}`,
        type: "round_table",
        label: `Table #${placed + 1}`,
        x: Number((startX + (c + 1) * stepX).toFixed(2)),
        y: 0.75, // 0.75m table height
        z: Number((startZ + (r + 1) * stepZ).toFixed(2)),
        rotationY: 0,
        width: 1.8,
        depth: 1.8,
      });
      placed++;
    }
  }

  return items;
}
