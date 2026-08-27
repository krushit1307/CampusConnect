// =============================================================================
// Component: SeatingChartBuilder
// Issue: #2730 - Implement a Graphical 'Seating Chart' Builder for Gala Events
// Description: The main layout for the seating chart designer. Includes a
// toolbox for adding tables, a sidebar for unassigned RSVPs, and the
// interactive canvas area.
// =============================================================================

import React, { useState } from "react";
import { useSeatingChart } from "../../hooks/useSeatingChart";
import { SeatingCanvas } from "./SeatingCanvas";

interface SeatingChartBuilderProps {
  eventId: string;
  eventName: string;
}

export const SeatingChartBuilder: React.FC<SeatingChartBuilderProps> = ({ eventId, eventName }) => {
  const {
    canvasState,
    isLoading,
    isSaving,
    error,
    addTable,
    deleteTable,
    moveTable,
    assignSeat,
    saveChart,
    unassignedRSVPs,
  } = useSeatingChart(eventId);

  const [draggedRsvp, setDraggedRsvp] = useState<{ id: string; name: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    const success = await saveChart();
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleDragStart = (e: React.DragEvent, rsvp: { id: string; full_name: string }) => {
    setDraggedRsvp({ id: rsvp.id, name: rsvp.full_name });
    e.dataTransfer.setData("text/plain", rsvp.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedRsvp(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] bg-gray-50 dark:bg-gray-900">
      {/* Top Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Seating Chart: {eventName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Drag tables to position them. Drag attendees from the sidebar onto chairs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <span className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</span>
          )}
          {saveSuccess && (
            <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Saved Successfully
            </span>
          )}
          <button
            onClick={() => addTable("round")}
            className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
            </svg>
            Add Round Table
          </button>
          <button
            onClick={() => addTable("rectangle")}
            className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="2" />
            </svg>
            Add Rectangle
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                Save Layout
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-gray-800">
          <SeatingCanvas
            tables={canvasState.tables}
            onMoveTable={moveTable}
            onDeleteTable={deleteTable}
            onAssignSeat={assignSeat}
            draggedRsvp={draggedRsvp}
          />
        </div>

        {/* Right Sidebar: Unassigned Attendees */}
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Unassigned Attendees
              <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {unassignedRSVPs.length}
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Drag and drop attendees onto the chairs in the canvas.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {unassignedRSVPs.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                All attendees have been assigned seats!
              </div>
            ) : (
              unassignedRSVPs.map((rsvp) => (
                <div
                  key={rsvp.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, rsvp)}
                  onDragEnd={handleDragEnd}
                  className="p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                    {rsvp.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {rsvp.full_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Drag to assign
                    </p>
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-400 dark:text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8h16M4 16h16"
                    />
                  </svg>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
