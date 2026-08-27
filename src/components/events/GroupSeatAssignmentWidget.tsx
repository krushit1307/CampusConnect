import React, { useState } from "react";
import {
  Armchair,
  Users,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Sparkles,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  VenueRow,
  SeatAssignmentResult,
  assignGroupSeats,
} from "@/lib/groupSeatAssignment";
import { cn } from "@/lib/utils";

export interface GroupSeatAssignmentWidgetProps {
  eventId?: string;
  eventTitle?: string;
  venueName?: string;
  initialSeatingChart?: VenueRow[];
  onConfirmReservation?: (result: SeatAssignmentResult) => void;
  className?: string;
}

export const MOCK_AUDITORIUM_CHART: VenueRow[] = [
  {
    rowLabel: "A",
    rowIndex: 0,
    seats: [
      { seatId: "A-1", rowLabel: "A", seatNumber: 1, isReserved: false },
      { seatId: "A-2", rowLabel: "A", seatNumber: 2, isReserved: false },
      { seatId: "A-3", rowLabel: "A", seatNumber: 3, isReserved: false },
      { seatId: "A-4", rowLabel: "A", seatNumber: 4, isReserved: false },
      { seatId: "A-5", rowLabel: "A", seatNumber: 5, isReserved: false },
      { seatId: "A-6", rowLabel: "A", seatNumber: 6, isReserved: true },
      { seatId: "A-7", rowLabel: "A", seatNumber: 7, isReserved: true },
      { seatId: "A-8", rowLabel: "A", seatNumber: 8, isReserved: false },
      { seatId: "A-9", rowLabel: "A", seatNumber: 9, isReserved: false },
      { seatId: "A-10", rowLabel: "A", seatNumber: 10, isReserved: false },
    ],
  },
  {
    rowLabel: "B",
    rowIndex: 1,
    seats: [
      { seatId: "B-1", rowLabel: "B", seatNumber: 1, isReserved: false },
      { seatId: "B-2", rowLabel: "B", seatNumber: 2, isReserved: false },
      { seatId: "B-3", rowLabel: "B", seatNumber: 3, isReserved: false },
      { seatId: "B-4", rowLabel: "B", seatNumber: 4, isReserved: true },
      { seatId: "B-5", rowLabel: "B", seatNumber: 5, isReserved: true },
      { seatId: "B-6", rowLabel: "B", seatNumber: 6, isReserved: false },
      { seatId: "B-7", rowLabel: "B", seatNumber: 7, isReserved: false },
      { seatId: "B-8", rowLabel: "B", seatNumber: 8, isReserved: false },
      { seatId: "B-9", rowLabel: "B", seatNumber: 9, isReserved: false },
      { seatId: "B-10", rowLabel: "B", seatNumber: 10, isReserved: false },
    ],
  },
  {
    rowLabel: "C",
    rowIndex: 2,
    seats: [
      { seatId: "C-1", rowLabel: "C", seatNumber: 1, isReserved: true },
      { seatId: "C-2", rowLabel: "C", seatNumber: 2, isReserved: true },
      { seatId: "C-3", rowLabel: "C", seatNumber: 3, isReserved: true },
      { seatId: "C-4", rowLabel: "C", seatNumber: 4, isReserved: false },
      { seatId: "C-5", rowLabel: "C", seatNumber: 5, isReserved: false },
      { seatId: "C-6", rowLabel: "C", seatNumber: 6, isReserved: false },
      { seatId: "C-7", rowLabel: "C", seatNumber: 7, isReserved: false },
      { seatId: "C-8", rowLabel: "C", seatNumber: 8, isReserved: false },
      { seatId: "C-9", rowLabel: "C", seatNumber: 9, isReserved: false },
      { seatId: "C-10", rowLabel: "C", seatNumber: 10, isReserved: false },
    ],
  },
];

