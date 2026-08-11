// =============================================================================
// Component: ManageSubscriptions
// Issue: #2817 - Implement Push Subscriptions for Specific Clubs
// Description: A settings UI allowing users to view and manage all their
// active club subscriptions.Fetches the list of subscribed clubs and
// provides quick unsubscribe toggles.
// =============================================================================

import React, { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";

interface SubscribedClub {
  id: string; // subscription id
  club_id: string;
  notify_events: boolean;
  notify_announcements: boolean;
  clubs: {
    name: string;
    logo_url: string | null;
    slug: string;
  };
}

export const ManageSubscriptions: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<SubscribedClub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("club_subscriptions")
        .select(
          `
          id,
          club_id,
          notify_events,
          notify_announcements,
          clubs:club_id (name, logo_url, slug)
        `,
        )
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setSubscriptions((data as any[]) || []);
    } catch (err: any) {
      console.error("[ManageSubscriptions] Fetch failed:", err);
      setError("Failed to load your subscriptions.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async (subscriptionId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("club_subscriptions")
        .delete()
        .eq("id", subscriptionId);

      if (deleteError) throw deleteError;

      // Optimistically remove from UI
      setSubscriptions((prev) => prev.filter((sub) => sub.id !== subscriptionId));
    } catch (err: any) {
      console.error("[ManageSubscriptions] Unsubscribe failed:", err);
      alert("Failed to unsubscribe. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <svg
            className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          Notification Subscriptions
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage which clubs send you push notifications for new events and announcements.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {subscriptions.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-lg font-medium">No active subscriptions</p>
            <p className="text-sm mt-1">
              Visit a club's profile and click the bell icon to subscribe to their events.
            </p>
          </div>
        ) : (
          subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                {sub.clubs.logo_url ? (
                  <img
                    src={sub.clubs.logo_url}
                    alt={sub.clubs.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-gray-500 dark:text-gray-400">
                    {sub.clubs.name.charAt(0)}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {sub.clubs.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Events: {sub.notify_events ? "✅" : "❌"} • Announcements:{" "}
                  {sub.notify_announcements ? "✅" : "❌"}
                </p>
              </div>

              <button
                onClick={() => handleUnsubscribe(sub.id)}
                className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Unsubscribe
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
