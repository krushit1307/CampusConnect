import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { WidgetShell } from "./WidgetShell";

export interface CountdownWidgetProps {
  params: Record<string, unknown>;
}

function strParam(params: Record<string, unknown>, key: string): string {
  return typeof params[key] === "string" ? (params[key] as string) : "";
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function getTimeLeft(target: string): TimeLeft | null {
  const targetDate = new Date(target);
  if (Number.isNaN(targetDate.getTime())) return null;

  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

/** Live countdown to a configured target date. */
export function CountdownWidget({ params }: CountdownWidgetProps) {
  const target = strParam(params, "target");
  const title = strParam(params, "title") || "Countdown";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeLeft = getTimeLeft(target);

  if (!timeLeft) {
    return (
      <WidgetShell title={title} icon={<Timer size={16} aria-hidden="true" />}>
        <p className="font-mono text-xs text-gray-500">No target date configured.</p>
      </WidgetShell>
    );
  }

  const isDone = new Date(target).getTime() <= now;

  if (isDone) {
    return (
      <WidgetShell title={title} icon={<Timer size={16} aria-hidden="true" />}>
        <p className="font-display text-2xl font-bold uppercase text-[var(--theme-primary)]">
          Time&apos;s up!
        </p>
      </WidgetShell>
    );
  }

  const units: { label: string; value: number }[] = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Mins", value: timeLeft.minutes },
    { label: "Secs", value: timeLeft.seconds },
  ];

  return (
    <WidgetShell title={title} icon={<Timer size={16} aria-hidden="true" />}>
      <div className="grid grid-cols-4 gap-2">
        {units.map((unit) => (
          <div
            key={unit.label}
            className="neu-border flex flex-col items-center bg-cream px-2 py-3 dark:bg-zinc-800"
          >
            <span className="font-display text-2xl font-bold tabular-nums">
              {String(unit.value).padStart(2, "0")}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {unit.label}
            </span>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export default CountdownWidget;
