import * as React from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/dist/style.css";

// This interface fixes the TypeScript Build and Lint errors!
interface DatePickerRangeProps {
  onDateChange?: (dates: { start: string; end: string }) => void;
}

export function DatePickerRange({ onDateChange }: DatePickerRangeProps) {
  const [range, setRange] = React.useState<DateRange | undefined>();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleSelect = (selectedRange: DateRange | undefined) => {
    setRange(selectedRange);

    // This fixes the CodeRabbit AI bug! It now syncs incomplete ranges.
    if (onDateChange) {
      const formattedStart = selectedRange?.from ? format(selectedRange.from, "yyyy-MM-dd") : "";
      const formattedEnd = selectedRange?.to ? format(selectedRange.to, "yyyy-MM-dd") : "";

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
        modifiersClassNames={{
          selected: "bg-blue-600 text-white font-bold",
          range_start: "rounded-l-md",
          range_end: "rounded-r-md",
          range_middle: "bg-blue-100 text-blue-900 rounded-none",
        }}
      />

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
