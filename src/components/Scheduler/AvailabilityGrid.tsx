import React, { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface AvailabilityGridProps {
  // A set of strings representing "day_of_week-slot_index" that are BUSY
  busySlots: Set<string>;
  onSlotToggle: (dayOfWeek: number, slotIndex: number, isBusy: boolean) => void;
  readOnly?: boolean;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const START_HOUR = 8; // 8:00 AM
const END_HOUR = 22; // 10:00 PM
const SLOTS_PER_DAY = (END_HOUR - START_HOUR) * 2; // 28 half-hour slots

export function AvailabilityGrid({
  busySlots,
  onSlotToggle,
  readOnly = false,
}: AvailabilityGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"markBusy" | "markFree" | null>(null);

  const handleMouseDown = (day: number, slot: number, currentlyBusy: boolean) => {
    if (readOnly) return;
    setIsDragging(true);
    const newMode = currentlyBusy ? "markFree" : "markBusy";
    setDragMode(newMode);
    onSlotToggle(day, slot, newMode === "markBusy");
  };

  const handleMouseEnter = (day: number, slot: number) => {
    if (readOnly || !isDragging || !dragMode) return;
    onSlotToggle(day, slot, dragMode === "markBusy");
  };

  const handleMouseUp = () => {
    if (readOnly) return;
    setIsDragging(false);
    setDragMode(null);
  };

  // Generate time labels
  const timeLabels = Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
    const hour = START_HOUR + i;
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${ampm}`;
  });

  return (
    <div
      className="select-none overflow-x-auto"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="min-w-[600px] grid grid-cols-[80px_repeat(7,1fr)] gap-1">
        {/* Header Row */}
        <div className="h-8"></div>
        {DAYS.map((day) => (
          <div key={day} className="text-center font-medium text-sm text-gray-500 h-8">
            {day}
          </div>
        ))}

        {/* Time Grid */}
        <div className="col-span-8 grid grid-cols-[80px_repeat(7,1fr)] gap-1 relative">
          {/* Time Labels Column */}
          <div className="flex flex-col gap-1">
            {timeLabels.map((time, idx) => (
              <div
                key={time}
                className="text-xs text-gray-400 text-right pr-2 h-12 flex items-start -mt-2"
                style={{ height: idx === timeLabels.length - 1 ? "1px" : "48px" }} // Last label doesn't need full height
              >
                {time}
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {Array.from({ length: 7 }).map((_, dayIndex) => (
            <div key={dayIndex} className="flex flex-col gap-[2px]">
              {Array.from({ length: SLOTS_PER_DAY }).map((_, slotIndex) => {
                const key = `${dayIndex}-${slotIndex}`;
                const isBusy = busySlots.has(key);

                // Add a slightly thicker border every two slots (on the hour)
                const isHourStart = slotIndex % 2 === 0;

                return (
                  <div
                    key={slotIndex}
                    onMouseDown={() => handleMouseDown(dayIndex, slotIndex, isBusy)}
                    onMouseEnter={() => handleMouseEnter(dayIndex, slotIndex)}
                    className={cn(
                      "h-[22px] w-full rounded-sm cursor-pointer transition-colors border",
                      isHourStart
                        ? "border-t-gray-200 dark:border-t-gray-800"
                        : "border-t-transparent",
                      isBusy
                        ? "bg-red-100 hover:bg-red-200 border-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:border-red-900/50"
                        : "bg-green-100 hover:bg-green-200 border-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:border-green-900/50",
                      readOnly && "cursor-default hover:bg-inherit", // Remove hover effect if readonly
                    )}
                    title={`${DAYS[dayIndex]} ${START_HOUR + Math.floor(slotIndex / 2)}:${slotIndex % 2 === 0 ? "00" : "30"} - ${isBusy ? "Busy" : "Free"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {!readOnly && (
        <p className="text-xs text-gray-500 mt-4 text-center">
          Click and drag to mark your schedule. Green means Free, Red means Busy.
        </p>
      )}
    </div>
  );
}
