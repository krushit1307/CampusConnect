import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import type { EventMerchCartEntry } from "@/components/events/EventMerchStore";

export interface CheckoutOptions {
  eventId: string;
  ticketPriceCents: number;
  ticketName: string;
  merchCart: EventMerchCartEntry[];
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutState {
  isLoading: boolean;
  error: string | null;
  checkoutUrl: string | null;
}

export function useEventMerchCheckout() {
  const [state, setState] = useState<CheckoutState>({
    isLoading: false,
    error: null,
    checkoutUrl: null,
  });

  const createCheckoutSession = useCallback(async (options: CheckoutOptions) => {
    const { eventId, ticketPriceCents, ticketName, merchCart, successUrl, cancelUrl } = options;

    setState({ isLoading: true, error: null, checkoutUrl: null });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to checkout.");
      }

      const { data, error } = await supabase.functions.invoke(
        "create-event-merch-checkout",
        {
          body: {
            eventId,
            userId: user.id,
            ticketPriceCents,
            ticketName,
            merchItems: merchCart.map((entry) => ({
              variantId: entry.variantId,
              itemName: entry.itemName,
              size: entry.size,
              priceCents: entry.price,
              quantity: entry.quantity,
            })),
            successUrl,
            cancelUrl,
          },
        },
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setState({
        isLoading: false,
        error: null,
        checkoutUrl: data.url,
      });

      if (data.url) {
        window.location.href = data.url;
      }

      return data;
    } catch (err: any) {
      const message = err.message || "Failed to create checkout session.";
      setState({ isLoading: false, error: message, checkoutUrl: null });
      toast.error(message);
      return null;
    }
  }, []);

  return {
    ...state,
    createCheckoutSession,
  };
}
