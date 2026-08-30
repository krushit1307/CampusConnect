// =============================================================================
// File: src/routes/clubs.$slug.budget-sankey.tsx
// Issue: #3947 - Build an 'Interactive "Event Budget vs Actual" Sankey Diagram'
// Description: Club route page hosting the interactive Event Budget vs Actual
//              Sankey Flow Diagram, analytics KPI cards, and ledger exporter.
// =============================================================================

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, PieChart, ShieldCheck } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { EventBudgetSankeyDiagram } from "@/components/budget/EventBudgetSankeyDiagram";
import { supabase } from "@/lib/supabase";
import { useAuthHydration } from "@/hooks/useAuthHydration";

export default function ClubBudgetSankeyRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { isInitializing } = useAuthHydration();

  const [club, setClub] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const loadClubDetails = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("clubs")
          .select("id, name, slug")
          .eq("slug", slug)
          .single();

        if (!error && data) {
          setClub(data);
        } else {
          // Fallback for demonstration/mock routing
          setClub({
            id: "club-demo-1",
            name: slug.replace(/-/g, " ").toUpperCase(),
            slug,
          });
        }
      } catch {
        setClub({
          id: "club-demo-1",
          name: slug.replace(/-/g, " ").toUpperCase(),
          slug,
        });
      } finally {
        setLoading(false);
      }
    };

    loadClubDetails();
  }, [slug]);

  if (isInitializing || loading) {
    return (
      <SiteShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="neu-border bg-white p-8 text-center font-mono text-sm dark:bg-zinc-900">
            <p className="font-bold">Loading Financial Sankey Visualizer...</p>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <Helmet>
        <title>Budget & Funds Flow Sankey | {club?.name || "Club"} | CampusConnect</title>
        <meta
          name="description"
          content="Interactive visual flow of budget allocations and actual vendor expenditures."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to={`/clubs/${slug}`}
            className="neu-border inline-flex items-center gap-2 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-zinc-900 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Club
          </Link>

          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Public Financial Audit Trail</span>
          </div>
        </div>

        {/* Sankey Dashboard Component */}
        <EventBudgetSankeyDiagram
          clubId={club?.id}
          clubName={club?.name}
        />
      </div>
    </SiteShell>
  );
}
