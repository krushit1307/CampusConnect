import { useState, useEffect } from "react";
import { formatRelativeTime } from "@/utils/dateUtils";

/**
 * Calculates the exact delay in milliseconds until the next relative time threshold transition (#1750).
 * Prevents battery drain and CPU spikes by scheduling ONLY 1 timeout tailored to the exact threshold.
 * Returns `null` for dates older than 24 hours as they won't transition today.
 */
export function getNextRelativeUpdateDelay(dateInput: Date | string | number | null | undefined): number | null {
  if (!dateInput) return null;

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return null;

  const diffInSeconds = Math.max(0, (Date.now() - date.getTime()) / 1000);

  // Less than 1 minute ("Just now" or "X seconds ago") -> update at 60s mark
  if (diffInSeconds < 60) {
    return Math.max(1000, Math.ceil((60 - diffInSeconds) * 1000));
  }

  // Less than 1 hour ("X minutes ago") -> update every 60 seconds at minute boundary
  if (diffInSeconds < 3600) {
    const remainingSeconds = 60 - (diffInSeconds % 60);
    return Math.max(1000, Math.ceil(remainingSeconds * 1000));
  }

  // Less than 24 hours ("X hours ago") -> update every hour at hour boundary
  if (diffInSeconds < 86400) {
    const remainingSeconds = 3600 - (diffInSeconds % 3600);
    return Math.max(1000, Math.ceil(remainingSeconds * 1000));
  }

  // Older than 24 hours -> No timer needed
  return null;
}

/**
 * Custom React hook for auto-updating relative timestamps (#1750).
 * Efficiently schedules next threshold timeout without unnecessary continuous re-renders.
 */
export function useRelativeTime(dateInput: Date | string | number | null | undefined): string {
  const [formatted, setFormatted] = useState<string>(() => formatRelativeTime(dateInput));

  useEffect(() => {
    setFormatted(formatRelativeTime(dateInput));

    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextUpdate = () => {
      const delay = getNextRelativeUpdateDelay(dateInput);
      if (delay === null) return;

      timerId = setTimeout(() => {
        setFormatted(formatRelativeTime(dateInput));
        scheduleNextUpdate();
      }, delay);
    };

    scheduleNextUpdate();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [dateInput]);

  return formatted;
}
