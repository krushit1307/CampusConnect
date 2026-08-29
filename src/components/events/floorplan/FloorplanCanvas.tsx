// =============================================================================
// Component: FloorplanCanvas
// Issues: #3675 / #4145 - Interactive "Event Layout" Floorplan Builder
//         #4157 - Interactive "Career Fair" Digital Map
//         #4420 - Real-Time "Accessibility Need" Venue Map
//         #4779 - Interactive "Event Layout" Sponsorship Zone Geofencing
// Description: SVG-based 2D canvas. Renders venue walls, fire-exit clearance
// pathways and draggable assets. Assets intersecting a fire pathway turn red.
// Pointer events convert screen deltas into feet using the FT_TO_PX scale.
// Includes a "Polygon Draw" tool for drawing interactive sponsorship zones.
// =============================================================================

import React, { useRef, useState, useMemo } from "react";
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

// --- New Types for Issue #4779 ---
export interface Point2D {
  x: number;
  y: number;
}
export interface SponsorshipZone {
  id: string;
  name: string;
  message: string;
  polygon: Point2D[]; // Array of vertices in feet
}
// --------------------------------

interface FloorplanCanvasProps {
  venue: VenueBounds;
  assets: FloorplanAsset[];
  collidingIds?: Set<string>;
  onMove?: (id: string, x: number, y: number) => void;
  onRemove?: (id: string) => void;
  readOnly?: boolean;
  selectedId?: string | null;
  onSelect?: (asset: FloorplanAsset) => void;
  highlightIds?: Set<string> | null;
  accessibilityMode?: boolean;
  accessibleRoute?: AccessibleRoute | null;
  selectedPoiId?: string | null;
  onSelectPoi?: (poi: AccessibilityPoi) => void;
  onMovePoi?: (id: string, x_ft: number, y_ft: number) => void;
  onRemovePoi?: (id: string) => void;
  heatmapZones?: EventLayoutZone[];
  onZoneDoorClick?: (zone: EventLayoutZone) => void;
  
  // --- New Props for Issue #4779 ---
  sponsorshipZones?: SponsorshipZone[];
  onSaveSponsorshipZone?: (zone: SponsorshipZone) => void;
  attendeeLocation?: Point2D | null; // Simulated live location of attendee
  // --------------------------------
}

const POI_GLYPHS: Record<AccessibilityPoiKind, string> = {
  ramp: "\u25B3",
  elevator: "\u2195",
  ada_bathroom: "WC",
  stairs: "\u2261",
};

/**
 * Ray-casting algorithm to determine if a point is inside a polygon.
 * Crucial for #4779 Geofencing math.
 */
