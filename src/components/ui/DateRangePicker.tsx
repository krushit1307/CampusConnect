import * as React from "react";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import type { DateRange } from "react-day-picker";
import format from "date-fns/format";
import subDays from "date-fns/subDays";
import startOfDay from "date-fns/startOfDay";
import endOfDay from "date-fns/endOfDay";
import startOfWeek from "date-fns/startOfWeek";
import endOfWeek from "date-fns/endOfWeek";
import startOfYear from "date-fns/startOfYear";
import isSameDay from "date-fns/isSameDay";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

export interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();

  const getSemesterRange = () => {
    const today = new Date();
    const month = today.getMonth(); // 0-11
    const year = today.getFullYear();

    if (month >= 7 && month <= 11) {
      // Fall Semester: Aug 1 - Dec 31
      return {
        from: startOfDay(new Date(year, 7, 1)),
        to: endOfDay(new Date(year, 11, 31)),
      };
    } else if (month >= 0 && month <= 4) {
      // Spring Semester: Jan 1 - May 31
      return {
        from: startOfDay(new Date(year, 0, 1)),
        to: endOfDay(new Date(year, 4, 31)),
      };
    } else {
      // Summer Semester: Jun 1 - Jul 31
      return {
        from: startOfDay(new Date(year, 5, 1)),
        to: endOfDay(new Date(year, 6, 31)),
      };
    }
  };

  const presets = React.useMemo(() => {
    const today = new Date();
    return [
      {
        label: "Today",
        getValue: () => ({
          from: startOfDay(today),
          to: endOfDay(today),
        }),
      },
      {
        label: "This Week",
        getValue: () => ({
          from: startOfWeek(today, { weekStartsOn: 1 }),
          to: endOfWeek(today, { weekStartsOn: 1 }),
        }),
      },
      {
        label: "Last 30 Days",
        getValue: () => ({
          from: startOfDay(subDays(today, 29)),
          to: endOfDay(today),
        }),
      },
      {
        label: "This Semester",
        getValue: () => getSemesterRange(),
      },
      {
        label: "Year to Date",
        getValue: () => ({
          from: startOfDay(startOfYear(today)),
          to: endOfDay(today),
        }),
      },
    ];
  }, []);

  const handlePresetClick = (presetRange: DateRange) => {
    onChange(presetRange);
    setOpen(false);
  };

  const isPresetSelected = (preset: (typeof presets)[number]) => {
    if (!value?.from || !value?.to) return false;
    const presetRange = preset.getValue();
    return isSameDay(value.from, presetRange.from) && isSameDay(value.to, presetRange.to);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-[300px] justify-start text-left font-mono text-xs font-bold uppercase neu-border neu-press cursor-pointer bg-white text-black",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "LLL dd, yyyy")} - {format(value.to, "LLL dd, yyyy")}
                </>
              ) : (
                format(value.from, "LLL dd, yyyy")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 border-2 border-black bg-white rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] z-50"
          align="start"
        >
          <div className={cn("flex", isMobile ? "flex-col" : "flex-row")}>
            {/* Presets Sidebar */}
            <div
              className={cn(
                "flex flex-col gap-2 p-3 bg-cream border-black",
                isMobile
                  ? "border-b-2 flex-row flex-wrap justify-center w-full"
                  : "border-r-2 w-44",
              )}
            >
              {presets.map((preset) => {
                const selected = isPresetSelected(preset);
                return (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset.getValue())}
                    className={cn(
                      "px-3 py-1.5 text-left text-xs font-bold font-mono uppercase border-2 border-black transition-all cursor-pointer w-full text-center sm:text-left",
                      selected
                        ? "bg-black text-cream border-black"
                        : "bg-white text-black hover:bg-black/5 border-black",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            {/* Calendar Selector */}
            <div className="p-3">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={value?.from}
                selected={value}
                onSelect={onChange}
                numberOfMonths={isMobile ? 1 : 2}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
