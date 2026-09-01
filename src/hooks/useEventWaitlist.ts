/**
 * useEventWaitlist Hook
 *
 * Custom hook for interacting with the event waitlist system.
 * Provides functions to join, leave, and manage waitlist entries
 * with optimistic updates and Supabase integration.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWaitlistStore, selectUserEntry, selectWaitlistEntries } from "@/store/useWaitlistStore";
import type {
  CreateWaitlistEntryParams,
  UpdateWaitlistEntryParams,
  WaitlistConfig,
  WaitlistEntry,
} from "@/types/waitlist";
import { DEFAULT_WAITLIST_CONFIG, PROMOTION_WINDOW_MS } from "@/types/waitlist";
import {
  calculatePromotionExpiration,
  getNextWaitlistPosition,
  getUserWaitlistPosition,
  isEventAtCapacity,
  isPromotionExpired,
  isWaitlistFull,
  validateWaitlistEntry,
} from "@/lib/waitlist-utils";
import { toast } from "sonner";

interface UseEventWaitlistOptions {
  eventId: string;
  userId?: string;
  maxAttendees?: number | null;
  currentRsvpCount?: number;
  autoSubscribe?: boolean;
}

interface UseEventWaitlistReturn {
  /** Whether the event is at capacity */
  isAtCapacity: boolean;
  /** Whether the waitlist is full */
  isWaitlistFull: boolean;
  /** Whether the user is on the waitlist */
  isOnWaitlist: boolean;
  /** The user's waitlist entry */
  userEntry: WaitlistEntry | null;
  /** The user's position on the waitlist */
  userPosition: number | null;
  /** All waitlist entries */
  entries: WaitlistEntry[];
  /** Waitlist configuration */
  config: WaitlistConfig;
  /** Whether loading */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Join the waitlist */
  joinWaitlist: (message?: string) => Promise<boolean>;
  /** Leave the waitlist */
  leaveWaitlist: () => Promise<boolean>;
  /** Update notification preferences */
  updateNotifications: (promotions: boolean, positionChanges: boolean) => Promise<boolean>;
  /** Refresh waitlist data */
  refresh: () => Promise<void>;
  /** Promote next user (admin only) */
  promoteNext: () => Promise<boolean>;
}

