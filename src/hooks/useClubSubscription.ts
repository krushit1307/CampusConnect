// =============================================================================
// Hook: useClubSubscription
// Issue: #2817 - Implement Push Subscriptions for Specific Clubs
// Description: Manages the state and database interactions for subscribing
// and unsubscribing to a specific club's notifications. Handles optimistic
// UI updates for the bell icon toggle.
// =============================================================================

import { useState, useCallback, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

interface UseClubSubscriptionReturn {
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  toggleSubscription: () => Promise<void>;
}

export function useClubSubscription(clubId: string | null): UseClubSubscriptionReturn {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial subscription state
  useEffect(() => {
    if (!clubId) {
      setIsLoading(false);
      return;
    }

    const fetchSubscriptionStatus = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setIsSubscribed(false);
          setIsLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("club_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("club_id", clubId)
          .maybeSingle();

        if (fetchError && fetchError.code !== "PGRST116") {
          // PGRST116 = No rows found
          throw fetchError;
        }

        setIsSubscribed(!!data);
      } catch (err: any) {
        console.error("[useClubSubscription] Fetch failed:", err);
        setError(err.message || "Failed to check subscription status");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptionStatus();
  }, [clubId]);

  // Toggle subscription state
  const toggleSubscription = useCallback(async () => {
    if (!clubId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in to subscribe.");
      return;
    }

    // Optimistic UI update
    const previousState = isSubscribed;
    setIsSubscribed(!previousState);
    setIsLoading(true);

    try {
      if (previousState) {
        // Unsubscribe
        const { error: deleteError } = await supabase
          .from("club_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("club_id", clubId);

        if (deleteError) throw deleteError;
      } else {
        // Subscribe
        const { error: insertError } = await supabase.from("club_subscriptions").insert({
          user_id: user.id,
          club_id: clubId,
          notify_events: true,
          notify_announcements: true,
        });

        if (insertError) throw insertError;
      }
    } catch (err: any) {
      console.error("[useClubSubscription] Toggle failed:", err);
      setError(err.message || "Failed to update subscription");
      // Revert optimistic update on error
      setIsSubscribed(previousState);
    } finally {
      setIsLoading(false);
    }
  }, [clubId, isSubscribed]);

  return {
    isSubscribed,
    isLoading,
    error,
    toggleSubscription,
  };
}
