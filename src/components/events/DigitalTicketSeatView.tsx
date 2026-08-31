// =============================================================================
// Component: DigitalTicketSeatView
// Issue: #3873 - Build an 'Interactive Seat Map' for Large Auditoriums
// Description: Renders reserved seat information (e.g., 'Row B, Seat 14') on digital tickets.
// =============================================================================

import React from "react";
import Armchair from "lucide-react/dist/esm/icons/armchair";
import MapPin from "lucide-react/dist/esm/icons/map-pin";

interface DigitalTicketSeatViewProps {
  seatLabel?: string | null;
  venueName?: string;
}

export function DigitalTicketSeatView({
  seatLabel = "Row B, Seat 14",
  venueName = "Main Auditorium",
}: DigitalTicketSeatViewProps) {
  if (!seatLabel) return null;

  return (
    <div
      data-testid="digital-ticket-seat-badge"
      className="bg-slate-950 border border-indigo-500/40 rounded-2xl p-4 my-3 text-slate-100 flex items-center justify-between font-mono"
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
          <Armchair className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Assigned Seat</p>
          <p className="text-sm font-black text-white">{seatLabel}</p>
        </div>
      </div>

      <div className="text-right text-xs text-slate-400 flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5 text-indigo-400" />
        <span>{venueName}</span>
      </div>
    </div>
  );
}
