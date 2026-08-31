// =============================================================================
// Component: InteractiveSeatMap
// Issue: #3873 - Build an 'Interactive Seat Map' for Large Auditoriums
// Description: 2D interactive SVG seat selection grid for auditorium events with
// stage view, VIP section colors, selection toggle (turns green), and real-time double-booking protection.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  generateAuditoriumSeatNodes,
  getEventSeats,
  lockSeatTemporarily,
  DEFAULT_AUDITORIUM_CONFIG,
} from "@/services/interactiveSeatMapService";
import type { SeatMapConfig, SeatNode, EventSeat } from "@/types/database";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Crown from "lucide-react/dist/esm/icons/crown";

interface InteractiveSeatMapProps {
  eventId: string;
  userId?: string;
  config?: SeatMapConfig;
  onSeatSelected?: (seat: SeatNode) => void;
}

export function InteractiveSeatMap({
  eventId,
  userId = "user-current",
  config = DEFAULT_AUDITORIUM_CONFIG,
  onSeatSelected,
}: InteractiveSeatMapProps) {
  const [dbSeats, setDbSeats] = useState<EventSeat[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedSeatNode, setSelectedSeatNode] = useState<SeatNode | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState<boolean>(false);

  const fetchSeats = useCallback(async () => {
    if (!eventId) return;
    const data = await getEventSeats(eventId);
    setDbSeats(data);
  }, [eventId]);

  useEffect(() => {
    void fetchSeats();

    if (!eventId) return;
    const supabase = createClient();

    // Subscribe to Supabase Realtime event_seats table
    const channel = supabase
      .channel(`seats-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_seats", filter: `event_id=eq.${eventId}` },
        () => {
          void fetchSeats();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchSeats]);

  const seatNodes = generateAuditoriumSeatNodes(
    config,
    dbSeats,
    userId,
    selectedSeatId || undefined,
  );

  const handleSeatClick = async (seat: SeatNode) => {
    if (seat.status === "LOCKED" || seat.status === "RESERVED") {
      setLockError(`Seat ${seat.seat_label} is reserved or locked by another attendee.`);
      return;
    }

    setLockError(null);
    setIsLocking(true);

    // Lock seat temporarily (10 mins) to prevent double-booking
    const lockRes = await lockSeatTemporarily(
      eventId,
      seat.seat_id,
      seat.seat_label,
      seat.section,
      userId,
    );

    setIsLocking(false);

    if (lockRes.success) {
      setSelectedSeatId(seat.seat_id);
      const updatedNode: SeatNode = { ...seat, status: "SELECTED" };
      setSelectedSeatNode(updatedNode);

      if (onSeatSelected) {
        onSeatSelected(updatedNode);
      }
    } else {
      setLockError(lockRes.error || "Double-booking prevented. Please pick another seat.");
    }
  };

  const rowsList = Array.from(new Set(seatNodes.map((n) => n.row_label)));
  const aisleCols = config.aisle_cols || [4, 8];

  return (
    <div
      data-testid="interactive-seat-map-container"
      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-slate-100 my-6"
    >
      {/* AUDITORIUM STAGE BANNER */}
      <div className="w-full bg-gradient-to-b from-indigo-950 to-slate-950 border-b-4 border-indigo-500 rounded-2xl py-4 mb-8 text-center shadow-lg">
        <p className="text-xs md:text-sm font-black uppercase tracking-[0.3em] text-indigo-300">
          🎭 STAGE / PERFORMANCE AREA
        </p>
      </div>

      {/* SEAT LEGEND */}
      <div className="flex flex-wrap items-center justify-center gap-6 mb-8 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-lg bg-amber-500/30 border border-amber-400"></div>
          <span>VIP Section</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-lg bg-slate-700 border border-slate-600"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-lg bg-emerald-500 border border-emerald-400 shadow-md shadow-emerald-500/50"></div>
          <span className="text-emerald-400 font-bold">Selected (Turns Green)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-lg bg-red-950 border border-red-800"></div>
          <span className="text-red-400">Locked / Reserved</span>
        </div>
      </div>

      {lockError && (
        <div
          data-testid="seat-lock-error-banner"
          className="bg-red-950/50 border border-red-800 text-red-300 p-4 rounded-2xl mb-6 text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{lockError}</span>
        </div>
      )}

      {/* 2D AUDITORIUM GRID */}
      <div className="overflow-x-auto py-2">
        <div className="min-w-[640px] space-y-3">
          {rowsList.map((rowLabel) => {
            const rowSeats = seatNodes.filter((n) => n.row_label === rowLabel);
            const isVipRow = (config.vip_rows || ["A", "B"]).includes(rowLabel);

            return (
              <div key={rowLabel} className="flex items-center justify-center gap-2">
                {/* Row Label */}
                <div className="w-8 text-center text-xs font-black font-mono text-slate-400 flex items-center justify-center gap-1">
                  {isVipRow && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                  <span>{rowLabel}</span>
                </div>

                {/* Seat Buttons */}
                <div className="flex items-center gap-2">
                  {rowSeats.map((seat) => {
                    const isSelected =
                      selectedSeatId === seat.seat_id || seat.status === "SELECTED";
                    const isOccupied = seat.status === "LOCKED" || seat.status === "RESERVED";
                    const isAisleAfter = aisleCols.includes(seat.col_num);

                    let seatBg =
                      "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:scale-105";
                    if (seat.section === "VIP" && !isSelected && !isOccupied) {
                      seatBg =
                        "bg-amber-950/60 border-amber-500/60 text-amber-300 hover:bg-amber-900/80 hover:scale-105";
                    }
                    if (isSelected) {
                      seatBg =
                        "bg-emerald-500 border-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-500/50 scale-110";
                    } else if (isOccupied) {
                      seatBg =
                        "bg-red-950/80 border-red-900 text-red-500 opacity-60 cursor-not-allowed";
                    }

                    return (
                      <React.Fragment key={seat.seat_id}>
                        <button
                          type="button"
                          onClick={() => handleSeatClick(seat)}
                          disabled={isOccupied || isLocking}
                          data-testid={`seat-btn-${seat.seat_id}`}
                          title={`${seat.seat_label} (${seat.section}) - ${seat.status}`}
                          className={`w-9 h-9 rounded-xl border text-xs font-bold font-mono transition-all flex items-center justify-center ${seatBg}`}
                        >
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5 text-slate-950" />
                          ) : (
                            seat.col_num
                          )}
                        </button>
                        {isAisleAfter && <div className="w-6" />}
                      </React.Fragment>
                    );
                  })}
                </div>

                <div className="w-8 text-center text-xs font-black font-mono text-slate-400">
                  {rowLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SELECTED SEAT SUMMARY */}
      {selectedSeatNode && (
        <div
          data-testid="selected-seat-summary"
          className="mt-8 bg-emerald-950/60 border border-emerald-500/60 rounded-2xl p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500 text-slate-950 rounded-xl font-black">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-emerald-300 uppercase font-mono tracking-wider">
                Reserved Seat Assignment
              </p>
              <h4 className="text-lg font-black text-white">{selectedSeatNode.seat_label}</h4>
              <p className="text-xs text-slate-300 font-mono">
                Section: <strong className="text-amber-300">{selectedSeatNode.section}</strong>{" "}
                (Locked for checkout)
              </p>
            </div>
          </div>

          <span className="px-4 py-2 bg-emerald-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30">
            SEAT LOCKED
          </span>
        </div>
      )}
    </div>
  );
}
