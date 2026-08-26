import { areIntervalsOverlapping } from "date-fns";

// Defining a quick type based on your Supabase schema
export type TimeInterval = {
  id: string;
  start_time: string; // ISO String from the DB
  end_time: string; // ISO String from the DB
};

export const hasTemporalConflict = (
  newSession: TimeInterval,
  existingBookmarks: TimeInterval[],
): boolean => {
  const newInterval = {
    start: new Date(newSession.start_time),
    end: new Date(newSession.end_time),
  };

  return existingBookmarks.some((existingSession) => {
    const existingInterval = {
      start: new Date(existingSession.start_time),
      end: new Date(existingSession.end_time),
    };

    // inclusive: false ensures that back-to-back sessions
    // (e.g., 10:00-11:00 and 11:00-12:00) do NOT trigger a conflict.
    return areIntervalsOverlapping(newInterval, existingInterval, { inclusive: false });
  });
};
