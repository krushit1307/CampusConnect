// =============================================================================
// File: src/routes/events.$id.hardware-resources.tsx
// Issue: #4304 - Build a 'Real-Time "Hardware Resource" Status Dashboard'
// Description: Event Hackathon organizer route for real-time provisioned VM monitoring,
//              CPU anomaly detection, and node lifecycle management.
// =============================================================================

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Server, ShieldCheck, ArrowLeft } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { HardwareResourceDashboard } from "@/components/hardware/HardwareResourceDashboard";
import { supabase } from "@/lib/supabase";
import { useAuthHydration } from "@/hooks/useAuthHydration";

export default function EventHardwareResourcesRoute() {
  const { id } = useParams<{ id: string }>();
  const { isInitializing } = useAuthHydration();

  const [event, setEvent] = useState<{ id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadEvent = async () => {
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
            id: id || "evt-hackathon-2026",
            title: "Annual Spring Hackathon 2026",
          });
        }
      } catch {
        setEvent({
          id: id || "evt-hackathon-2026",
          title: "Annual Spring Hackathon 2026",
        });
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [id]);

  if (isInitializing || loading) {
    return (
      <SiteShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="neu-border bg-white p-8 text-center font-mono text-sm dark:bg-zinc-900">
            <p className="font-bold">Connecting to CloudWatch Telemetry Stream...</p>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <Helmet>
        <title>Hardware & Cloud Fleet | {event?.title || "Hackathon"} | CampusConnect</title>
        <meta
          name="description"
          content="Real-time hardware resource telemetry, GPU/CPU monitoring, and AWS EC2 kill switch."
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
            <span>Hackathon Cloud Cluster Guard</span>
          </div>
        </div>

        {/* Dynamic Hardware Dashboard Component */}
        <HardwareResourceDashboard
          eventTitle={event?.title || "Annual Spring Hackathon 2026"}
          totalCloudBudgetUsd={800.0}
        />
      </div>
    </SiteShell>
  );
}
