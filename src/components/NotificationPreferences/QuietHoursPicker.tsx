import type { QuietHoursConfig } from "@/hooks/useNotificationPreferences";

interface QuietHoursPickerProps {
  config: QuietHoursConfig;
  onChange: (update: Partial<QuietHoursConfig>) => void;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

const TIMEZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function getDurationLabel(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function QuietHoursPicker({ config, onChange }: QuietHoursPickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-display font-bold text-sm">Quiet Hours</h4>
          <p className="font-mono text-[10px] text-gray-500 mt-0.5">
            Silence non-critical notifications during these hours
          </p>
        </div>
        <button
          onClick={() => onChange({ enabled: !config.enabled })}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            config.enabled ? "bg-lime" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform ${
              config.enabled ? "translate-x-6" : ""
            }`}
          />
        </button>
      </div>

      {config.enabled && (
        <div className="space-y-3 pl-2 border-l-2 border-lime">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
                Start
              </label>
              <select
                value={config.start}
                onChange={(e) => onChange({ start: e.target.value })}
                className="w-full neu-border bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-cream"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {formatTime12h(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
                End
              </label>
              <select
                value={config.end}
                onChange={(e) => onChange({ end: e.target.value })}
                className="w-full neu-border bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-cream"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {formatTime12h(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />
            <span>
              {formatTime12h(config.start)} – {formatTime12h(config.end)}(
              {getDurationLabel(config.start, config.end)} per day)
            </span>
          </div>

          <div>
            <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
              Timezone
            </label>
            <select
              value={config.timezone}
              onChange={(e) => onChange({ timezone: e.target.value })}
              className="w-full neu-border bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-cream"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="font-mono text-[10px] text-yellow-800">
              <strong>Exception:</strong> Security alerts and emergency notifications will always be
              delivered regardless of quiet hours.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