export const GroupSeatAssignmentWidget: React.FC<GroupSeatAssignmentWidgetProps> = ({
  eventId = "evt-comedy-night-1",
  eventTitle = "Annual Campus Comedy Night Showcase",
  venueName = "Main University Auditorium (Stage)",
  initialSeatingChart = MOCK_AUDITORIUM_CHART,
  onConfirmReservation,
  className,
}) => {
  const [groupSize, setGroupSize] = useState<number>(5);
  const [seatingChart, setSeatingChart] = useState<VenueRow[]>(initialSeatingChart);
  const [reservationNotice, setReservationNotice] = useState<string | null>(null);

  const allocationResult: SeatAssignmentResult = assignGroupSeats(seatingChart, groupSize);
  const assignedSeatIds = new Set(allocationResult.assignedSeats.map((s) => s.seatId));

  const handleConfirmReservation = () => {
    if (!allocationResult.success) return;

    // Lock assigned seats in seating matrix
    setSeatingChart((prev) =>
      prev.map((row) => ({
        ...row,
        seats: row.seats.map((seat) =>
          assignedSeatIds.has(seat.seatId) ? { ...seat, isReserved: true, reservedByGroup: "Group RSVP" } : seat
        ),
      }))
    );

    if (onConfirmReservation) onConfirmReservation(allocationResult);

    setReservationNotice(
      `Successfully locked ${allocationResult.groupSize} seats for Group RSVP!`
    );
    setTimeout(() => setReservationNotice(null), 5000);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-purple-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-purple-950">
            <Armchair className="w-5 h-5 text-purple-700" />
            <span>Dynamic "Group RSVP" Seat Assignment — {eventTitle}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Contiguous seat matching engine. Algorithmically searches rows to seat friends together or provides logical split warnings before payment.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2.5 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <Users className="w-4 h-4 text-purple-600 shrink-0" />
          <label htmlFor="group-size-input" className="text-xs font-bold uppercase">
            Group Tickets:
          </label>
          <input
            id="group-size-input"
            type="number"
            min={1}
            max={10}
            value={groupSize}
            onChange={(e) => setGroupSize(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 px-2 py-1 border border-black rounded font-mono font-bold text-center text-xs bg-slate-50"
          />
        </div>
      </div>

      {/* Reservation Confirmation Notice Banner */}
      {reservationNotice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{reservationNotice}</span>
        </div>
      )}

      {/* Main Grid: Seating Chart Matrix & Allocation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Seating Chart Matrix Visualization */}
        <div className="lg:col-span-2 p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4 bg-slate-50">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Venue Seating Layout ({venueName})
            </h4>
            <span className="text-[11px] font-sans text-gray-500">Stage at Top</span>
          </div>

          {/* Simulated Stage Indicator */}
          <div className="w-full py-2 bg-black text-white text-center rounded text-[11px] font-bold uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            🎬 STAGE / PERFORMANCE AREA
          </div>

          {/* Interactive Seat Rows Grid */}
          <div className="p-4 border-2 border-black rounded-lg bg-white space-y-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {seatingChart.map((row) => (
              <div key={row.rowLabel} className="flex items-center gap-2">
                <span className="w-6 font-bold text-xs text-gray-700 text-center uppercase font-mono">
                  Row {row.rowLabel}
                </span>

                <div className="flex-1 flex items-center justify-start gap-1.5 flex-wrap">
                  {row.seats.map((seat) => {
                    const isAssigned = assignedSeatIds.has(seat.seatId);
                    return (
                      <div
                        key={seat.seatId}
                        className={cn(
                          "w-8 h-8 rounded border-2 border-black flex items-center justify-center text-[10px] font-bold font-mono transition-transform",
                          isAssigned
                            ? "bg-purple-600 text-white border-black scale-105 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            : seat.isReserved
                            ? "bg-slate-800 text-slate-400 cursor-not-allowed border-black"
                            : "bg-emerald-100 text-emerald-950 hover:bg-emerald-200 border-black"
                        )}
                        title={`Row ${seat.rowLabel} Seat ${seat.seatNumber} (${
                          isAssigned ? "Assigned for Group" : seat.isReserved ? "Occupied" : "Available"
                        })`}
                      >
                        {seat.seatNumber}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-sans pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded border border-black bg-emerald-100" />
              <span className="font-medium text-gray-700">Available Seat</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded border border-black bg-purple-600" />
              <span className="font-bold text-purple-900">Assigned for Group</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded border border-black bg-slate-800" />
              <span className="font-medium text-gray-500">Occupied</span>
            </div>
          </div>
        </div>

        {/* Dynamic Allocation Result Card */}
        <div className="lg:col-span-1 p-5 bg-white space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
              <Lock className="w-4 h-4 text-purple-600" />
              Algorithmic Allocation Result
            </h4>

            {allocationResult.success ? (
              <div className="space-y-3">
                {/* Contiguous or Split Status Alert */}
                {allocationResult.isContiguous ? (
                  <div className="p-3 bg-emerald-100 border-2 border-black rounded-lg text-xs font-bold text-emerald-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-mono text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Contiguous Seating Reserved
                    </div>
                    <p className="font-sans font-normal text-emerald-900">
                      All {allocationResult.groupSize} members sit together in a single row!
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-100 border-2 border-black rounded-lg text-xs text-amber-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold font-mono text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Split Seating Notice
                    </div>
                    <p className="font-sans text-[11px] leading-relaxed">
                      {allocationResult.warningMessage}
                    </p>
                  </div>
                )}

                {/* Assigned Seat List */}
                <div className="p-3 border-2 border-black rounded-lg bg-slate-50 space-y-2">
                  <span className="text-[11px] font-bold uppercase text-gray-600 block">
                    Assigned Tickets ({allocationResult.assignedSeats.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {allocationResult.assignedSeats.map((seat, sIdx) => (
                      <span
                        key={sIdx}
                        className="text-xs font-bold bg-purple-100 text-purple-950 border border-purple-400 px-2.5 py-1 rounded"
                      >
                        Row {seat.rowLabel} - Seat {seat.seatNumber}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-rose-100 border-2 border-black rounded-lg text-xs font-bold text-rose-950 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{allocationResult.warningMessage}</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            type="button"
            disabled={!allocationResult.success}
            onClick={handleConfirmReservation}
            className={cn(
              "w-full py-3 px-4 border-2 border-black font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2",
              allocationResult.success
                ? "bg-black text-white hover:bg-gray-800"
                : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
            )}
          >
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Lock & Confirm Group RSVP ({groupSize} Seats)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
