/**
 * src/hooks/useEventDualClock.ts
 * Issue #3680 — Dynamic "Multi-Campus" Timezone Converter.
 *
 * React hook that wraps `formatDualClockEventTime` and re-renders the
 * component when:
 *   - the event payload changes (new data from Supabase),
 *   - the browser tab regains focus (so DST transitions during the
 *     tab being backgrounded are reflected),
 *   - the user crosses a timezone boundary (rare, but possible on
 *     laptops during travel).
 */

import { useEffect, useMemo, useState } from "react";
import {
  formatDualClockEventTime,
  getUserTimeZone,
  type DualClockEventTime,
} from "@/lib/timezone";
import { resolveVenueTimezone, type TimezoneAwareEvent } from "@/lib/venueTimezone";

export interface UseEventDualClockResult {
  data: DualClockEventTime | null;
  userTimeZone: string;
  venueTimeZone: string;
  isReady: boolean;
}

export function useEventDualClock(
  event: TimezoneAwareEvent | null | undefined,
): UseEventDualClockResult {
  const [userTimeZone, setUserTimeZone] = useState<string>(() => getUserTimeZone());

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        const fresh = getUserTimeZone();
        setUserTimeZone((prev) => (prev !== fresh ? fresh : prev));
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
    };
  }, []);

  const venueTimeZone = useMemo(
    () => (event ? resolveVenueTimezone(event) : "UTC"),
    [event],
  );

  const data = useMemo<DualClockEventTime | null>(() => {
    if (!event) return null;
    return formatDualClockEventTime(
      { ...event, venue_timezone: event.venue_timezone ?? venueTimeZone },
      userTimeZone,
    );
  }, [event, userTimeZone, venueTimeZone]);

  return { data, userTimeZone, venueTimeZone, isReady: data !== null };
}
