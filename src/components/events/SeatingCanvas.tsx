// =============================================================================
// Component: SeatingCanvas
// Issue: #2730 - Implement a Graphical 'Seating Chart' Builder for Gala Events
// Description: Renders the interactive SVG canvas where tables and chairs are
// positioned. Handles drag-and-drop for tables, zooming, panning, and seat
// assignments via HTML5 Drag and Drop API.
// =============================================================================

import React, { useRef, useState, useEffect } from "react";
import { Table } from "../../hooks/useSeatingChart";

interface SeatingCanvasProps {
  tables: Table[];
  onMoveTable: (tableId: string, x: number, y: number) => void;
  onDeleteTable: (tableId: string) => void;
  onAssignSeat: (
    chairId: string,
    tableId: string,
    userId: string | null,
    userName: string | null,
  ) => void;
  draggedRsvp: { id: string; name: string } | null;
}

export const SeatingCanvas: React.FC<SeatingCanvasProps> = ({
  tables,
  onMoveTable,
  onDeleteTable,
  onAssignSeat,
  draggedRsvp,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Handle Mouse Down on Table (Start Drag)
  const handleTableMouseDown = (e: React.MouseEvent, table: Table) => {
    e.stopPropagation();
    setDraggingTable(table.id);
    setDragOffset({
      x: e.clientX / zoom - table.x,
      y: e.clientY / zoom - table.y,
    });
  };

  // Handle Mouse Move (Drag Table or Pan Canvas)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingTable) {
      const newX = e.clientX / zoom - dragOffset.x;
      const newY = e.clientY / zoom - dragOffset.y;
      onMoveTable(draggingTable, newX, newY);
    } else if (isPanning) {
      setPan({
        x: pan.x + (e.clientX - panStart.x),
        y: pan.y + (e.clientY - panStart.y),
      });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Handle Mouse Up (End Drag)
  const handleMouseUp = () => {
    setDraggingTable(null);
    setIsPanning(false);
  };

  // Handle Canvas Background Click (Start Pan)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  // Handle Zoom (Mouse Wheel)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.5, Math.min(2, prev + delta)));
  };

  // Handle Drop on Chair
  const handleChairDrop = (e: React.DragEvent, chairId: string, tableId: string) => {
    e.preventDefault();
    if (draggedRsvp) {
      onAssignSeat(chairId, tableId, draggedRsvp.id, draggedRsvp.name);
    }
  };

  // Handle Drag Over Chair (Allow Drop)
  const handleChairDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-gray-100 dark:bg-gray-900 cursor-grab active:cursor-grabbing">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setZoom((prev) => Math.min(2, prev + 0.2))}
          className="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>
        <div className="text-xs font-bold text-center text-gray-500 dark:text-gray-400 py-1">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.2))}
          className="w-8 h-8 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
          </svg>
        </button>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Grid Pattern */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                className="text-gray-200 dark:text-gray-800"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="10000" height="10000" x="-5000" y="-5000" fill="url(#grid)" />

          {/* Render Tables */}
          {tables.map((table) => (
            <g key={table.id} transform={`translate(${table.x}, ${table.y})`}>
              {/* Table Body */}
              {table.type === "round" ? (
                <circle
                  cx={0}
                  cy={0}
                  r={table.width / 2}
                  className="fill-amber-100 dark:fill-amber-900/40 stroke-amber-600 dark:stroke-amber-500 stroke-2 cursor-move"
                  onMouseDown={(e) => handleTableMouseDown(e, table)}
                />
              ) : (
                <rect
                  x={-table.width / 2}
                  y={-table.height / 2}
                  width={table.width}
                  height={table.height}
                  rx={8}
                  className="fill-amber-100 dark:fill-amber-900/40 stroke-amber-600 dark:stroke-amber-500 stroke-2 cursor-move"
                  onMouseDown={(e) => handleTableMouseDown(e, table)}
                />
              )}

              {/* Table Label */}
              <text
                x={0}
                y={5}
                textAnchor="middle"
                className="fill-amber-800 dark:fill-amber-200 text-xs font-bold pointer-events-none select-none"
              >
                {table.label}
              </text>

              {/* Delete Button */}
              <g
                transform={`translate(${table.width / 2 - 10}, ${-table.height / 2 - 10})`}
                onClick={() => onDeleteTable(table.id)}
                className="cursor-pointer hover:scale-110 transition-transform"
              >
                <circle cx={0} cy={0} r={10} className="fill-red-500 hover:fill-red-600" />
                <path
                  d="M-3-3 L3 3 M3-3 L-3 3"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>

              {/* Render Chairs */}
              {table.chairs.map((chair) => (
                <g
                  key={chair.id}
                  transform={`translate(${chair.x}, ${chair.y})`}
                  onDrop={(e) => handleChairDrop(e, chair.id, table.id)}
                  onDragOver={handleChairDragOver}
                  className="cursor-pointer"
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={12}
                    className={`
                      stroke-2 transition-all
                      ${
                        chair.assignedUserId
                          ? "fill-green-500 dark:fill-green-600 stroke-green-700 dark:stroke-green-400"
                          : draggedRsvp
                            ? "fill-indigo-200 dark:fill-indigo-900/50 stroke-indigo-500 stroke-dashed animate-pulse"
                            : "fill-gray-200 dark:fill-gray-700 stroke-gray-400 dark:stroke-gray-500"
                      }
                    `}
                  />
                  {chair.assignedUserName && (
                    <text
                      x={0}
                      y={20}
                      textAnchor="middle"
                      className="fill-gray-800 dark:fill-gray-200 text-[10px] font-medium pointer-events-none select-none"
                    >
                      {chair.assignedUserName.split(" ")[0]}
                    </text>
                  )}
                </g>
              ))}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};
