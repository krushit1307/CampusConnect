import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface UseTagSubscriptionReturn {
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  toggleSubscription: () => Promise<void>;
}

async function resolveTagId(tagName: string): Promise<string | null> {
  const name = tagName.replace(/^#/, "").trim();
  if (!name) return null;

  const { data: existing } = await supabase
    .from("club_tag_labels")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("club_tag_labels")
    .insert({ name })
    .select("id")
    .single();
  if (error || !created?.id) return null;
  return created.id;
}

export function useTagSubscription(tagName: string | null): UseTagSubscriptionReturn {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tagName) {
      setIsSubscribed(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setIsSubscribed(false);
          setIsLoading(false);
        }
        return;
      }

      const tagId = await resolveTagId(tagName);
      if (!tagId) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_tag_subscriptions")
        .select("tag_id")
        .eq("user_id", user.id)
        .eq("tag_id", tagId)
        .maybeSingle();

      if (!cancelled) {
        setIsSubscribed(!!data);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tagName]);

  const toggleSubscription = useCallback(async () => {
    if (!tagName) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in to subscribe.");
      return;
    }

    const tagId = await resolveTagId(tagName);
    if (!tagId) {
      setError("Could not resolve that tag.");
      return;
    }

    const previous = isSubscribed;
    setIsSubscribed(!previous);
    setIsLoading(true);
    setError(null);

    try {
      if (previous) {
        const { error: deleteError } = await supabase
          .from("user_tag_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("tag_id", tagId);
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase.from("user_tag_subscriptions").insert({
          user_id: user.id,
          tag_id: tagId,
        });
        if (insertError) throw insertError;
      }
    } catch (err: unknown) {
      setIsSubscribed(previous);
      setError(err instanceof Error ? err.message : "Failed to update subscription");
    } finally {
      setIsLoading(false);
    }
  }, [tagName, isSubscribed]);

  return { isSubscribed, isLoading, error, toggleSubscription };
}
