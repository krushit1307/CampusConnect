import React, { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Search, MapPin } from "lucide-react";

export interface AttendeeMapNode {
  id: string;
  entity_name: string | null;
  type: "table" | "stage" | "boundary" | "booth";
  x_coord: number;
  y_coord: number;
  width: number;
  height: number;
  rotation: number;
}

interface AttendeeVenueMapProps {
  nodes: AttendeeMapNode[];
  backgroundImageUrl?: string | null;
}

export const AttendeeVenueMap: React.FC<AttendeeVenueMapProps> = ({
  nodes,
  backgroundImageUrl,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Colors mapping for different node types
  const colors = {
    table: "bg-amber-100 border-amber-400",
    stage: "bg-indigo-100 border-indigo-400",
    boundary: "bg-red-50 border-red-400 border-dashed",
    booth: "bg-emerald-100 border-emerald-400",
  };

  // Zoom controls
  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => {
    setScale((prev) => {
      const nextScale = Math.max(prev - 0.25, 1);
      if (nextScale === 1) {
        setPosition({ x: 0, y: 0 }); // Reset offset if zoomed out fully
      }
      return nextScale;
    });
  };
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setSearchQuery("");
  };

  // Pan / Drag handlers for both mouse and touch events
  const handleStart = (clientX: number, clientY: number) => {
    if (scale === 1) return; // Only allow panning when zoomed in
    setIsDragging(true);
    dragStart.current = { x: clientX - position.x, y: clientY - position.y };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;

    // Calculate bounds so user can't pan completely out of view
    const newX = clientX - dragStart.current.x;
    const newY = clientY - dragStart.current.y;

    // Keep panning bounded relative to scale factor
    const bound = (scale - 1) * 200;
    setPosition({
      x: Math.max(-bound, Math.min(newX, bound)),
      y: Math.max(-bound, Math.min(newY, bound)),
    });
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  // Mouse drag events
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  };

  // Touch drag events
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Clean up drag status on document level mouse up
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-black" />
          </span>
          <input
            type="text"
            placeholder="Search tables, booths, or sponsors (e.g. Microsoft)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border-2 border-black bg-white font-mono text-sm shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          />
        </div>

        {/* View Controls */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleZoomIn}
            className="flex items-center justify-center p-2 border-2 border-black bg-white shadow-[2px_2px_0_0_#000] hover:bg-cream active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleZoomOut}
            className="flex items-center justify-center p-2 border-2 border-black bg-white shadow-[2px_2px_0_0_#000] hover:bg-cream active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            title="Zoom Out"
            disabled={scale === 1}
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={handleReset}
            className="flex items-center justify-center p-2 border-2 border-black bg-white shadow-[2px_2px_0_0_#000] hover:bg-cream active:translate-x-0.5 active:translate-y-0.5 transition-transform"
            title="Reset View"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div
        ref={containerRef}
        onMouseMove={onMouseMove}
        onTouchMove={onTouchMove}
        onMouseUp={handleEnd}
        onTouchEnd={handleEnd}
        className={`w-full aspect-[4/3] md:aspect-[16/10] border-4 border-black bg-slate-50 relative overflow-hidden shadow-[4px_4px_0_0_#000] select-none ${
          scale > 1 ? "cursor-grab" : ""
        } ${isDragging ? "cursor-grabbing" : ""}`}
      >
        <div
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          className="w-full h-full relative transition-transform duration-75 origin-center"
          style={{
            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            backgroundImage: "radial-gradient(#000 8%, transparent 9%)",
            backgroundSize: "20px 20px",
          }}
        >
          {/* Optional Floorplan Background Image */}
          {backgroundImageUrl && (
            <img
              src={backgroundImageUrl}
              alt="Floorplan background"
              className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
            />
          )}

          {/* Render nodes dynamically with relative percentages */}
          {nodes.map((node) => {
            const matchesQuery =
              searchQuery.trim() !== "" &&
              node.entity_name?.toLowerCase().includes(searchQuery.toLowerCase());

            return (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  left: `${node.x_coord}%`,
                  top: `${node.y_coord}%`,
                  width: `${node.width}%`,
                  height: `${node.height}%`,
                  transform: `rotate(${node.rotation}deg)`,
                  zIndex: matchesQuery ? 50 : 10,
                }}
                className={`border-2 border-black flex flex-col items-center justify-center p-1 text-center shadow-[1px_1px_0_0_#000] transition-colors duration-200 ${
                  matchesQuery
                    ? "bg-red-500 text-white border-red-700 animate-pulse ring-4 ring-red-400 ring-offset-1"
                    : colors[node.type] || "bg-white"
                }`}
              >
                <div className="flex flex-col items-center justify-center w-full h-full overflow-hidden">
                  <span className="font-mono text-[9px] md:text-[10px] font-black uppercase leading-tight truncate w-full px-0.5">
                    {node.entity_name || `${node.type.toUpperCase()}`}
                  </span>
                  <span
                    className={`text-[7px] uppercase font-bold tracking-wider leading-none mt-0.5 ${matchesQuery ? "text-red-100" : "text-gray-500"}`}
                  >
                    {node.type}
                  </span>
                  {matchesQuery && <MapPin className="w-3 h-3 text-white mt-0.5 shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Drag Hint for Panning */}
        {scale > 1 && (
          <div className="absolute bottom-2 left-2 bg-black text-white px-2 py-1 text-[8px] font-mono uppercase tracking-wider rounded border border-white opacity-70 pointer-events-none">
            Drag to pan map
          </div>
        )}
      </div>
    </div>
  );
};
