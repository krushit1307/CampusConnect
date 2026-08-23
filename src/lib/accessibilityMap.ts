export type MapNodeType =
  | "table"
  | "stage"
  | "boundary"
  | "booth"
  | "sponsor"
  | "entrance"
  | "elevator"
  | "ramp"
  | "restroom";

export type AccessibilityNodeType = "entrance" | "elevator" | "ramp" | "restroom";

export interface AccessibilityMapNode {
  id: string;
  entity_name: string | null;
  type: MapNodeType;
  x_coord: number;
  y_coord: number;
  width: number;
  height: number;
  rotation: number;
  accessibility_notes?: string | null;
}

export interface RouteSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  targetType: AccessibilityNodeType;
}

export const ACCESSIBILITY_NODE_TYPES: AccessibilityNodeType[] = [
  "entrance",
  "elevator",
  "ramp",
  "restroom",
];

export const ACCESSIBILITY_NODE_LABELS: Record<MapNodeType, string> = {
  table: "Table",
  stage: "Stage",
  boundary: "Boundary",
  booth: "Booth",
  sponsor: "Sponsor booth",
  entrance: "Main entrance",
  elevator: "Elevator",
  ramp: "Accessible ramp",
  restroom: "Accessible restroom",
};

export const DEFAULT_MAP_PIXELS_PER_FOOT = 4;

export function isAccessibilityNode(type: MapNodeType): type is AccessibilityNodeType {
  return ACCESSIBILITY_NODE_TYPES.includes(type as AccessibilityNodeType);
}

export function getNodeCenter(
  node: Pick<AccessibilityMapNode, "x_coord" | "y_coord" | "width" | "height">,
) {
  return {
    x: node.x_coord + node.width / 2,
    y: node.y_coord + node.height / 2,
  };
}

export function getSpatialDirection(from: { x: number; y: number }, to: { x: number; y: number }) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX >= 0 ? "East" : "West";
  return deltaY >= 0 ? "South" : "North";
}

export function getSpatialDescription(
  node: AccessibilityMapNode,
  entrance?: AccessibilityMapNode | null,
  pixelsPerFoot = DEFAULT_MAP_PIXELS_PER_FOOT,
) {
  const label = node.entity_name?.trim() || ACCESSIBILITY_NODE_LABELS[node.type];
  if (!entrance || entrance.id === node.id) {
    return `${label} is marked on the venue map.`;
  }

  const entranceCenter = getNodeCenter(entrance);
  const nodeCenter = getNodeCenter(node);
  const distancePixels = Math.hypot(
    nodeCenter.x - entranceCenter.x,
    nodeCenter.y - entranceCenter.y,
  );
  const distanceFeet = Math.max(1, Math.round(distancePixels / pixelsPerFoot));
  const direction = getSpatialDirection(entranceCenter, nodeCenter);
  const notes = node.accessibility_notes?.trim();

  return `${label} is approximately ${distanceFeet} feet ${direction} of the Main Entrance.${notes ? ` ${notes}` : ""}`;
}

export function getAccessibilityNodes(nodes: AccessibilityMapNode[]) {
  return nodes.filter((node) => isAccessibilityNode(node.type));
}

export function mapFeatureToNodeType(feature: string): MapNodeType | null {
  if (feature === "has_elevator") return "elevator";
  if (feature === "wheelchair_ramp") return "ramp";
  if (feature === "gender_neutral_restrooms") return "restroom";
  return null;
}

export function createAccessibilityRouteSegments(
  nodes: AccessibilityMapNode[],
  brokenFeatures: string[] = [],
): RouteSegment[] {
  const entrance = nodes.find((node) => node.type === "entrance");
  if (!entrance) return [];

  const brokenNodeTypes = brokenFeatures
    .map(mapFeatureToNodeType)
    .filter((t): t is MapNodeType => t !== null);

  const entranceCenter = getNodeCenter(entrance);
  return nodes
    .filter(
      (node): node is AccessibilityMapNode & { type: AccessibilityNodeType } =>
        node.id !== entrance.id &&
        isAccessibilityNode(node.type) &&
        !brokenNodeTypes.includes(node.type),
    )
    .map((node) => {
      const center = getNodeCenter(node);
      return {
        id: `${entrance.id}-${node.id}`,
        x1: entranceCenter.x,
        y1: entranceCenter.y,
        x2: center.x,
        y2: center.y,
        targetType: node.type,
      };
    });
}
