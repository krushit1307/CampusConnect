// =============================================================================
// File: src/routes/events.$id.early-bird-analytics.tsx
// Feature: Dynamic "Early Bird" Discount Analytics
// Description: Event sub-route hosting real-time ticket sales velocity analytics,
//              early bird quota absorption tracking, automated pricing
//              recommendations, and dynamic demand elasticity workbench.
// =============================================================================

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Sparkles, TrendingUp } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { DynamicEarlyBirdAnalytics } from "@/components/events/DynamicEarlyBirdAnalytics";
import { supabase } from "@/lib/supabase";
import { useAuthHydration } from "@/hooks/useAuthHydration";

export default function DynamicEarlyBirdAnalyticsRoute() {
  const { id, eventId } = useParams<{ id?: string; eventId?: string }>();
  const activeEventId = id || eventId || "evt-demo-1";
  const { isInitializing } = useAuthHydration();

  const [event, setEvent] = useState<{ id: string; title: string; capacity?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeEventId) return;

    const loadEventDetails = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("events")
          .select("id, title, capacity")
          .eq("id", activeEventId)
          .single();

        if (!error && data) {
          setEvent(data);
        } else {
          setEvent({
            id: activeEventId,
            title: "Campus Annual Music & Tech Fest 2026",
            capacity: 300,
          });
        }
      } catch {
        setEvent({
          id: activeEventId,
          title: "Campus Annual Music & Tech Fest 2026",
          capacity: 300,
        });
      } finally {
        setLoading(false);
      }
    };

    loadEventDetails();
  }, [activeEventId]);

  if (isInitializing || loading) {
    return (
      <SiteShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center font-mono text-sm shadow-md dark:border-zinc-800 dark:bg-zinc-900">
            <p className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500 animate-spin" />
              Loading Ticket Velocity & Early Bird Analytics...
            </p>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <Helmet>
        <title>
          Dynamic Early Bird Discount Analytics | {event?.title || "Event"} | CampusConnect
        </title>
        <meta
          name="description"
          content="Analyze ticket sales velocity and early bird quota absorption to optimize event ticket pricing strategies."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Top Navigation Bar */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to={`/events/${activeEventId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 font-mono text-xs font-bold uppercase text-zinc-900 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Event Details
          </Link>

          <div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-500">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Dynamic Pricing AI Active</span>
          </div>
        </div>

        {/* Analytics Dashboard Component */}
        <DynamicEarlyBirdAnalytics
          eventId={event?.id}
          eventTitle={event?.title}
        />
      </div>
    </SiteShell>
  );
}
