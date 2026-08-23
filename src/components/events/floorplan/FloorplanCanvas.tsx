// =============================================================================
// Component: FloorplanCanvas
// Issues: #3675 / #4145 - Interactive "Event Layout" Floorplan Builder
// Description: SVG-based 2D canvas. Renders venue walls, fire-exit clearance
// pathways and draggable assets. Assets intersecting a fire pathway turn red.
// Pointer events convert screen deltas into feet using the FT_TO_PX scale.
// In read-only mode (attendee view) dragging is disabled and assets become
// clickable so attendees can look up "who is at this table".
// =============================================================================

import React, { useRef, useState } from "react";
import {
  FloorplanAsset,
  VenueBounds,
  FT_TO_PX,
  ASSET_DEFAULTS,
} from "../../../lib/floorplan/types";
import { allFirePathways } from "../../../lib/floorplan/collision";

interface FloorplanCanvasProps {
  venue: VenueBounds;
  assets: FloorplanAsset[];
  collidingIds?: Set<string>;
  onMove?: (id: string, x: number, y: number) => void;
  onRemove?: (id: string) => void;
  readOnly?: boolean;
  selectedId?: string | null;
  onSelect?: (asset: FloorplanAsset) => void;
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
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);

  const viewW = venue.width_ft * FT_TO_PX;
  const viewH = venue.height_ft * FT_TO_PX;

  const activeSelectedId = readOnly ? selectedId : localSelectedId;

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

  const handleUp = () => setDrag(null);

  const pathways = allFirePathways(venue);

  return (
    <div className="w-full overflow-auto bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full h-auto touch-none select-none rounded-lg bg-white dark:bg-gray-800 shadow-inner"
        onPointerMove={handleMove}
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

        {/* Draggable assets */}
        {assets.map((asset) => {
          const colliding = collidingIds?.has(asset.id) ?? false;
          const color = colliding ? "#ef4444" : ASSET_DEFAULTS[asset.kind].color;
          const isSelected = activeSelectedId === asset.id;
          const isRound = asset.kind === "round_table";
          const isExit = asset.kind === "exit";

          return (
            <g
              key={asset.id}
              onPointerDown={(e) => handleAssetDown(e, asset)}
              className={`${readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
              data-testid={`floorplan-asset-${asset.id}`}
            >
              {isRound ? (
                <ellipse
                  cx={(asset.x + asset.width / 2) * FT_TO_PX}
                  cy={(asset.y + asset.height / 2) * FT_TO_PX}
                  rx={(asset.width / 2) * FT_TO_PX}
                  ry={(asset.height / 2) * FT_TO_PX}
                  fill={color}
                  opacity={0.85}
                  stroke={isSelected || colliding ? "#111827" : "transparent"}
                  strokeWidth={3}
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
                  stroke={isSelected || colliding ? "#111827" : "transparent"}
                  strokeWidth={3}
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
      </div>
    </div>
  );
};
