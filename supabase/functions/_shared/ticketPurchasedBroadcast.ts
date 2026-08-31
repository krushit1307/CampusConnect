export const TICKET_PURCHASED_EVENT = "ticket_purchased";

export function checkoutPresenceChannel(eventId: string): string {
  return `checkout:${eventId}`;
}

export async function broadcastTicketPurchased(
  supabase: {
    channel: (name: string) => {
      subscribe: (cb?: (status: string) => void) => Promise<unknown> | unknown;
      send: (args: {
        type: "broadcast";
        event: string;
        payload: { remaining: number; buyer_id: string | null };
      }) => Promise<unknown>;
    };
    removeChannel?: (channel: unknown) => Promise<unknown> | unknown;
  },
  eventId: string,
  remaining: number,
  buyerId?: string | null,
): Promise<void> {
  const channel = supabase.channel(checkoutPresenceChannel(eventId));
  await new Promise<void>((resolve, reject) => {
    const result = channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error(`ticket_purchased broadcast failed: ${status}`));
      }
    });
    if (result && typeof (result as Promise<unknown>).then === "function") {
      void (result as Promise<unknown>).catch(reject);
    }
  });
  await channel.send({
    type: "broadcast",
    event: TICKET_PURCHASED_EVENT,
    payload: { remaining, buyer_id: buyerId ?? null },
  });
  await supabase.removeChannel?.(channel);
}
