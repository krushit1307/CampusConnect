// =============================================================================
// File: src/routes/clubs.$slug.dynamic-pricing.tsx
// Issue: #4292 - Build a 'Real-Time "Dynamic Pricing" Flash Sale Engine'
// Description: Club officer route for managing dynamic pricing campaigns across club events.
// =============================================================================

import React from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Zap, ShieldCheck, ArrowLeft } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { InteractiveFlashSaleOrchestrator } from "@/components/pricing/InteractiveFlashSaleOrchestrator";

export default function ClubDynamicPricingRoute() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <SiteShell>
      <Helmet>
        <title>Club Dynamic Pricing & Flash Sales | CampusConnect</title>
        <meta
          name="description"
          content="Manage dynamic pricing, revenue liquidation, and short-term promotional campaigns."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to={`/clubs/${slug}`}
            className="neu-border inline-flex items-center gap-2 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-zinc-900 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Club Dashboard
          </Link>

          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Stripe Revenue Liquidation Portal</span>
          </div>
        </div>

        <InteractiveFlashSaleOrchestrator
          eventId="evt-gala-2026"
          eventTitle="Club Event Dynamic Pricing Suite"
        />
      </div>
    </SiteShell>
  );
}
