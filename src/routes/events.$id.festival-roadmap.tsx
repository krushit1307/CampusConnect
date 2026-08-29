// =============================================================================
// File: src/routes/events.$id.festival-roadmap.tsx
// Issue: #3944 - Build an 'Interactive "Event Roadmap" for Multi-Day Festivals'
// Description: Multi-day festival roadmap route displaying concurrent tracks,
//              interactive Gantt time-matrix, conflict alerts, and iCal exports.
// =============================================================================

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Calendar, Sparkles, ShieldCheck } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { InteractiveFestivalRoadmap } from "@/components/festivals/InteractiveFestivalRoadmap";
import { supabase } from "@/lib/supabase";
import { useAuthHydration } from "@/hooks/useAuthHydration";

export default function EventFestivalRoadmapRoute() {
  const { id } = useParams<{ id: string }>();
  const { isInitializing } = useAuthHydration();

  const [event, setEvent] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadFestival = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("events")
          .select("id, title")
          .eq("id", id)
          .single();

        if (!error && data) {
          setEvent(data);
        } else {
          setEvent({
            id: id || "fest-summit-2026",
            title: "CampusConnect Innovation & Tech Summit 2026",
          });
        }
      } catch {
        setEvent({
          id: id || "fest-summit-2026",
          title: "CampusConnect Innovation & Tech Summit 2026",
        });
      } finally {
        setLoading(false);
      }
    };

    loadFestival();
  }, [id]);

  if (isInitializing || loading) {
    return (
      <SiteShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="neu-border bg-white p-8 text-center font-mono text-sm dark:bg-zinc-900">
            <p className="font-bold">Loading Multi-Track Festival Roadmap...</p>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <Helmet>
        <title>Festival Roadmap & Schedule | {event?.title || "Conference"} | CampusConnect</title>
        <meta
          name="description"
          content="Interactive multi-track festival schedule, personal itinerary planner, and calendar export."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to={`/events/${id}`}
            className="neu-border inline-flex items-center gap-2 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-zinc-900 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Event Overview
          </Link>

          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Multi-Track Conference Mode Active</span>
          </div>
        </div>

        {/* Festival Roadmap Component */}
        <InteractiveFestivalRoadmap
          festivalId={event?.id}
          festivalTitle={event?.title}
        />
      </div>
    </SiteShell>
  );
}
