export const TICKET_PURCHASED_EVENT = "ticket_purchased";

export function checkoutPresenceChannel(eventId: string): string {
  return `checkout:${eventId}`;
}

export function countConnectedClients(
  presenceState: Record<string, unknown[] | undefined>,
): number {
  return Object.keys(presenceState).length;
}

export function formatViewerBadge(viewerCount: number): string {
  return `🔥 ${viewerCount} people are looking at this ticket right now!`;
}

export function formatTicketPurchasedToast(remaining: number): string {
  return `🎉 Someone just bought a ticket! Only ${remaining} left!`;
}

export function shouldNotifyOtherViewer(
  buyerId: string | null | undefined,
  viewerId: string | null | undefined,
): boolean {
  if (!buyerId || !viewerId) return true;
  return buyerId !== viewerId;
}

export function ticketsRemaining(
  availableSpots: number | null | undefined,
  maxAttendees: number | null | undefined,
): number {
  const remaining = availableSpots ?? maxAttendees ?? 0;
  return Math.max(0, remaining);
}
