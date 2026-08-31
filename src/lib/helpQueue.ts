// src/lib/helpQueue.ts
// -----------------------------------------------------------------------------
// Issue: #3938 — Build a 'Real-Time "Help Desk" Queue' for Hackathons
//
// TypeScript types + pure helpers for the help desk queue feature.
// Kept free of React and Supabase imports so it can be unit-tested
// in isolation (mirrors src/lib/liveTasks.ts).
// -----------------------------------------------------------------------------

/** Row of `help_queue`. Mirrors the SQL schema exactly. */
export interface HelpTicket {
  id: string;
  event_id: string;
  requested_by: string;
  team_name: string;
  table_number: string;
  issue_description: string;
  status: "open" | "claimed" | "resolved" | "cancelled";
  mentor_id: string | null;
  created_at: string;
  claimed_at: string | null;
  resolved_at: string | null;
  updated_at: string;
  mentor_name?: string | null;
}

export interface ClaimTicketResult {
  claimed: boolean;
  ticket_id?: string;
  mentor_id?: string;
  team_name?: string;
  table_number?: string;
  reason?: string;
}

export interface TicketActionResult {
  ok: boolean;
  ticket_id?: string;
  reason?: string;
}

export interface QueuePositionResult {
  position: number;
  ticket_id?: string;
  status?: string;
  reason?: string;
}

export function isOpen(ticket: HelpTicket): boolean {
  return ticket.status === "open";
}

export function isClaimed(ticket: HelpTicket): boolean {
  return ticket.status === "claimed";
}

export function isClosed(ticket: HelpTicket): boolean {
  return ticket.status === "resolved" || ticket.status === "cancelled";
}

export function getQueuePosition(
  tickets: HelpTicket[],
  ticketId: string,
): number {
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.status !== "open") return 0;
  const openTickets = tickets
    .filter((t) => t.status === "open")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const idx = openTickets.findIndex((t) => t.id === ticketId);
  return idx >= 0 ? idx + 1 : 0;
}

export function ticketsAhead(
  tickets: HelpTicket[],
  ticketId: string,
): number {
  const pos = getQueuePosition(tickets, ticketId);
  return Math.max(0, pos - 1);
}

export function estimateWaitMinutes(
  ticketsAheadCount: number,
  avgMinutesPerTicket: number = 5,
): number {
  return Math.max(0, ticketsAheadCount * avgMinutesPerTicket);
}

export function formatWaitTime(minutes: number): string {
  if (minutes <= 0) return "Now";
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  if (remainingMin === 0) return `~${hours} hr`;
  return `~${hours} hr ${remainingMin} min`;
}

export function statusLabel(status: HelpTicket["status"]): string {
  switch (status) {
    case "open": return "In Queue";
    case "claimed": return "Mentor En Route";
    case "resolved": return "Resolved";
    case "cancelled": return "Cancelled";
    default: return status;
  }
}

export function statusColor(status: HelpTicket["status"]): string {
  switch (status) {
    case "open": return "bg-blue-100 text-blue-800 border-blue-400";
    case "claimed": return "bg-amber-100 text-amber-800 border-amber-400";
    case "resolved": return "bg-green-100 text-green-800 border-green-400";
    case "cancelled": return "bg-gray-100 text-gray-500 border-gray-400";
    default: return "bg-gray-100 text-gray-500 border-gray-400";
  }
}

export function buildMentorClaimedMessage(
  mentorName: string | null | undefined,
  tableNumber: string,
): string {
  const name = mentorName?.trim() || "A mentor";
  return `${name} is on their way to Table ${tableNumber}!`;
}

export function helpQueueChannelName(eventId: string): string {
  return `help_queue_event_${eventId}`;
}

export function isTicketOwner(
  ticket: HelpTicket,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return ticket.requested_by === userId;
}

export function isAssignedMentor(
  ticket: HelpTicket,
  userId: string | null | undefined,
): boolean {
  if (!userId || !ticket.mentor_id) return false;
  return ticket.mentor_id === userId;
}
