// =============================================================================
// Component: RealtimeCapacityHeatmap
// Issue: #3239 - Real-Time Capacity Heatmaps for Multi-Room Events
// Description: Organizer SVG multi-room venue heatmap subscribing to Supabase
// Realtime updates. Color-codes rooms from Light Blue to Red based on density
// and triggers over-capacity warnings at >= 95% capacity.
// =============================================================================

import React, { useState, useEffect } from "react";
import { createClient } from "../../lib/supabase/client";
import { EventRoom, fetchEventRooms, getHeatmapColor } from "../../services/roomCapacityService";
import { RoomCheckInKiosk } from "../kiosk/RoomCheckInKiosk";

interface RealtimeCapacityHeatmapProps {
  eventId: string;
  initialRooms?: EventRoom[];
}

const DEFAULT_ROOM_POLYGONS = [
  {
    room_name: "Room A (Grand Hall)",
    coords: "30,30 250,30 250,180 30,180",
    labelX: 140,
    labelY: 100,
  },
  {
    room_name: "Room B (Expo Suite)",
    coords: "270,30 500,30 500,180 270,180",
    labelX: 385,
    labelY: 100,
  },
  {
    room_name: "Room C (Tech Hub)",
    coords: "520,30 750,30 750,180 520,180",
    labelX: 635,
    labelY: 100,
  },
  {
    room_name: "Room D (Interview Hub)",
    coords: "30,210 380,210 380,360 30,360",
    labelX: 205,
    labelY: 285,
  },
  {
    room_name: "Room E (Sponsor Lounge)",
    coords: "400,210 750,210 750,360 400,360",
    labelX: 575,
    labelY: 285,
  },
];

