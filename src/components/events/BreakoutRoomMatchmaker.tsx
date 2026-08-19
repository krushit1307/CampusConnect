import React, { useState } from "react";
import { Users, Sparkles, Download, Shuffle, Layers, CheckCircle2, UserCheck } from "lucide-react";
import {
  AttendeeProfile,
  BreakoutRoom,
  matchBreakoutRooms,
  exportZoomBreakoutCsv,
} from "@/lib/breakoutMatchmaker";
import { cn } from "@/lib/utils";

export interface BreakoutRoomMatchmakerProps {
  eventId?: string;
  eventName?: string;
  attendees?: AttendeeProfile[];
  onRoomsGenerated?: (rooms: BreakoutRoom[]) => void;
  className?: string;
}

export const MOCK_ACTIVE_ATTENDEES: AttendeeProfile[] = [
  {
    id: "att-1",
    name: "Alex Dev",
    email: "alex@campus.edu",
    major: "Computer Science",
    year: "Senior",
    interests: ["React", "AI", "TypeScript"],
  },
  {
    id: "att-2",
    name: "Sam Fullstack",
    email: "sam@campus.edu",
    major: "Computer Science",
    year: "Senior",
    interests: ["React", "Next.js", "TypeScript"],
  },
  {
    id: "att-3",
    name: "Jordan Quant",
    email: "jordan@campus.edu",
    major: "Finance",
    year: "Junior",
    interests: ["Fintech", "Crypto", "Python"],
  },
  {
    id: "att-4",
    name: "Taylor Banker",
    email: "taylor@campus.edu",
    major: "Finance",
    year: "Junior",
    interests: ["Fintech", "Investment Banking"],
  },
  {
    id: "att-5",
    name: "Morgan AI",
    email: "morgan@campus.edu",
    major: "Computer Science",
    year: "Senior",
    interests: ["AI", "Machine Learning", "Python"],
  },
  {
    id: "att-6",
    name: "Casey Analyst",
    email: "casey@campus.edu",
    major: "Finance",
    year: "Junior",
    interests: ["Crypto", "Equities", "Fintech"],
  },
];

export const BreakoutRoomMatchmaker: React.FC<BreakoutRoomMatchmakerProps> = ({
  eventId = "evt-virtual-1",
  eventName = "Virtual Networking Mixer 2026",
  attendees = MOCK_ACTIVE_ATTENDEES,
  onRoomsGenerated,
  className,
}) => {
  const [targetRoomSize, setTargetRoomSize] = useState<number>(3);
  const [rooms, setRooms] = useState<BreakoutRoom[]>(() =>
    matchBreakoutRooms(attendees, 3)
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleGenerateRooms = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const generated = matchBreakoutRooms(attendees, targetRoomSize);
      setRooms(generated);
      setIsGenerating(false);
      if (onRoomsGenerated) onRoomsGenerated(generated);
    }, 250);
  };

  const handleDownloadZoomCsv = () => {
    const csvContent = exportZoomBreakoutCsv(rooms);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `zoom_breakout_rooms_${eventId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-indigo-50 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-indigo-950">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>Breakout Room Matchmaker — {eventName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Algorithmic sub-group matching based on shared majors, graduation years, and interest tags.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white border-2 border-black px-3 py-1.5 rounded-md text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span>{attendees.length} Active Attendees</span>
        </div>
      </div>

      {/* Configuration & Action Bar (#3540) */}
      <div className="p-5 bg-white border-b-2 border-black flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label htmlFor="room-size-slider" className="text-xs font-bold uppercase whitespace-nowrap">
            Desired Room Size:
          </label>
          <input
            id="room-size-slider"
            type="range"
            min={2}
            max={Math.max(3, Math.min(10, attendees.length))}
            value={targetRoomSize}
            onChange={(e) => setTargetRoomSize(Number(e.target.value))}
            className="w-32 accent-indigo-600 cursor-pointer"
          />
          <span className="px-2.5 py-1 border-2 border-black bg-indigo-100 font-bold text-xs rounded">
            {targetRoomSize} people/room
          </span>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleGenerateRooms}
            disabled={isGenerating}
            className="px-4 py-2 border-2 border-black bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {isGenerating ? "Matching..." : "Generate Smart Breakouts"}
          </button>

          <button
            type="button"
            onClick={handleDownloadZoomCsv}
            disabled={rooms.length === 0}
            className="px-4 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Zoom CSV
          </button>
        </div>
      </div>

      {/* Generated Breakout Rooms Grid (#3540) */}
      <div className="p-5 bg-slate-50 space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-gray-700">
          <span className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            Matched Sub-Groups ({rooms.length} Rooms Generated)
          </span>
          <span className="text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Optimized for Networking Synergy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="border-2 border-black bg-white rounded-lg p-4 space-y-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex items-start justify-between gap-2 border-b border-gray-200 pb-2">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300">
                    Room #{room.roomNumber}
                  </span>
                  <h4 className="font-bold text-sm text-black mt-1">{room.roomName}</h4>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-400 text-emerald-900 font-bold text-[11px] rounded-full whitespace-nowrap">
                  {room.compatibilityScore}% Match
                </span>
              </div>

              {/* Common Tags */}
              {room.commonTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {room.commonTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-gray-100 border border-gray-300 text-gray-800 px-1.5 py-0.5 rounded font-mono"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Attendee Member Chips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-gray-600 block uppercase">
                  Assigned Attendees ({room.attendees.length}):
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {room.attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 p-1.5 rounded text-xs"
                    >
                      <span className="font-bold text-black">{attendee.name}</span>
                      <span className="text-[11px] text-gray-600 font-sans">
                        {attendee.major} • {attendee.year}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
