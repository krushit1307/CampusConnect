import React, { useState, useRef, useEffect } from "react";
import { Accessibility, ZoomIn, ZoomOut, RotateCcw, Search, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import QueueTrackerCard from "@/components/QueueTrackerCard";
import { useAuth } from "@/components/Auth/AuthSecurityContext";
import {
  ACCESSIBILITY_NODE_LABELS,
  createAccessibilityRouteSegments,
  getAccessibilityNodes,
  getSpatialDescription,
  type MapNodeType,
} from "@/lib/accessibilityMap";

export interface AttendeeMapNode {
  id: string;
  entity_name: string | null;
  type: MapNodeType;
  x_coord: number;
  y_coord: number;
  width: number;
  height: number;
  rotation: number;
  accessibility_notes?: string | null;
  required_ticket_tier_id?: string | null;
}

interface AttendeeVenueMapProps {
  nodes: AttendeeMapNode[];
  backgroundImageUrl?: string | null;
  userTicketTierId?: string | null;
  onSeatSelected?: (nodeId: string) => void;
  assignedSeatNodeId?: string | null;
}

export const AttendeeVenueMap: React.FC<AttendeeVenueMapProps> = ({
  nodes,
  backgroundImageUrl,
  userTicketTierId,
  onSeatSelected,
  assignedSeatNodeId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [scale, setScale] = useState(1);
  const [isAccessibilityMode, setIsAccessibilityMode] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSeatNodeId, setSelectedSeatNodeId] = useState<string | null>(
    assignedSeatNodeId || null,
  );
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const accessibilityNodes = getAccessibilityNodes(nodes);
  const entrance = accessibilityNodes.find((node) => node.type === "entrance");
  const routeSegments = createAccessibilityRouteSegments(nodes);

  const { user } = useAuth();
  const supabase = createClient();
  const [queueNodes, setQueueNodes] = useState<
    Record<string, { id: string; status_color: "green" | "amber" | "red" }>
  >({});
  const [selectedQueueNodeId, setSelectedQueueNodeId] = useState<string | null>(null);

  useEffect(() => {
    const fetchQueues = async () => {
      const { data } = await supabase.from("queue_nodes").select("id, booth_id, status_color");
      if (data) {
        const queueMap: Record<string, any> = {};
        data.forEach((q) => {
          queueMap[q.booth_id] = { id: q.id, status_color: q.status_color };
        });
        setQueueNodes(queueMap);
      }
    };
    fetchQueues();

    const channel = supabase
      .channel("venue-queues")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "queue_nodes" },
        (payload) => {
          setQueueNodes((prev) => ({
            ...prev,
            [payload.new.booth_id]: { id: payload.new.id, status_color: payload.new.status_color },
          }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Colors mapping for normal mode; Accessibility Mode applies a high-contrast blue layer.
  const colors: Record<MapNodeType, string> = {
    table: "bg-amber-100 border-amber-400",
    stage: "bg-indigo-100 border-indigo-400",
    boundary: "bg-red-50 border-red-400 border-dashed",
    booth: "bg-emerald-100 border-emerald-400",
    sponsor: "bg-emerald-100 border-emerald-500",
    entrance: "bg-blue-100 border-blue-700",
    elevator: "bg-blue-200 border-blue-800",
    ramp: "bg-blue-300 border-blue-900",
    restroom: "bg-cyan-200 border-cyan-800",
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

  const handleNodeClick = async (node: AttendeeMapNode) => {
    const queueInfo = queueNodes[node.id];

    // VIP Seating check
    if (node.required_ticket_tier_id && node.required_ticket_tier_id !== userTicketTierId) {
      import("sonner").then(({ toast }) => {
        toast.error("This table requires a VIP Ticket [Click to Upgrade].");
      });
      return; // block selection
    }

    if (queueInfo) {
      setSelectedQueueNodeId(queueInfo.id);
    } else if (node.type === "table" || node.type === "booth") {
      setSelectedSeatNodeId(node.id);

      // Save the selected seat if they are RSVP'd
      if (userTicketTierId !== undefined) {
        import("sonner").then(({ toast }) => {
          toast.success(`Seat selected at ${node.entity_name || node.type}!`);
        });
        // We can also trigger an optional onSeatSelected callback here
        if (onSeatSelected) {
          onSeatSelected(node.id);
        }
      }
    }
  };

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

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            aria-pressed={isAccessibilityMode}
            aria-controls="venue-accessibility-route-guide"
            onClick={() => setIsAccessibilityMode((enabled) => !enabled)}
            className={`flex items-center gap-2 border-2 border-black px-3 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0_0_#000] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 ${
              isAccessibilityMode
                ? "bg-blue-700 text-white"
                : "bg-white text-black hover:bg-blue-50"
            }`}
          >
            <Accessibility className="h-4 w-4" />
            Accessibility Mode
          </button>

          {/* View Controls */}
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Zoom in on venue map"
              className="flex items-center justify-center p-2 border-2 border-black bg-white shadow-[2px_2px_0_0_#000] hover:bg-cream active:translate-x-0.5 active:translate-y-0.5 transition-transform"

              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Zoom out on venue map"
              className="flex items-center justify-center p-2 border-2 border-black bg-white shadow-[2px_2px_0_0_#000] hover:bg-cream active:translate-x-0.5 active:translate-y-0.5 transition-transform"

              title="Zoom Out"
              disabled={scale === 1}
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={handleReset}
              aria-label="Reset map view"
              className="flex items-center justify-center p-2 border-2 border-black bg-white shadow-[2px_2px_0_0_#000] hover:bg-cream active:translate-x-0.5 active:translate-y-0.5 transition-transform"
              title="Reset View"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div
        ref={containerRef}
        role="region"
        aria-label={
          isAccessibilityMode ? "Venue floorplan with accessibility routes" : "Venue floorplan"
        }
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

          {/* Queue Tracker Floating Modal */}
          {selectedQueueNodeId && user && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 pointer-events-auto">
              <QueueTrackerCard
                nodeId={selectedQueueNodeId}
                userId={user.id}
                onClose={() => setSelectedQueueNodeId(null)}
              />
            </div>
          )}

          {isAccessibilityMode && routeSegments.length > 0 && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {routeSegments.map((segment) => (
                <line
                  key={segment.id}
                  x1={segment.x1}
                  y1={segment.y1}
                  x2={segment.x2}
                  y2={segment.y2}
                  vectorEffect="non-scaling-stroke"
                  stroke="#005fcc"
                  strokeWidth="0.8"
                  strokeDasharray="2 1"
                />
              ))}
            </svg>
          )}

          {/* Render nodes dynamically with relative percentages */}
          {nodes.map((node) => {
            const matchesQuery =
              searchQuery.trim() !== "" &&
              node.entity_name?.toLowerCase().includes(searchQuery.toLowerCase());
            const isAccessibilityInfrastructure = getAccessibilityNodes([node]).length > 0;
            const spatialDescription = isAccessibilityInfrastructure
              ? getSpatialDescription(node, entrance)
              : `${node.entity_name || ACCESSIBILITY_NODE_LABELS[node.type] || node.type} map element.`;

            const queueInfo = queueNodes[node.id];
            const isVip = !!node.required_ticket_tier_id;
            const isSelected = selectedSeatNodeId === node.id;

            let dynamicColorClass = colors[node.type] || "bg-white";
            if (isVip && !isAccessibilityMode && !matchesQuery) {
              dynamicColorClass = "bg-amber-200 border-amber-600 ring-2 ring-yellow-400";
            }
            if (queueInfo) {
              if (queueInfo.status_color === "red")
                dynamicColorClass =
                  "bg-rose-500 text-white border-rose-700 ring-4 ring-rose-200 animate-pulse";
              else if (queueInfo.status_color === "amber")
                dynamicColorClass =
                  "bg-amber-400 text-amber-900 border-amber-600 ring-2 ring-amber-200";
              else if (queueInfo.status_color === "green")
                dynamicColorClass =
                  "bg-emerald-400 text-emerald-950 border-emerald-600 ring-2 ring-emerald-200";
            }
            if (isSelected) {
              dynamicColorClass =
                "bg-lime-300 text-lime-950 border-lime-600 ring-4 ring-lime-400 shadow-xl scale-105 z-50";
            }

            return (
              <div
                key={node.id}
                role="img"
                tabIndex={isAccessibilityMode && isAccessibilityInfrastructure ? 0 : -1}
                aria-label={spatialDescription}
                onClick={() => handleNodeClick(node)}
                style={{
                  position: "absolute",
                  left: `${node.x_coord}%`,
                  top: `${node.y_coord}%`,
                  width: `${node.width}%`,
                  height: `${node.height}%`,
                  transform: `rotate(${node.rotation}deg)`,
                  zIndex: isSelected
                    ? 60
                    : matchesQuery
                      ? 50
                      : isAccessibilityInfrastructure
                        ? 40
                        : queueInfo
                          ? 30
                          : 10,
                }}
                className={`border-2 border-black flex flex-col items-center justify-center p-1 text-center shadow-[1px_1px_0_0_#000] transition-colors duration-200 cursor-pointer hover:scale-105 ${
                  matchesQuery
                    ? "bg-red-500 text-white border-red-700 animate-pulse ring-4 ring-red-400 ring-offset-1"
                    : isAccessibilityMode && isAccessibilityInfrastructure
                      ? "bg-blue-700 text-white border-white ring-2 ring-blue-950"
                      : isAccessibilityMode
                        ? "opacity-25 grayscale"
                        : dynamicColorClass
                }`}
              >
                <div className="flex flex-col items-center justify-center w-full h-full overflow-hidden">
                  <span className="font-mono text-[9px] md:text-[10px] font-black uppercase leading-tight truncate w-full px-0.5">
                    {node.entity_name || `${node.type.toUpperCase()}`}
                  </span>
                  <span
                    className={`text-[7px] uppercase font-bold tracking-wider leading-none mt-0.5 ${matchesQuery || (isAccessibilityMode && isAccessibilityInfrastructure) ? "text-blue-100" : "text-gray-500"}`}
                  >
                    {isVip ? "VIP " : ""}
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

      {isAccessibilityMode && (
        <section
          id="venue-accessibility-route-guide"
          aria-live="polite"
          className="border-2 border-blue-900 bg-blue-50 p-4 text-black shadow-[3px_3px_0_0_#005fcc]"
        >
          <h3
            id="venue-accessibility-route-guide-heading"
            className="font-display text-lg font-black uppercase text-blue-950"
          >
            Accessible route guide
          </h3>
          {accessibilityNodes.length === 0 ? (
            <p className="mt-2 font-mono text-sm">
              No accessibility infrastructure has been mapped for this floorplan yet.
            </p>
          ) : (
            <>
              <p className="mt-2 font-mono text-xs leading-5">
                Blue lines connect the Main Entrance to each mapped accessibility node. Focus a blue
                node to hear its spatial description.
              </p>
              {!entrance && (
                <p className="mt-2 border-2 border-amber-700 bg-amber-100 p-2 font-mono text-xs font-bold">
                  Add a Main Entrance in the organizer map builder to enable route descriptions.
                </p>
              )}
              <ul
                className="mt-3 grid gap-2 sm:grid-cols-2"
                aria-label="Accessibility infrastructure"
              >
                {accessibilityNodes.map((node) => (
                  <li
                    key={node.id}
                    className="border-2 border-blue-900 bg-white p-2 font-mono text-xs"
                  >
                    <span className="font-black uppercase">
                      {node.entity_name || ACCESSIBILITY_NODE_LABELS[node.type]}
                    </span>
                    <span className="mt-1 block">{getSpatialDescription(node, entrance)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
};
