import { useCallback } from "react";
import { toast } from "sonner";
import { useEarlyBirdCheckoutPresence } from "@/hooks/useEarlyBirdCheckoutPresence";
import {
  formatTicketPurchasedToast,
  formatViewerBadge,
  shouldNotifyOtherViewer,
} from "@/lib/earlyBirdSocialProof";

export function EarlyBirdSocialProof({
  eventId,
  viewerId,
}: {
  eventId: string;
  viewerId?: string;
}) {
  const onTicketPurchased = useCallback(
    (payload: { remaining?: number; buyer_id?: string | null }) => {
      if (!shouldNotifyOtherViewer(payload.buyer_id, viewerId)) return;
      const remaining = payload.remaining ?? 0;
      toast(formatTicketPurchasedToast(remaining));
    },
    [viewerId],
  );

  const viewerCount = useEarlyBirdCheckoutPresence(eventId, viewerId, onTicketPurchased);
  if (viewerCount < 1) return null;

  return (
    <div
      data-testid="early-bird-social-proof"
      className="animate-pulse rounded-full border-2 border-black bg-lime px-4 py-2 font-mono text-sm font-bold text-black"
    >
      {formatViewerBadge(viewerCount)}
    </div>
  );
}
