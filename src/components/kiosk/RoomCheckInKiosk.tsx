// =============================================================================
// Component: RoomCheckInKiosk
// Issue: #3239 - Real-Time Capacity Heatmaps for Multi-Room Events
// Description: Door scanner kiosk component configured for room entry/exit
// with Check-In (+1) / Check-Out (-1) toggling and manual headcount calibration.
// =============================================================================

import React, { useState } from "react";
import {
  EventRoom,
  updateRoomOccupancy,
  calibrateRoomOccupancy,
} from "../../services/roomCapacityService";

interface RoomCheckInKioskProps {
  rooms: EventRoom[];
  selectedRoomId?: string;
  onRoomSelect?: (roomId: string) => void;
  onOccupancyChange?: () => void;
}

export const RoomCheckInKiosk: React.FC<RoomCheckInKioskProps> = ({
  rooms = [],
  selectedRoomId,
  onRoomSelect,
  onOccupancyChange,
}) => {
  const [activeRoomId, setActiveRoomId] = useState<string>(selectedRoomId || (rooms[0]?.id ?? ""));
  const [mode, setMode] = useState<"check_in" | "check_out">("check_in");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calibration Modal State
  const [isCalibrateOpen, setIsCalibrateOpen] = useState(false);
  const [manualCount, setManualCount] = useState<number>(0);
  const [calibrating, setCalibrating] = useState(false);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0];

  const handleRoomChange = (id: string) => {
    setActiveRoomId(id);
    if (onRoomSelect) onRoomSelect(id);
  };

  const handleScanAction = async (deltaOverride?: number) => {
    if (!activeRoom) {
      setErrorMessage("Please select a room for kiosk entry/exit scanning.");
      return;
    }

    const delta = deltaOverride ?? (mode === "check_in" ? 1 : -1);
    setLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    const res = await updateRoomOccupancy(activeRoom.id, delta);
    setLoading(false);

    if (res.success) {
      const actionText = delta > 0 ? "Entry (+1)" : "Exit (-1)";
      setStatusMessage(
        `${actionText} recorded for ${res.room_name}. Current Occupancy: ${res.current_occupancy}/${res.max_capacity}`,
      );
      if (onOccupancyChange) onOccupancyChange();
    } else {
      setErrorMessage(res.error || "Failed to update room occupancy.");
    }
  };

  const handleCalibrateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;

    setCalibrating(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const res = await calibrateRoomOccupancy(activeRoom.id, manualCount);
    setCalibrating(false);

    if (res.success) {
      setStatusMessage(
        `Room headcount calibrated to ${res.current_occupancy} for ${res.room_name}.`,
      );
      setIsCalibrateOpen(false);
      if (onOccupancyChange) onOccupancyChange();
    } else {
      setErrorMessage(res.error || "Failed to calibrate room count.");
    }
  };

  return (
    <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-2xl border border-gray-800 max-w-xl mx-auto">
      {/* Kiosk Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-800">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
            Door Kiosk Mode
          </span>
          <h3 className="text-xl font-black text-white mt-1">Multi-Room Scanner Terminal</h3>
        </div>

        <button
          onClick={() => {
            setManualCount(activeRoom?.current_occupancy || 0);
            setIsCalibrateOpen(true);
          }}
          className="px-3 py-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
            />
          </svg>
          Calibrate Count
        </button>
      </div>

      {/* Room Selector */}
      <div className="mt-4">
        <label className="block text-xs font-bold text-gray-400 mb-1">Select Scanning Room</label>
        <select
          value={activeRoomId}
          onChange={(e) => handleRoomChange(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white font-medium"
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.room_name} ({r.current_occupancy} / {r.max_capacity} Occupied)
            </option>
          ))}
        </select>
      </div>

      {/* Mode Toggle (Check-IN vs Check-OUT) */}
      <div className="mt-5 grid grid-cols-2 gap-2 p-1.5 bg-gray-800/80 rounded-xl border border-gray-700">
        <button
          onClick={() => setMode("check_in")}
          className={`py-3 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
            mode === "check_in"
              ? "bg-emerald-600 text-white shadow-lg"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <span>ENTRY / CHECK-IN (+1)</span>
        </button>
        <button
          onClick={() => setMode("check_out")}
          className={`py-3 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
            mode === "check_out"
              ? "bg-rose-600 text-white shadow-lg"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <span>EXIT / CHECK-OUT (-1)</span>
        </button>
      </div>

      {/* Manual Trigger Buttons for Testing / Volunteer Simulation */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => handleScanAction(mode === "check_in" ? 1 : -1)}
          disabled={loading}
          className={`flex-1 py-4 text-lg font-black rounded-xl shadow-xl transition transform active:scale-95 disabled:opacity-50 ${
            mode === "check_in"
              ? "bg-emerald-500 hover:bg-emerald-600 text-gray-950"
              : "bg-rose-500 hover:bg-rose-600 text-white"
          }`}
        >
          {loading
            ? "RECORDING..."
            : mode === "check_in"
              ? "TAP TO SCAN ENTRY (+1)"
              : "TAP TO SCAN EXIT (-1)"}
        </button>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div className="mt-4 p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs text-center font-medium">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs text-center font-medium">
          {errorMessage}
        </div>
      )}

      {/* Calibrate Count Modal */}
      {isCalibrateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h4 className="text-lg font-bold text-white mb-1">Calibrate Room Count</h4>
            <p className="text-xs text-gray-400 mb-4">
              Override database count for{" "}
              <strong className="text-white">{activeRoom?.room_name}</strong> if attendees did not
              check out voluntarily.
            </p>

            <form onSubmit={handleCalibrateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Actual Physical Headcount
                </label>
                <input
                  type="number"
                  min="0"
                  value={manualCount}
                  onChange={(e) => setManualCount(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCalibrateOpen(false)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={calibrating}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {calibrating ? "Saving..." : "Set Count"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
