import React, { useState } from "react";

export interface AuditoriumSeat {
  id: string; // e.g. "A1", "A2", "seat-A1"
  label: string; // e.g. "A1"
  row: string; // e.g. "A"
  number: number; // e.g. 1
  x: number;
  y: number;
  width?: number;
  height?: number;
  shape?: "rect" | "circle";
  status?: "available" | "sold" | "reserved" | "maintenance";
}

export interface AuditoriumMapProps {
  seats?: AuditoriumSeat[];
  soldSeatIds?: string[];
  selectedSeats?: string[];
  onSeatSelect?: (seatId: string) => void;
  onSeatDeselect?: (seatId: string) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  maxSelections?: number;
  stageLabel?: string;
}

export function AuditoriumMap({
  seats = [],
  soldSeatIds = [],
  selectedSeats: externalSelectedSeats,
  onSeatSelect,
  onSeatDeselect,
  onSelectionChange,
  maxSelections = 4,
  stageLabel = "AUDITORIUM STAGE",
}: AuditoriumMapProps) {
  const [internalSelectedSeats, setInternalSelectedSeats] = useState<string[]>([]);
  const selectedSeats = externalSelectedSeats ?? internalSelectedSeats;

  const handleSeatClick = (seatId: string) => {
    const isSold = soldSeatIds.includes(seatId);
    if (isSold) return;

    const isAlreadySelected = selectedSeats.includes(seatId);

    if (isAlreadySelected) {
      if (onSeatDeselect) {
        onSeatDeselect(seatId);
      } else {
        const next = selectedSeats.filter((id) => id !== seatId);
        setInternalSelectedSeats(next);
        onSelectionChange?.(next);
      }
    } else {
      if (selectedSeats.length >= maxSelections) return;
      if (onSeatSelect) {
        onSeatSelect(seatId);
      } else {
        const next = [...selectedSeats, seatId];
        setInternalSelectedSeats(next);
        onSelectionChange?.(next);
      }
    }
  };

  return (
    <div className="auditorium-map-container neu-border bg-white p-4 relative overflow-auto">
      {/* SVG Seating Chart */}
      <svg
        width="100%"
        height="450"
        viewBox="0 0 800 450"
        className="w-full h-auto select-none"
        aria-label="Auditorium Seating Chart"
      >
        {/* Stage */}
        <g data-testid="auditorium-stage">
          <rect
            x="200"
            y="15"
            width="400"
            height="35"
            rx="4"
            className="fill-gray-900 stroke-gray-700"
          />
          <text
            x="400"
            y="37"
            textAnchor="middle"
            className="fill-white font-mono text-xs font-bold uppercase tracking-wider"
          >
            {stageLabel}
          </text>
        </g>

        {/* Seats Grid */}
        <g data-testid="auditorium-seats">
          {seats.map((seat) => {
            const seatId = seat.id;
            const isSold =
              soldSeatIds.includes(seatId) || seat.status === "sold" || seat.status === "reserved";
            const isSelected = selectedSeats.includes(seatId);

            let seatClasses = "transition-all duration-150 stroke-2 ";
            if (isSold) {
              seatClasses +=
                "fill-gray-400 stroke-gray-500 pointer-events-none cursor-not-allowed opacity-60";
            } else if (isSelected) {
              seatClasses += "fill-blue-600 stroke-blue-800 cursor-pointer scale-105";
            } else {
              seatClasses +=
                "fill-emerald-500 stroke-emerald-700 hover:fill-emerald-400 cursor-pointer";
            }

            const width = seat.width || 24;
            const height = seat.height || 24;
            const elementId = seatId.startsWith("seat-") ? seatId : `seat-${seatId}`;

            return (
              <g key={seatId} data-testid={`seat-group-${seatId}`}>
                {seat.shape === "circle" ? (
                  <circle
                    id={elementId}
                    data-testid={elementId}
                    cx={seat.x + width / 2}
                    cy={seat.y + height / 2}
                    r={width / 2}
                    className={seatClasses}
                    onClick={() => handleSeatClick(seatId)}
                    aria-label={`Seat ${seat.label || seatId} ${isSold ? "Sold" : isSelected ? "Selected" : "Available"}`}
                  />
                ) : (
                  <rect
                    id={elementId}
                    data-testid={elementId}
                    x={seat.x}
                    y={seat.y}
                    width={width}
                    height={height}
                    rx="3"
                    className={seatClasses}
                    onClick={() => handleSeatClick(seatId)}
                    aria-label={`Seat ${seat.label || seatId} ${isSold ? "Sold" : isSelected ? "Selected" : "Available"}`}
                  />
                )}
                <text
                  x={seat.x + width / 2}
                  y={seat.y + height / 2 + 4}
                  textAnchor="middle"
                  className="fill-white font-mono text-[9px] font-bold pointer-events-none select-none"
                >
                  {seat.label || seatId}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Seating Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-black font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-emerald-500 border border-emerald-700" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-blue-600 border border-blue-800" />
          <span>Selected ({selectedSeats.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-gray-400 border border-gray-500 opacity-60" />
          <span>Sold / Taken</span>
        </div>
      </div>
    </div>
  );
}