export function useEventWaitlist({
  eventId,
  userId,
  maxAttendees = null,
  currentRsvpCount = 0,
  autoSubscribe = true,
}: UseEventWaitlistOptions): UseEventWaitlistReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const store = useWaitlistStore();
  const supabase = createClient();

  const entries = useMemo(() => selectWaitlistEntries(eventId)(store), [store, eventId]);
  const userEntry = useMemo(() => selectUserEntry(eventId)(store), [store, eventId]);

  const isAtCapacity = isEventAtCapacity(currentRsvpCount, maxAttendees);
  const waitlistFull = isWaitlistFull(entries.length, store.configs[eventId] || DEFAULT_WAITLIST_CONFIG);
  const isOnWaitlist = userEntry !== null && userEntry.status === "waiting";
  const userPosition = userEntry ? getUserWaitlistPosition(userEntry, entries) : null;
  const config = store.configs[eventId] || DEFAULT_WAITLIST_CONFIG;

  /**
   * Fetch waitlist entries for the event
   */
  const fetchEntries = useCallback(async () => {
    try {
      store.setLoading(eventId, "loading");
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("event_waitlist")
        .select("*")
        .eq("event_id", eventId)
        .in("status", ["waiting", "promoted"])
        .order("position", { ascending: true });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      store.setEntries(eventId, data || []);

      // Find user's entry
      if (userId) {
        const userEntryData = data?.find((e) => e.user_id === userId) || null;
        store.setUserEntry(eventId, userEntryData);
      }

      store.setLoading(eventId, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch waitlist";
      setError(message);
      store.setError(eventId, message);
    }
  }, [eventId, userId, supabase, store]);

  /**
   * Fetch waitlist configuration
   */
  const fetchConfig = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("events")
        .select("waitlist_config")
        .eq("id", eventId)
        .single();

      if (fetchError) {
        // Use default config if event doesn't have one
        store.setConfig(eventId, DEFAULT_WAITLIST_CONFIG);
        return;
      }

      const waitlistConfig = data?.waitlist_config || DEFAULT_WAITLIST_CONFIG;
      store.setConfig(eventId, waitlistConfig);
    } catch {
      store.setConfig(eventId, DEFAULT_WAITLIST_CONFIG);
    }
  }, [eventId, supabase, store]);

  /**
   * Join the waitlist
   */
  const joinWaitlist = useCallback(
    async (message?: string): Promise<boolean> => {
      if (!userId) {
        toast.error("Please log in to join the waitlist");
        return false;
      }

      if (isOnWaitlist) {
        toast.info("You are already on the waitlist");
        return false;
      }

      if (waitlistFull) {
        toast.error("The waitlist is currently full");
        return false;
      }

      // Validate input
      const validationError = validateWaitlistEntry(eventId, userId, message);
      if (validationError) {
        toast.error(validationError);
        return false;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Optimistic update
        const optimisticEntry: WaitlistEntry = {
          id: `temp-${Date.now()}`,
          event_id: eventId,
          user_id: userId,
          position: getNextWaitlistPosition(entries),
          status: "waiting",
          joined_at: new Date().toISOString(),
          promoted_at: null,
          expires_at: null,
          notify_on_promotion: true,
          notify_on_position_change: true,
          message: message || null,
        };

        store.addEntry(eventId, optimisticEntry);

        // Actual Supabase insert
        const { data, error: insertError } = await supabase
          .from("event_waitlist")
          .insert({
            event_id: eventId,
            user_id: userId,
            position: getNextWaitlistPosition(entries),
            status: "waiting",
            notify_on_promotion: true,
            notify_on_position_change: true,
            message: message || null,
          })
          .select()
          .single();

        if (insertError) {
          // Revert optimistic update
          store.removeEntry(eventId, optimisticEntry.id);
          throw new Error(insertError.message);
        }

        // Replace optimistic entry with real one
        store.removeEntry(eventId, optimisticEntry.id);
        store.addEntry(eventId, data);
        store.setUserEntry(eventId, data);

        toast.success(`You are now #${data.position} on the waitlist!`);
        return true;
      } catch (err) {
        const message_ = err instanceof Error ? err.message : "Failed to join waitlist";
        setError(message_);
        toast.error(message_);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, eventId, entries, isOnWaitlist, waitlistFull, supabase, store],
  );

  /**
   * Leave the waitlist
   */
  const leaveWaitlist = useCallback(async (): Promise<boolean> => {
    if (!userEntry) return false;

    try {
      setIsLoading(true);
      setError(null);

      // Optimistic update
      store.updateEntry(eventId, userEntry.id, { status: "cancelled" });

      const { error: updateError } = await supabase
        .from("event_waitlist")
        .update({ status: "cancelled" })
        .eq("id", userEntry.id);

      if (updateError) {
        // Revert optimistic update
        store.updateEntry(eventId, userEntry.id, { status: "waiting" });
        throw new Error(updateError.message);
      }

      store.removeEntry(eventId, userEntry.id);
      store.setUserEntry(eventId, null);

      toast.success("You have been removed from the waitlist");
      return true;
    } catch (err) {
      const message_ = err instanceof Error ? err.message : "Failed to leave waitlist";
      setError(message_);
      toast.error(message_);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userEntry, eventId, supabase, store]);

  /**
   * Update notification preferences
   */
  const updateNotifications = useCallback(
    async (promotions: boolean, positionChanges: boolean): Promise<boolean> => {
      if (!userEntry) return false;

      try {
        const { error: updateError } = await supabase
          .from("event_waitlist")
          .update({
            notify_on_promotion: promotions,
            notify_on_position_change: positionChanges,
          })
          .eq("id", userEntry.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        store.updateEntry(eventId, userEntry.id, {
          notify_on_promotion: promotions,
          notify_on_position_change: positionChanges,
        });

        toast.success("Notification preferences updated");
        return true;
      } catch (err) {
        const message_ = err instanceof Error ? err.message : "Failed to update preferences";
        toast.error(message_);
        return false;
      }
    },
    [userEntry, eventId, supabase, store],
  );

  /**
   * Promote the next user in line (admin action)
   */
  const promoteNext = useCallback(async (): Promise<boolean> => {
    const waitingEntries = entries
      .filter((e) => e.status === "waiting")
      .sort((a, b) => a.position - b.position);

    if (waitingEntries.length === 0) {
      toast.info("No users waiting on the waitlist");
      return false;
    }

    const nextEntry = waitingEntries[0];

    try {
      setIsLoading(true);
      const promotionDeadline = calculatePromotionExpiration(new Date(), config.promotion_window_minutes);

      // Update entry status
      const { error: updateError } = await supabase
        .from("event_waitlist")
        .update({
          status: "promoted",
          promoted_at: new Date().toISOString(),
          expires_at: promotionDeadline.toISOString(),
        })
        .eq("id", nextEntry.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Send promotion notification
      const notification = {
        type: "promoted" as const,
        user_id: nextEntry.user_id,
        event_id: eventId,
        event_title: "", // Would be populated from event data
        position: 1,
        promotion_deadline: promotionDeadline.toISOString(),
      };
      store.addNotification(notification);

      store.updateEntry(eventId, nextEntry.id, {
        status: "promoted",
        promoted_at: new Date().toISOString(),
        expires_at: promotionDeadline.toISOString(),
      });

      // Add RSVP for promoted user
      await supabase.from("event_rsvps").upsert({
        event_id: eventId,
        user_id: nextEntry.user_id,
      });

      toast.success("User promoted from waitlist!");
      return true;
    } catch (err) {
      const message_ = err instanceof Error ? err.message : "Failed to promote user";
      toast.error(message_);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [entries, eventId, config, supabase, store]);

  /**
   * Refresh all waitlist data
   */
  const refresh = useCallback(async () => {
    await Promise.all([fetchEntries(), fetchConfig()]);
  }, [fetchEntries, fetchConfig]);

  // Auto-subscribe on mount
  useEffect(() => {
    if (autoSubscribe) {
      refresh();
    }
  }, [autoSubscribe, refresh]);

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel(`waitlist-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_waitlist",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            store.addEntry(eventId, payload.new as WaitlistEntry);
          } else if (payload.eventType === "DELETE") {
            store.removeEntry(eventId, (payload.old as WaitlistEntry).id);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as WaitlistEntry;
            store.updateEntry(eventId, updated.id, updated);

            // Check if the user was promoted
            if (updated.user_id === userId && updated.status === "promoted") {
              store.setUserEntry(eventId, updated);
              toast.success("Congratulations! You have been promoted from the waitlist!");
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, userId, supabase, store]);

  return {
    isAtCapacity,
    isWaitlistFull: waitlistFull,
    isOnWaitlist,
    userEntry,
    userPosition,
    entries,
    config,
    isLoading,
    error,
    joinWaitlist,
    leaveWaitlist,
    updateNotifications,
    refresh,
    promoteNext,
  };
}
