import React, { useState } from "react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/dist/style.css"; // Pulls in the base calendar layout

export function DateRangePicker({ onDateChange }) {
  const [range, setRange] = useState();

  // Issue Requirement 5: Start Date cannot be in the past.
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Strip time so it only blocks yesterday and older

  const handleSelect = (selectedRange) => {
    setRange(selectedRange);

    // Issue Edge Case: Strip time data / use strict local-time strings
    if (selectedRange?.from && selectedRange?.to && onDateChange) {
      const formattedStart = format(selectedRange.from, "yyyy-MM-dd");
      const formattedEnd = format(selectedRange.to, "yyyy-MM-dd");

      // Sends the clean ISO string back to React Hook Form
      onDateChange({ start: formattedStart, end: formattedEnd });
    }
  };

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm w-max">
      <DayPicker
        mode="range"
        selected={range}
        onSelect={handleSelect}
        disabled={{ before: today }}

        // Issue Requirement 4: Specific CSS classes for selected, middle, and end days
        modifiersClassNames={{
          selected: "bg-blue-600 text-white font-bold",
          range_start: "rounded-l-md",
          range_end: "rounded-r-md",
          range_middle: "bg-blue-100 text-blue-900 rounded-none",
        }}
      />

      {/* Testing Requirement: Verify input value formats correctly */}
      <div className="mt-4 text-sm font-medium text-gray-700 text-center">
        {range?.from ? (
          range.to ? (
            <p>
              {format(range.from, "MMM dd, yyyy")} - {format(range.to, "MMM dd, yyyy")}
            </p>
          ) : (
            <p>{format(range.from, "MMM dd, yyyy")} - Pick an end date</p>
          )
        ) : (
          <p>Please select a start date.</p>
        )}
      </div>
    </div>
  );
}
