import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TICKET_PURCHASED_EVENT,
  checkoutPresenceChannel,
  countConnectedClients,
} from "@/lib/earlyBirdSocialProof";

export type TicketPurchasedPayload = {
  remaining?: number;
  buyer_id?: string | null;
};

export function useEarlyBirdCheckoutPresence(
  eventId: string | undefined,
  viewerId: string | undefined,
  onTicketPurchased: (payload: TicketPurchasedPayload) => void,
): number {
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (!eventId) return;

    const supabase = createClient();
    const presenceKey = viewerId || crypto.randomUUID();
    const channel = supabase.channel(checkoutPresenceChannel(eventId), {
      config: { presence: { key: presenceKey } },
    });

    const syncViewers = () => {
      setViewerCount(countConnectedClients(channel.presenceState()));
    };

    channel
      .on("presence", { event: "sync" }, syncViewers)
      .on("presence", { event: "join" }, syncViewers)
      .on("presence", { event: "leave" }, syncViewers)
      .on("broadcast", { event: TICKET_PURCHASED_EVENT }, ({ payload }) => {
        onTicketPurchased((payload || {}) as TicketPurchasedPayload);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ viewing: true });
          syncViewers();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, viewerId, onTicketPurchased]);

  return viewerCount;
}
