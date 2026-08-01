import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { endOfDay, format, startOfDay } from "date-fns";
import { CalendarIcon, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_PRESET_OPTIONS,
  getPresetDateRange,
  type AnalyticsDateRangeSelection,
  type AnalyticsRangePreset,
} from "@/lib/clubAnalyticsDateRange";

interface AnalyticsDateRangePickerProps {
  value: AnalyticsDateRangeSelection;
  onChange: (next: AnalyticsDateRangeSelection) => void;
}

export function AnalyticsDateRangePicker({ value, onChange }: AnalyticsDateRangePickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>({
    from: value.startDate,
    to: value.endDate,
  });

  useEffect(() => {
    setCalendarRange({ from: value.startDate, to: value.endDate });
  }, [value.endDate, value.startDate]);

  const selectedPresetLabel = useMemo(() => {
    if (value.preset === "custom") return "Custom";
    return (
      ANALYTICS_PRESET_OPTIONS.find((option) => option.value === value.preset)?.label ?? "Custom"
    );
  }, [value.preset]);

  const handlePresetClick = (preset: Exclude<AnalyticsRangePreset, "custom">) => {
    const nextRange = getPresetDateRange(preset);
    onChange({ preset, ...nextRange });
    setOpen(false);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setCalendarRange(range);
    if (!range?.from || !range.to) return;

    onChange({
      preset: "custom",
      startDate: startOfDay(range.from),
      endDate: endOfDay(range.to),
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full sm:w-auto justify-start text-left font-mono text-xs font-bold uppercase"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className={cn("mr-2", value.preset === "custom" && "text-black")}>
            {selectedPresetLabel}:
          </span>
          {format(value.startDate, "LLL dd, y")} – {format(value.endDate, "LLL dd, y")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-col sm:flex-row">
          <div className="border-b sm:border-b-0 sm:border-r border-black/20 p-2 sm:w-44">
            <div className="mb-2 flex items-center gap-2 px-2 py-1 font-mono text-[10px] font-bold uppercase text-gray-500">
              <Filter className="h-3.5 w-3.5" />
              Presets
            </div>
            <div className="space-y-1">
              {ANALYTICS_PRESET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePresetClick(option.value)}
                  className={cn(
                    "w-full border-2 border-transparent px-2 py-1.5 text-left font-mono text-xs font-bold uppercase transition-all",
                    value.preset === option.value
                      ? "border-black bg-lime text-black shadow-[2px_2px_0_0_#000]"
                      : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Calendar
            initialFocus
            mode="range"
            selected={calendarRange}
            defaultMonth={value.startDate}
            onSelect={handleCalendarSelect}
            numberOfMonths={isMobile ? 1 : 2}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
