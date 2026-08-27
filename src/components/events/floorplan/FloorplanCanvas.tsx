// =============================================================================
// Component: FloorplanCanvas
// Issues: #3675 / #4145 - Interactive "Event Layout" Floorplan Builder
//         #4157 - Interactive "Career Fair" Digital Map
//         #4420 - Real-Time "Accessibility Need" Venue Map
// Description: SVG-based 2D canvas. Renders venue walls, fire-exit clearance
// pathways and draggable assets. Assets intersecting a fire pathway turn red.
// Pointer events convert screen deltas into feet using the FT_TO_PX scale.
// In read-only mode (attendee view) dragging is disabled and assets become
// clickable so attendees can look up "who is at this table".
// When `highlightIds` is provided (#4157 career-fair search), every asset
// outside the set is dimmed while matching booths pulse with an amber glow.
// When `accessibilityMode` is on (#4420), static POIs render on top: ramps,
// elevators and ADA bathrooms glow bright blue while stairs dim out, and an
// `accessibleRoute` polyline draws the personalized wheelchair path.
// =============================================================================

import React, { useRef, useState } from "react";
import {
  AccessibilityPoi,
  AccessibilityPoiKind,
  FloorplanAsset,
  VenueBounds,
  FT_TO_PX,
  ASSET_DEFAULTS,
  POI_DEFAULTS,
} from "../../../lib/floorplan/types";
import { allFirePathways } from "../../../lib/floorplan/collision";
import { AccessibleRoute } from "../../../lib/floorplan/accessibility";
import { EventLayoutHeatmapLayer } from "./EventLayoutHeatmapLayer";
import type { EventLayoutZone } from "../../../lib/eventLayoutHeatmap";

interface FloorplanCanvasProps {
  venue: VenueBounds;
  assets: FloorplanAsset[];
  collidingIds?: Set<string>;
  onMove?: (id: string, x: number, y: number) => void;
  onRemove?: (id: string) => void;
  readOnly?: boolean;
  selectedId?: string | null;
  onSelect?: (asset: FloorplanAsset) => void;
  /** Active search result ids (#4157); null/undefined = no filtering. */
  highlightIds?: Set<string> | null;
  /** #4420 show accessibility POIs + route overlay for wheelchair users. */
  accessibilityMode?: boolean;
  accessibleRoute?: AccessibleRoute | null;
  selectedPoiId?: string | null;
  onSelectPoi?: (poi: AccessibilityPoi) => void;
  onMovePoi?: (id: string, x_ft: number, y_ft: number) => void;
  onRemovePoi?: (id: string) => void;
  /** #4722 live occupancy overlay from zone door QR scans. */
  heatmapZones?: EventLayoutZone[];
  onZoneDoorClick?: (zone: EventLayoutZone) => void;
}

/** Short glyph inside each POI marker. */
const POI_GLYPHS: Record<AccessibilityPoiKind, string> = {
  ramp: "\u25B3", // ramp slope
  elevator: "\u2195", // up/down
  ada_bathroom: "WC",
  stairs: "\u2261",
};

