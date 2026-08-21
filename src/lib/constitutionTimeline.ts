// src/lib/constitutionTimeline.ts
// -----------------------------------------------------------------------------
// Issue #3690 — Interactive "Club Constitution" Version Timeline
//
// TypeScript types + pure helpers for the constitution timeline UI.
// Kept framework-agnostic (no React, no Supabase imports) so it can be
// unit-tested in isolation and reused by both the slider component and
// the diff modal.
// -----------------------------------------------------------------------------

export interface ArchivedConstitution {
  id: string;
  version_number: number;
  raw_text: string;
  file_url: string | null;
  published_by: string | null;
  change_summary: string | null;
  effective_from: string; // ISO timestamp
  effective_to: string | null; // ISO timestamp, null = still current
  created_at: string; // ISO timestamp
  is_current: boolean;
}

export interface TimelineStop {
  key: string;
  version: ArchivedConstitution;
  yearLabel: string;
  shortDateLabel: string;
  position: number; // 0..1, where 0 = oldest, 1 = newest
}

/**
 * Normalizes a list of archived versions into timeline stops with
 * computed positions. The oldest version sits at position 0, the
 * newest at position 1; intermediate stops are distributed by their
 * `effective_from` timestamps so the slider's visual spacing reflects
 * how much time passed between versions.
 */
export function buildTimelineStops(
  versions: ArchivedConstitution[],
): TimelineStop[] {
  if (versions.length === 0) return [];

  const sorted = [...versions].sort(
    (a, b) =>
      new Date(a.effective_from).getTime() -
      new Date(b.effective_from).getTime(),
  );

  const oldestMs = new Date(sorted[0].effective_from).getTime();
  const newestMs = new Date(
    sorted[sorted.length - 1].effective_from,
  ).getTime();
  const spanMs = Math.max(1, newestMs - oldestMs); // guard /0

  return sorted.map((version, idx) => {
    const ts = new Date(version.effective_from).getTime();
    const position = sorted.length === 1 ? 1 : (ts - oldestMs) / spanMs;
    const ordinalPosition =
      sorted.length === 1 ? 1 : idx / (sorted.length - 1);
    const finalPosition =
      Number.isFinite(position) && position > 0 ? position : ordinalPosition;

    return {
      key: `${version.version_number}-${version.id.slice(0, 8)}`,
      version,
      yearLabel: formatYear(version.effective_from),
      shortDateLabel: formatShortDate(version.effective_from),
      position: finalPosition,
    };
  });
}

export function nearestStopForPosition(
  stops: TimelineStop[],
  position: number,
): TimelineStop | null {
  if (stops.length === 0) return null;
  let best = stops[0];
  let bestDist = Math.abs(stops[0].position - position);
  for (let i = 1; i < stops.length; i++) {
    const dist = Math.abs(stops[i].position - position);
    if (dist < bestDist) {
      best = stops[i];
      bestDist = dist;
    }
  }
  return best;
}

export function versionActiveAt(
  versions: ArchivedConstitution[],
  isoTimestamp: string,
): ArchivedConstitution | null {
  const ts = new Date(isoTimestamp).getTime();
  if (Number.isNaN(ts)) return null;

  const sorted = [...versions].sort(
    (a, b) =>
      new Date(b.effective_from).getTime() -
      new Date(a.effective_from).getTime(),
  );

  for (const v of sorted) {
    const from = new Date(v.effective_from).getTime();
    const to = v.effective_to ? new Date(v.effective_to).getTime() : Infinity;
    if (ts >= from && ts < to) return v;
  }
  return null;
}

export function isBeforeFirstVersion(
  versions: ArchivedConstitution[],
  isoTimestamp: string,
): boolean {
  if (versions.length === 0) return true;
  const ts = new Date(isoTimestamp).getTime();
  const oldest = Math.min(
    ...versions.map((v) => new Date(v.effective_from).getTime()),
  );
  return ts < oldest;
}

function formatYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return String(d.getUTCFullYear());
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function versionLabel(v: ArchivedConstitution): string {
  const date = formatShortDate(v.effective_from);
  const current = v.is_current ? " (current)" : "";
  return `Version ${v.version_number} · ${date}${current}`;
}
