/**
 * Tiny date-formatting helpers for ticket PDF generation (issue #1913).
 *
 * Kept separate from the layout module so they can be unit-tested
 * without pulling in pdfmake, and so we don't ship a date library
 * to users who only need the layout renderer.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Format an ISO timestamp for the PDF ticket header.
 *
 * Example: "2026-09-15T18:00:00Z" -> "September 15, 2026 at 6:00 PM".
 *
 * Falls back to "TBA" if the input is missing or unparseable.
 */
export function formatTicketDate(iso: string | null | undefined): string {
  if (!iso) return "TBA";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBA";
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  const mm = minutes.toString().padStart(2, "0");
  return `${month} ${day}, ${year} at ${hours12}:${mm} ${period}`;
}

/**
 * Format a date range "start -> end" for the venue row of the ticket.
 *
 * - Both dates on the same day -> "Sep 15, 2026, 6:00 PM – 9:00 PM"
 * - Different days -> each date fully formatted, joined by " – "
 * - Only start given -> just the start
 * - Neither given -> "TBA"
 */
export function formatTicketDateRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string {
  const start = formatTicketDate(startIso);
  const end = formatTicketDate(endIso);
  if (start === "TBA" && end === "TBA") return "TBA";
  if (end === "TBA") return start;
  if (start === "TBA") return end;
  if (startIso && endIso) {
    const a = new Date(startIso);
    const b = new Date(endIso);
    if (
      !Number.isNaN(a.getTime()) &&
      !Number.isNaN(b.getTime()) &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    ) {
      // Same day — drop the redundant date prefix from `end`.
      const endShort = end.replace(/^.+ at /, "");
      return `${start} – ${endShort}`;
    }
  }
  return `${start} – ${end}`;
}
