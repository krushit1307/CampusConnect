// =============================================================================
// Utility: Event Clash Types & Helpers
// Issue: #3708 - Implement 'Automated "Event Clash" Negotiation'
// Description: Shared contract for clash results plus a temporal-overlap helper
// used for optimistic client-side pre-checks before the RPC runs.
// =============================================================================

export interface ClashResult {
    other_event_id: string;
    other_title: string;
    other_club_name: string;
    shared_members: number;
    overlap_pct: number;
    overlap_minutes: number;
    negotiation_channel_id: string | null;
}

/** Threshold above which a demographic overlap is considered a severe clash. */
export const SEVERE_OVERLAP_PCT = 30;

/** True when two [start,end] intervals overlap. */
export function rangesOverlap(
    aStart: Date, aEnd: Date, bStart: Date, bEnd: Date
): boolean {
    return aStart < bEnd && aEnd > bStart;
}

/** Minutes of overlap between two intervals (0 if none). */
export function overlapMinutes(
    aStart: Date, aEnd: Date, bStart: Date, bEnd: Date
): number {
    const start = aStart > bStart ? aStart : bStart;
    const end = aEnd < bEnd ? aEnd : bEnd;
    const ms = end.getTime() - start.getTime();
    return ms > 0 ? Math.round(ms / 60000) : 0;
}

/** Human-friendly summary used in the negotiation modal. */
export function clashSummary(c: ClashResult): string {
    return (
        `Your event overlaps "${c.other_title}" (${c.other_club_name}) by ` +
        `${c.overlap_minutes} minutes and you share ${c.shared_members} members ` +
        `(${c.overlap_pct}% of the smaller club).`
    );
}