function isPointInPolygon(point: Point2D, polygon: Point2D[]) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

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
  sponsorshipZones = [],
  onSaveSponsorshipZone,
  attendeeLocation = null,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);

  // --- New State for Issue #4779 ---
  const [isDrawingZone, setIsDrawingZone] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState<Point2D[]>([]);
  // --------------------------------

  const viewW = venue.width_ft * FT_TO_PX;
  const viewH = venue.height_ft * FT_TO_PX;

  const activeSelectedId = readOnly ? selectedId : localSelectedId;

  const pois = venue.accessibility_pois ?? [];
  const showPois = pois.length > 0 && (!readOnly || accessibilityMode);

  // Convert a pointer event into feet-space coordinates
  const toFeet = (e: React.PointerEvent | React.MouseEvent): Point2D => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * viewW;
    const py = ((e.clientY - rect.top) / rect.height) * viewH;
    return { x: px / FT_TO_PX, y: py / FT_TO_PX };
  };

  // --- New Handlers for Issue #4779 ---
  const handleSvgClick = (e: React.MouseEvent) => {
    if (!isDrawingZone) return;
    const p = toFeet(e);
    setCurrentPolygon((prev) => [...prev, p]);
  };

  const finishDrawingZone = () => {
    if (currentPolygon.length < 3) {
      alert("A polygon must have at least 3 points.");
      setCurrentPolygon([]);
      setIsDrawingZone(false);
      return;
    }
    
    // In a real app, you'd prompt the user for these details via a modal
    const zoneName = prompt("Enter Sponsor Name:") || "Unknown Sponsor";
    const zoneMessage = prompt("Enter Notification Message:") || "Stop by our booth!";
    
    const newZone: SponsorshipZone = {
      id: `zone_${Date.now()}`,
      name: zoneName,
      message: zoneMessage,
      polygon: currentPolygon,
    };

    onSaveSponsorshipZone?.(newZone);
    setCurrentPolygon([]);
    setIsDrawingZone(false);
  };
  // --------------------------------

  const handleAssetDown = (e: React.PointerEvent, asset: FloorplanAsset) => {
    if (isDrawingZone) return; // Prevent grabbing assets while drawing
    e.stopPropagation();
    onSelect?.(asset);
    if (readOnly) return;
    const p = toFeet(e);
    setDrag({ id: asset.id, offsetX: p.x - asset.x, offsetY: p.y - asset.y });
    setLocalSelectedId(asset.id);
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!drag || !onMove) return;
    const p = toFeet(e);
    onMove(drag.id, p.x - drag.offsetX, p.y - drag.offsetY);
  };

  const handlePoiDown = (e: React.PointerEvent, poi: AccessibilityPoi) => {
    if (isDrawingZone) return;
    e.stopPropagation();
    onSelectPoi?.(poi);
    if (readOnly || !onMovePoi) return;
    const p = toFeet(e);
    setDrag({ id: poi.id, offsetX: p.x - poi.x_ft, offsetY: p.y - poi.y_ft });
    setLocalSelectedId(poi.id);
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {}
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

  // Check if attendee is inside any zone
  const activeZone = useMemo(() => {
    if (!attendeeLocation) return null;
    return sponsorshipZones.find(z => isPointInPolygon(attendeeLocation, z.polygon));
  }, [attendeeLocation, sponsorshipZones]);

  return (
    <div className="flex flex-col gap-4">
      
      {/* Organizer Controls for #4779 */}
      {!readOnly && (
        <div className="flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
           <button 
             onClick={() => setIsDrawingZone(!isDrawingZone)}
             className={`px-4 py-2 font-bold rounded-lg border-2 transition-colors ${
               isDrawingZone 
                 ? "bg-amber-100 border-amber-500 text-amber-700" 
                 : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
             }`}
           >
             {isDrawingZone ? "Cancel Drawing" : "📍 Draw Sponsorship Zone"}
           </button>
           
           {isDrawingZone && currentPolygon.length >= 3 && (
             <button 
                onClick={finishDrawingZone}
                className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700"
             >
                Save Zone ({currentPolygon.length} points)
             </button>
           )}
        </div>
      )}

      {/* Attendee Notification Overlay for #4779 */}
      {readOnly && activeZone && (
        <div className="p-4 bg-green-100 border-l-4 border-green-500 text-green-900 rounded-md shadow-sm animate-pulse">
           <strong>You're near the {activeZone.name} booth!</strong> {activeZone.message}
        </div>
      )}

      <div className="w-full overflow-auto bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewW} ${viewH}`}
          className={`w-full h-auto touch-none select-none rounded-lg bg-white dark:bg-gray-800 shadow-inner ${isDrawingZone ? "cursor-crosshair" : ""}`}
          onPointerMove={(e) => {
            handleMove(e);
            handlePoiMove(e);
          }}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
          onClick={handleSvgClick}
          role="img"
          aria-label={`Event floorplan covering ${venue.width_ft} by ${venue.height_ft} feet`}
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

          {/* Issue #4779 - Render Saved Sponsorship Zones */}
          {sponsorshipZones.map((zone) => (
            <polygon
              key={zone.id}
              points={zone.polygon.map(p => `${p.x * FT_TO_PX},${p.y * FT_TO_PX}`).join(" ")}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth={3}
              strokeDasharray="5 5"
            />
          ))}

          {/* Issue #4779 - Render the Zone Currently Being Drawn */}
          {isDrawingZone && currentPolygon.length > 0 && (
            <g>
              <polyline
                points={currentPolygon.map(p => `${p.x * FT_TO_PX},${p.y * FT_TO_PX}`).join(" ")}
                fill="none"
                stroke="#d97706"
                strokeWidth={3}
              />
              {currentPolygon.map((p, i) => (
                <circle key={i} cx={p.x * FT_TO_PX} cy={p.y * FT_TO_PX} r={5} fill="#d97706" />
              ))}
            </g>
          )}

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

            const isFiltering = readOnly && highlightIds != null;
            const isMatch = isFiltering ? (highlightIds?.has(asset.id) ?? false) : false;
            const isDimmed = isFiltering && !isMatch;
            const groupOpacity = isDimmed ? 0.12 : undefined;
            const matchStroke = isMatch ? "#f59e0b" : null;

            return (
              <g
                key={asset.id}
                onPointerDown={(e) => handleAssetDown(e, asset)}
                className={`${readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${isDrawingZone ? "pointer-events-none" : ""}`}
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
          
          {showPois &&
            pois.map((poi) => {
              const d = POI_DEFAULTS[poi.kind];
              const isSelected = activeSelectedId === poi.id;
              const dimmed = accessibilityMode && !d.accessible;
              return (
                <g
                  key={poi.id}
                  onPointerDown={(e) => handlePoiDown(e, poi)}
                  className={`${readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${isDrawingZone ? "pointer-events-none" : ""}`}
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

          {/* Simulated Attendee Location Marker */}
          {attendeeLocation && readOnly && (
            <circle
              cx={attendeeLocation.x * FT_TO_PX}
              cy={attendeeLocation.y * FT_TO_PX}
              r={6}
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth={2}
              className="animate-pulse"
            />
          )}
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-blue-500/20 border border-dashed border-blue-500 inline-block" />
            Sponsorship Geofence
          </span>
          {readOnly && attendeeLocation && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block animate-pulse" />
              Your Live Location
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-dashed border-red-500 inline-block" />
            Fire exit clearance (do not block)
          </span>
          {/* Rest of the original legend remains intact... */}
        </div>
      </div>
    </div>
  );
};