export const FloorplanCanvas: React.FC<FloorplanCanvasProps> = ({
  venue,
  assets,
  collidingIds,
  onMove,
  onRemove,
  readOnly = false,
  selectedId = null,
  onSelect,
  highlightIds = null,
  accessibilityMode = false,
  accessibleRoute = null,
  selectedPoiId = null,
  onSelectPoi,
  onMovePoi,
  onRemovePoi,
  heatmapZones,
  onZoneDoorClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);

  const viewW = venue.width_ft * FT_TO_PX;
  const viewH = venue.height_ft * FT_TO_PX;

  const activeSelectedId = readOnly ? selectedId : localSelectedId;

  // #4420 POIs always show for managers; attendees see them in a11y mode only.
  const pois = venue.accessibility_pois ?? [];
  const showPois = pois.length > 0 && (!readOnly || accessibilityMode);

  // Convert a pointer event into feet-space coordinates
  const toFeet = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * viewW;
    const py = ((e.clientY - rect.top) / rect.height) * viewH;
    return { x: px / FT_TO_PX, y: py / FT_TO_PX };
  };

  const handleAssetDown = (e: React.PointerEvent, asset: FloorplanAsset) => {
    e.stopPropagation();
    onSelect?.(asset);
    if (readOnly) return;
    const p = toFeet(e);
    setDrag({ id: asset.id, offsetX: p.x - asset.x, offsetY: p.y - asset.y });
    setLocalSelectedId(asset.id);
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // Some environments (older browsers, jsdom) do not support pointer capture
    }
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!drag || !onMove) return;
    const p = toFeet(e);
    onMove(drag.id, p.x - drag.offsetX, p.y - drag.offsetY);
  };

  // #4420 POIs share the drag pipeline; ids never collide (poi_ vs asset_).
  const handlePoiDown = (e: React.PointerEvent, poi: AccessibilityPoi) => {
    e.stopPropagation();
    onSelectPoi?.(poi);
    if (readOnly || !onMovePoi) return;
    const p = toFeet(e);
    setDrag({ id: poi.id, offsetX: p.x - poi.x_ft, offsetY: p.y - poi.y_ft });
    setLocalSelectedId(poi.id);
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // jsdom and older browsers lack pointer capture
    }
  };

  const handlePoiMove = (e: React.PointerEvent) => {
    if (!drag || !onMovePoi) return;
    if (!drag.id.startsWith("poi_")) return;
    const p = toFeet(e);
    onMovePoi(
      drag.id,
      Math.min(Math.max(p.x - drag.offsetX, 0), venue.width_ft),
      Math.min(Math.max(p.y - drag.offsetY, 0), venue.height_ft),
    );
  };

  const handleUp = () => setDrag(null);

  const pathways = allFirePathways(venue);

  return (
    <div className="w-full overflow-auto bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full h-auto touch-none select-none rounded-lg bg-white dark:bg-gray-800 shadow-inner"
        onPointerMove={(e) => {
          handleMove(e);
          handlePoiMove(e);
        }}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        role="img"
        aria-label={`Event floorplan covering ${venue.width_ft} by ${venue.height_ft} feet with ${assets.length} placed items`}
      >
        {/* Grid pattern (1ft cells) */}
        <defs>
          <pattern id="fp-grid" width={FT_TO_PX} height={FT_TO_PX} patternUnits="userSpaceOnUse">
            <path
              d={`M ${FT_TO_PX} 0 L 0 0 0 ${FT_TO_PX}`}
              fill="none"
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-700"
              strokeWidth="1"
            />
          </pattern>
          {/* #4157: bright pulse for booths matching the career-fair search */}
          <style>{`
            @keyframes fp-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.45; }
            }
            .fp-pulse { animation: fp-pulse 1.1s ease-in-out infinite; }
          `}</style>
        </defs>
        <rect width={viewW} height={viewH} fill="url(#fp-grid)" />

        {/* Outer walls */}
        <rect
          x={1}
          y={1}
          width={viewW - 2}
          height={viewH - 2}
          fill="none"
          stroke="currentColor"
          className="text-gray-500 dark:text-gray-400"
          strokeWidth={3}
        />

        {/* Fire exit clearance pathways (always visible, striped red) */}
        {pathways.map((p, i) => (
          <rect
            key={`path_${i}`}
            x={p.x * FT_TO_PX}
            y={p.y * FT_TO_PX}
            width={p.w * FT_TO_PX}
            height={p.h * FT_TO_PX}
            fill="rgba(239,68,68,0.15)"
            stroke="#ef4444"
            strokeDasharray="6 4"
            strokeWidth={2}
          />
        ))}

        {/* #4722 D3 occupancy heatmap + zone door check-in markers */}
        {heatmapZones && heatmapZones.length > 0 && (
          <EventLayoutHeatmapLayer zones={heatmapZones} onDoorClick={onZoneDoorClick} />
        )}

        {/* Draggable assets */}
        {assets.map((asset) => {
          const colliding = collidingIds?.has(asset.id) ?? false;
          const color = colliding ? "#ef4444" : ASSET_DEFAULTS[asset.kind].color;
          const isSelected = activeSelectedId === asset.id;
          const isRound = asset.kind === "round_table";
          const isExit = asset.kind === "exit";

          // #4157 career-fair search: dim everything outside the result set
          // and make the matching booths pulse with an amber highlight.
          const isFiltering = readOnly && highlightIds != null;
          const isMatch = isFiltering ? (highlightIds?.has(asset.id) ?? false) : false;
          const isDimmed = isFiltering && !isMatch;
          const groupOpacity = isDimmed ? 0.12 : undefined;
          const matchStroke = isMatch ? "#f59e0b" : null;

          return (
            <g
              key={asset.id}
              onPointerDown={(e) => handleAssetDown(e, asset)}
              className={`${readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
              data-testid={`floorplan-asset-${asset.id}`}
              data-dimmed={isDimmed || undefined}
              data-pulse={isMatch || undefined}
              opacity={groupOpacity}
            >
              {isRound ? (
                <ellipse
                  cx={(asset.x + asset.width / 2) * FT_TO_PX}
                  cy={(asset.y + asset.height / 2) * FT_TO_PX}
                  rx={(asset.width / 2) * FT_TO_PX}
                  ry={(asset.height / 2) * FT_TO_PX}
                  fill={color}
                  opacity={0.85}
                  stroke={isSelected || colliding ? "#111827" : matchStroke}
                  strokeWidth={3}
                  className={isMatch ? "fp-pulse" : undefined}
                />
              ) : (
                <rect
                  x={asset.x * FT_TO_PX}
                  y={asset.y * FT_TO_PX}
                  width={asset.width * FT_TO_PX}
                  height={asset.height * FT_TO_PX}
                  rx={isExit ? 1 : 4}
                  fill={color}
                  opacity={isExit ? 1 : 0.85}
                  stroke={isSelected || colliding ? "#111827" : matchStroke}
                  strokeWidth={3}
                  className={isMatch ? "fp-pulse" : undefined}
                />
              )}
              <text
                x={(asset.x + asset.width / 2) * FT_TO_PX}
                y={(asset.y + (asset.assignment?.companyName && !isExit ? 0.9 : 1.5)) * FT_TO_PX}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={11}
                fontWeight={700}
                className="pointer-events-none"
              >
                {isExit ? "\u2192 EXIT" : asset.label}
              </text>
              {!isExit && asset.assignment?.companyName && (
                <text
                  x={(asset.x + asset.width / 2) * FT_TO_PX}
                  y={(asset.y + 2.1) * FT_TO_PX}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize={10}
                  fontStyle="italic"
                  className="pointer-events-none"
                >
                  {asset.assignment.companyName}
                </text>
              )}

              {/* Delete handle on selection */}
              {!readOnly && isSelected && onRemove && (
                <g
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onRemove(asset.id);
                    setLocalSelectedId(null);
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={(asset.x + asset.width) * FT_TO_PX}
                    cy={asset.y * FT_TO_PX}
                    r={10}
                    fill="#ef4444"
                  />
                  <text
                    x={(asset.x + asset.width) * FT_TO_PX}
                    y={asset.y * FT_TO_PX}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#fff"
                    fontSize={12}
                    fontWeight={700}
                  >
                    ✕
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {/* #4420 accessibility POIs: bright blue when wheelchair-usable,
            stairs dimmed to gray. Rendered above furniture. */}
        {showPois &&
          pois.map((poi) => {
            const d = POI_DEFAULTS[poi.kind];
            const isSelected = activeSelectedId === poi.id;
            const dimmed = accessibilityMode && !d.accessible;
            return (
              <g
                key={poi.id}
                onPointerDown={(e) => handlePoiDown(e, poi)}
                className={readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}
                data-testid={`a11y-poi-${poi.id}`}
                data-poi-kind={poi.kind}
                data-accessible={d.accessible ? "true" : "false"}
                data-dimmed={dimmed || undefined}
                opacity={dimmed ? 0.3 : undefined}
              >
                <circle
                  cx={poi.x_ft * FT_TO_PX}
                  cy={poi.y_ft * FT_TO_PX}
                  r={11}
                  fill={d.color}
                  stroke={isSelected ? "#111827" : "#ffffff"}
                  strokeWidth={3}
                />
                <text
                  x={poi.x_ft * FT_TO_PX}
                  y={poi.y_ft * FT_TO_PX}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize={10}
                  fontWeight={800}
                  className="pointer-events-none select-none"
                >
                  {POI_GLYPHS[poi.kind]}
                </text>
                <text
                  x={poi.x_ft * FT_TO_PX}
                  y={(poi.y_ft + 2.2) * FT_TO_PX}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  className="pointer-events-none select-none"
                  fill="#374151"
                >
                  {poi.label || d.label}
                </text>

                {!readOnly && isSelected && onRemovePoi && (
                  <g
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onRemovePoi(poi.id);
                      setLocalSelectedId(null);
                    }}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={poi.x_ft * FT_TO_PX + 16}
                      cy={poi.y_ft * FT_TO_PX - 16}
                      r={9}
                      fill="#ef4444"
                    />
                    <text
                      x={poi.x_ft * FT_TO_PX + 16}
                      y={poi.y_ft * FT_TO_PX - 16}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#fff"
                      fontSize={11}
                      fontWeight={700}
                    >
                      ✕
                    </text>
                  </g>
                )}
              </g>
            );
          })}

        {/* #4420 personalized wheelchair route: street -> ramp -> booth */}
        {accessibilityMode && accessibleRoute && accessibleRoute.points.length >= 2 && (
          <g data-testid="a11y-route">
            <polyline
              points={accessibleRoute.points
                .map((p) => `${p.x_ft * FT_TO_PX},${p.y_ft * FT_TO_PX}`)
                .join(" ")}
              fill="none"
              stroke="#2563eb"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
            <circle
              cx={accessibleRoute.points[0].x_ft * FT_TO_PX}
              cy={accessibleRoute.points[0].y_ft * FT_TO_PX}
              r={7}
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth={3}
            />
            <text
              x={(accessibleRoute.points[0].x_ft + 1.6) * FT_TO_PX}
              y={(accessibleRoute.points[0].y_ft - 1.2) * FT_TO_PX}
              fontSize={9}
              fontWeight={700}
              fill="#1d4ed8"
              className="pointer-events-none select-none"
            >
              STREET
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-dashed border-red-500 inline-block" />
          Fire exit clearance (do not block)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
          Asset violating safety pathway
        </span>
        {readOnly && (
          <span className="flex items-center gap-1">
            <span className="inline-block">👆</span>
            Click any table to see who&apos;s there
          </span>
        )}
        {readOnly && highlightIds != null && (
          <>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-6 animate-pulse rounded-sm border-2 border-amber-500" />
              Matching booth
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-gray-400 opacity-30" />
              Dimmed (no match)
            </span>
          </>
        )}
        {showPois && (
          <>
            <span className="flex items-center gap-1" data-testid="a11y-legend-accessible">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-blue-600" />
              Wheelchair accessible
            </span>
            <span className="flex items-center gap-1" data-testid="a11y-legend-stairs">
              <span className="inline-block h-3 w-3 rounded-full bg-gray-500 opacity-40" />
              Stairs (avoided)
            </span>
          </>
        )}
        {accessibilityMode && accessibleRoute && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-1 w-6 rounded-full bg-blue-600" />
            Your accessible route ({Math.round(accessibleRoute.totalDistanceFt)} ft)
          </span>
        )}
      </div>
    </div>
  );
};
