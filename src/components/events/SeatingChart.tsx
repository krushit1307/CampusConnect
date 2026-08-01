import { useState, useRef, useCallback, useEffect } from "react";

export interface SeatData {
  id: string;
  label: string;
  row_label: string;
  section: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "rect" | "circle";
  status: "available" | "reserved" | "maintenance";
}

interface SeatingChartProps {
  seats: SeatData[];
  reservedSeats: string[];
  selectedSeats: string[];
  onSeatClick: (seatId: string) => void;
  maxSeats?: number;
  stageLabel?: string;
}

const SEAT_COLORS = {
  available: { fill: "#3B82F6", stroke: "#2563EB" },
  reserved: { fill: "#9CA3AF", stroke: "#6B7280" },
  selected: { fill: "#22C55E", stroke: "#16A34A" },
  maintenance: { fill: "#FCA5A5", stroke: "#EF4444" },
} as const;

export function SeatingChart({
  seats,
  reservedSeats,
  selectedSeats,
  onSeatClick,
  maxSeats = 4,
  stageLabel = "STAGE",
}: SeatingChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [svgSize, setSvgSize] = useState({ width: 800, height: 500 });

  const minZoom = 0.3;
  const maxZoom = 4;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(minZoom, Math.min(maxZoom, z * delta)));
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === svgRef.current || (e.target as HTMLElement).closest?.("[data-stage]")) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    },
    [isPanning, panStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        setIsPanning(true);
        setPanStart({
          x: e.touches[0].clientX - pan.x,
          y: e.touches[0].clientY - pan.y,
        });
      }
    },
    [pan],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPanning || e.touches.length !== 1) return;
      setPan({ x: e.touches[0].clientX - panStart.x, y: e.touches[0].clientY - panStart.y });
    },
    [isPanning, panStart],
  );

  const seatSize = Math.max(18, 22 * zoom);
  const stageWidth = Math.min(400, svgSize.width * 0.6);

  return (
    <div className="neu-border bg-white overflow-hidden relative">
      <svg
        ref={svgRef}
        width="100%"
        height="500"
        viewBox={`0 0 ${svgSize.width} ${svgSize.height}`}
        className="cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        <g
          transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
          style={{ transformOrigin: "center" }}
        >
          <rect
            x={(svgSize.width / zoom - stageWidth) / 2 - pan.x / zoom}
            y={10 - pan.y / zoom}
            width={stageWidth}
            height={40}
            rx={4}
            className="fill-gray-800"
            data-stage
          />
          <text
            x={svgSize.width / (2 * zoom) - pan.x / zoom}
            y={35 - pan.y / zoom}
            textAnchor="middle"
            className="fill-white font-bold text-xs"
            data-stage
          >
            {stageLabel}
          </text>

          {seats.map((seat) => {
            const isReserved = reservedSeats.includes(seat.id);
            const isSelected = selectedSeats.includes(seat.id);
            const isMaintenance = seat.status === "maintenance";

            let colors: { fill: string; stroke: string };
            if (isSelected) {
              colors = SEAT_COLORS.selected;
            } else if (isReserved || isMaintenance) {
              colors = SEAT_COLORS.reserved;
            } else {
              colors = SEAT_COLORS.available;
            }

            const isClickable = !isReserved && !isMaintenance;
            const canSelectMore = selectedSeats.length < maxSeats || isSelected;

            const seatProps = {
              x: seat.x,
              y: seat.y,
              width: seat.width,
              height: seat.height,
              rx: 3,
              fill: colors.fill,
              stroke: colors.stroke,
              strokeWidth: 1.5,
              className: `transition-colors duration-150 ${
                isClickable && canSelectMore
                  ? "cursor-pointer hover:opacity-80"
                  : "cursor-not-allowed"
              }`,
              onClick: () => {
                if (isClickable && canSelectMore) {
                  onSeatClick(seat.id);
                }
              },
            };

            return (
              <g key={seat.id}>
                {seat.shape === "circle" ? (
                  <circle
                    cx={seat.x + seat.width / 2}
                    cy={seat.y + seat.height / 2}
                    r={seat.width / 2}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={1.5}
                    className={seatProps.className}
                    onClick={seatProps.onClick}
                  />
                ) : (
                  <rect {...seatProps} />
                )}
                <text
                  x={seat.x + seat.width / 2}
                  y={seat.y + seat.height / 2 + 3}
                  textAnchor="middle"
                  className="fill-white text-[8px] font-bold pointer-events-none select-none"
                >
                  {seat.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/90 border border-gray-200 rounded px-2 py-1">
        <button
          onClick={() => setZoom((z) => Math.max(minZoom, z / 1.2))}
          className="p-1 hover:bg-gray-100 rounded text-xs font-bold"
        >
          -
        </button>
        <span className="font-mono text-xs min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(maxZoom, z * 1.2))}
          className="p-1 hover:bg-gray-100 rounded text-xs font-bold"
        >
          +
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="ml-1 p-1 hover:bg-gray-100 rounded text-xs font-mono"
        >
          Reset
        </button>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-3 bg-white/90 border border-gray-200 rounded px-3 py-1.5">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500 border border-blue-700" />
          <span className="font-mono text-[10px]">Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500 border border-green-700" />
          <span className="font-mono text-[10px]">Selected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-400 border border-gray-500" />
          <span className="font-mono text-[10px]">Taken</span>
        </div>
      </div>
    </div>
  );
}
