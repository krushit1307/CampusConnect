import { endOfDay, endOfWeek, startOfDay, startOfWeek, startOfYear, subDays } from "date-fns";

export type AnalyticsRangePreset =
  "today" | "this-week" | "last-30-days" | "this-semester" | "year-to-date" | "custom";

export interface AnalyticsDateRangeSelection {
  preset: AnalyticsRangePreset;
  startDate: Date;
  endDate: Date;
}

export interface AnalyticsPresetOption {
  label: string;
  value: Exclude<AnalyticsRangePreset, "custom">;
}

export const ANALYTICS_PRESET_OPTIONS: AnalyticsPresetOption[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "this-week" },
  { label: "Last 30 Days", value: "last-30-days" },
  { label: "This Semester", value: "this-semester" },
  { label: "Year to Date", value: "year-to-date" },
];

export function getPresetDateRange(
  preset: Exclude<AnalyticsRangePreset, "custom">,
  now = new Date(),
): Pick<AnalyticsDateRangeSelection, "startDate" | "endDate"> {
  const endDate = endOfDay(now);

  if (preset === "today") {
    return { startDate: startOfDay(now), endDate };
  }

  if (preset === "this-week") {
    return {
      startDate: startOfWeek(now, { weekStartsOn: 1 }),
      endDate: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }

  if (preset === "this-semester") {
    const semesterStartMonth = now.getMonth() < 6 ? 0 : 6;
    return {
      startDate: startOfDay(new Date(now.getFullYear(), semesterStartMonth, 1)),
      endDate,
    };
  }

  if (preset === "year-to-date") {
    return {
      startDate: startOfYear(now),
      endDate,
    };
  }

  return {
    startDate: startOfDay(subDays(now, 29)),
    endDate,
  };
}