export const RealtimeCapacityHeatmap: React.FC<RealtimeCapacityHeatmapProps> = ({
  eventId,
  initialRooms,
}) => {
  const [rooms, setRooms] = useState<EventRoom[]>(initialRooms || []);
  const [loading, setLoading] = useState(!initialRooms);
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");

  const loadRooms = async () => {
    const data = await fetchEventRooms(eventId);
    if (data.length > 0) {
      setRooms(data);
    } else {
      // Mock room fallback for demonstration if DB table is unpopulated
      setRooms([
        {
          id: "room-a",
          event_id: eventId,
          room_name: "Room A (Grand Hall)",
          max_capacity: 100,
          current_occupancy: 96,
          created_at: "",
          updated_at: "",
        },
        {
          id: "room-b",
          event_id: eventId,
          room_name: "Room B (Expo Suite)",
          max_capacity: 150,
          current_occupancy: 45,
          created_at: "",
          updated_at: "",
        },
        {
          id: "room-c",
          event_id: eventId,
          room_name: "Room C (Tech Hub)",
          max_capacity: 80,
          current_occupancy: 12,
          created_at: "",
          updated_at: "",
        },
        {
          id: "room-d",
          event_id: eventId,
          room_name: "Room D (Interview Hub)",
          max_capacity: 60,
          current_occupancy: 50,
          created_at: "",
          updated_at: "",
        },
        {
          id: "room-e",
          event_id: eventId,
          room_name: "Room E (Sponsor Lounge)",
          max_capacity: 120,
          current_occupancy: 80,
          created_at: "",
          updated_at: "",
        },
      ]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRooms();

    // Subscribe to Supabase Realtime channel on event_rooms table
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-room-capacity-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_rooms",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.new) {
            setRooms((prev) =>
              prev.map((r) =>
                r.id === (payload.new as EventRoom).id ? (payload.new as EventRoom) : r,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Check for any room violating 95% fire-code / capacity bottleneck threshold
  const overCapacityRooms = rooms.filter((r) => r.current_occupancy / r.max_capacity >= 0.95);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-800 max-w-6xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" /> Realtime Heatmap
            </span>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">
              Multi-Room Venue Occupancy
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time crowd flow awareness for organizers. Colors transition from light blue (empty)
            to red (at capacity).
          </p>
        </div>

        <button
          onClick={() => setIsKioskOpen(true)}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Open Door Scanner Kiosk
        </button>
      </div>

      {/* OVER-CAPACITY BOTTLENECK WARNING BANNER */}
      {overCapacityRooms.length > 0 && (
        <div className="mt-4 p-4 bg-rose-600 text-white rounded-xl shadow-lg border-2 border-rose-400 animate-pulse flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="w-8 h-8 shrink-0 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h4 className="text-base font-black uppercase tracking-wider">
                FIRE CODE / CAPACITY WARNING
              </h4>
              <p className="text-xs text-rose-100">
                The following room(s) crossed 95% capacity threshold:{" "}
                <strong>
                  {overCapacityRooms
                    .map((r) => `${r.room_name} (${r.current_occupancy}/${r.max_capacity})`)
                    .join(", ")}
                </strong>
                . Dispatch crowd control immediately!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SVG VENUE HEATMAP */}
      <div className="mt-6 bg-gray-950 p-6 rounded-2xl border border-gray-800 relative overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-500 animate-pulse font-mono text-sm">
            Loading realtime venue heatmap...
          </div>
        ) : (
          <svg
            viewBox="0 0 780 390"
            className="w-full h-auto select-none"
            aria-label="Multi-Room Venue Capacity Heatmap"
          >
            {/* Background Grid Lines */}
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="780" height="390" fill="url(#grid)" />

            {/* Room Polygons */}
            {DEFAULT_ROOM_POLYGONS.map((polygon, index) => {
              const matchedRoom = rooms[index] || {
                room_name: polygon.room_name,
                current_occupancy: 0,
                max_capacity: 100,
              };

              const fillColor = getHeatmapColor(
                matchedRoom.current_occupancy,
                matchedRoom.max_capacity,
              );
              const percentage = Math.round(
                (matchedRoom.current_occupancy / matchedRoom.max_capacity) * 100,
              );
              const isOver95 = percentage >= 95;

              return (
                <g
                  key={polygon.room_name}
                  onClick={() => {
                    if (rooms[index]) setSelectedRoomId(rooms[index].id);
                    setIsKioskOpen(true);
                  }}
                  className="cursor-pointer group"
                >
                  <polygon
                    points={polygon.coords}
                    fill={fillColor}
                    fillOpacity={isOver95 ? "0.9" : "0.75"}
                    stroke={isOver95 ? "#ef4444" : "#475569"}
                    strokeWidth={isOver95 ? "4" : "2"}
                    className="transition-all duration-300 group-hover:fill-opacity-100 group-hover:scale-[1.01]"
                  />
                  <text
                    x={polygon.labelX}
                    y={polygon.labelY - 10}
                    textAnchor="middle"
                    className="fill-gray-900 font-extrabold text-xs pointer-events-none"
                  >
                    {matchedRoom.room_name}
                  </text>
                  <text
                    x={polygon.labelX}
                    y={polygon.labelY + 12}
                    textAnchor="middle"
                    className="fill-gray-900 font-mono text-[11px] font-bold pointer-events-none"
                  >
                    {matchedRoom.current_occupancy} / {matchedRoom.max_capacity} ({percentage}%)
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Heatmap Density Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-4 border-t border-gray-800 text-xs font-mono text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-[#e0f2fe] border border-blue-300" />
            <span>&lt; 25% (Empty)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-[#3b82f6] border border-blue-600" />
            <span>25% - 50% (Low)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-[#f59e0b] border border-amber-600" />
            <span>50% - 75% (Moderate)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-[#f97316] border border-orange-600" />
            <span>75% - 94% (Dense)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-[#ef4444] border border-rose-600 animate-pulse" />
            <span className="text-rose-400 font-bold">&gt;= 95% (BOTTLENECK WARNING)</span>
          </div>
        </div>
      </div>

      {/* Door Scanner Kiosk Modal */}
      {isKioskOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-xl w-full">
            <button
              onClick={() => setIsKioskOpen(false)}
              className="absolute -top-10 right-0 text-white font-black text-2xl hover:text-gray-300"
            >
              &times; Close Kiosk
            </button>
            <RoomCheckInKiosk
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              onOccupancyChange={loadRooms}
            />
          </div>
        </div>
      )}
    </div>
  );
};
