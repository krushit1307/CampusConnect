import { useState, useMemo } from "react";
import {
  type RecurrenceConfig,
  type DayOfWeek,
  type RecurrenceFrequency,
  buildRRule,
  getRecurrenceSummary,
  parseRRule,
} from "@/services/recurrenceService";
import { RotateCw, Calendar, X } from "lucide-react";

interface RecurrenceSelectorProps {
  startDate: string; // ISO datetime string
  value: string | null; // current RRULE string
  onChange: (rrule: string | null, config: RecurrenceConfig | null) => void;
}

const DAYS: { value: DayOfWeek; label: string; short: string }[] = [
  { value: "MO", label: "Monday", short: "Mon" },
  { value: "TU", label: "Tuesday", short: "Tue" },
  { value: "WE", label: "Wednesday", short: "Wed" },
  { value: "TH", label: "Thursday", short: "Thu" },
  { value: "FR", label: "Friday", short: "Fri" },
  { value: "SA", label: "Saturday", short: "Sat" },
  { value: "SU", label: "Sunday", short: "Sun" },
];

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
];

const INSTANCE_COUNTS = [4, 8, 12, 16, 24, 52];

/**
 * UI for selecting a recurring event pattern.
 * Outputs a valid RRULE string that can be stored on the parent event.
 */
export function RecurrenceSelector({ startDate, value, onChange }: RecurrenceSelectorProps) {
  const [enabled, setEnabled] = useState(!!value);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [instanceCount, setInstanceCount] = useState(12);

  const dtStart = useMemo(() => {
    if (!startDate) return new Date();
    const d = new Date(startDate);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [startDate]);

  // Auto-select the day of week from the start date
  const startDayOfWeek = useMemo(() => {
    const dayIndex = dtStart.getDay();
    const dayMap: DayOfWeek[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    return dayMap[dayIndex];
  }, [dtStart]);

  const config: RecurrenceConfig = useMemo(
    () => ({
      frequency,
      days:
        frequency === "weekly" || frequency === "biweekly"
          ? selectedDays.length > 0
            ? selectedDays
            : [startDayOfWeek]
          : undefined,
      interval: 1,
      count: instanceCount,
    }),
    [frequency, selectedDays, startDayOfWeek, instanceCount],
  );

  const rruleStr = useMemo(
    () => (enabled ? buildRRule(config, dtStart) : ""),
    [enabled, config, dtStart],
  );

  const summary = useMemo(() => (enabled ? getRecurrenceSummary(config) : ""), [enabled, config]);

  const previewDates = useMemo(() => {
    if (!enabled || !rruleStr) return [];
    return parseRRule(rruleStr, dtStart, Math.min(instanceCount, 6));
  }, [enabled, rruleStr, dtStart, instanceCount]);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (!next) {
      onChange(null, null);
    } else {
      const r = buildRRule(config, dtStart);
      onChange(r, config);
    }
  };

  const handleFrequencyChange = (freq: RecurrenceFrequency) => {
    setFrequency(freq);
    if (freq === "daily") setSelectedDays([]);
    if (enabled) {
      const newConfig = { ...config, frequency: freq };
      const r = buildRRule(newConfig, dtStart);
      onChange(r, newConfig);
    }
  };

  const handleDayToggle = (day: DayOfWeek) => {
    setSelectedDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      if (enabled) {
        const newConfig = { ...config, days: next.length > 0 ? next : [startDayOfWeek] };
        const r = buildRRule(newConfig, dtStart);
        onChange(r, newConfig);
      }
      return next;
    });
  };

  const handleCountChange = (count: number) => {
    setInstanceCount(count);
    if (enabled) {
      const newConfig = { ...config, count };
      const r = buildRRule(newConfig, dtStart);
      onChange(r, newConfig);
    }
  };

  return (
    <div className="neu-border bg-white p-4 space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCw size={16} className="text-purple-600" />
          <span className="font-mono text-xs font-bold uppercase">Recurring Event</span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            enabled ? "bg-black" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {!enabled && (
        <p className="font-mono text-[11px] text-gray-500">
          Enable to create multiple instances on a schedule (e.g. "Every Tuesday for 12 weeks").
        </p>
      )}

      {enabled && (
        <div className="space-y-4">
          {/* Frequency */}
          <div>
            <label className="font-mono text-[10px] font-bold uppercase text-gray-500 block mb-2">
              Frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => handleFrequencyChange(f.value)}
                  className={`neu-border px-3 py-2 font-mono text-xs font-bold transition-colors ${
                    frequency === f.value ? "bg-black text-white" : "bg-white hover:bg-gray-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day picker (weekly/biweekly only) */}
          {(frequency === "weekly" || frequency === "biweekly") && (
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-gray-500 block mb-2">
                On days
              </label>
              <div className="flex gap-1.5">
                {DAYS.map((d) => {
                  const isActive =
                    selectedDays.length > 0
                      ? selectedDays.includes(d.value)
                      : d.value === startDayOfWeek;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => handleDayToggle(d.value)}
                      className={`flex-1 py-2 font-mono text-[11px] font-bold transition-colors ${
                        isActive
                          ? "bg-lime border-2 border-black"
                          : "bg-white border-2 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Instance count */}
          <div>
            <label className="font-mono text-[10px] font-bold uppercase text-gray-500 block mb-2">
              Number of instances
            </label>
            <div className="flex flex-wrap gap-1.5">
              {INSTANCE_COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleCountChange(c)}
                  className={`px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
                    instanceCount === c
                      ? "bg-black text-white"
                      : "bg-white border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 p-3 border border-gray-200">
            <p className="font-mono text-xs font-bold text-gray-700">{summary}</p>
            <p className="font-mono text-[10px] text-gray-500 mt-1">{rruleStr}</p>
          </div>

          {/* Preview dates */}
          {previewDates.length > 0 && (
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-gray-500 flex items-center gap-1 mb-2">
                <Calendar size={10} /> Preview (first {previewDates.length})
              </label>
              <div className="grid grid-cols-2 gap-1">
                {previewDates.map((d, i) => (
                  <div
                    key={i}
                    className="bg-white border border-gray-200 px-2 py-1 font-mono text-[10px]"
                  >
                    {d.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clear button */}
          <button
            type="button"
            onClick={() => {
              setEnabled(false);
              onChange(null, null);
            }}
            className="flex items-center gap-1 font-mono text-[11px] text-red-600 hover:text-red-800"
          >
            <X size={12} /> Remove recurrence
          </button>
        </div>
      )}
    </div>
  );
}
