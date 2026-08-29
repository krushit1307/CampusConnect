// =============================================================================
// File: src/routes/sustainability.carbon-offset.tsx
// Issue: #3936 - Develop a 'Dynamic Ride-Share Carbon Offset' Calculator
// Description: Campus sustainability dashboard route featuring the live
//              Ride-Share Carbon Offset Engine and environmental audit ledger.
// =============================================================================

import React from "react";
import { Helmet } from "react-helmet-async";
import { Leaf, ShieldCheck } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { DynamicRideShareCarbonOffset } from "@/components/sustainability/DynamicRideShareCarbonOffset";

export default function SustainabilityCarbonOffsetRoute() {
  return (
    <SiteShell>
      <Helmet>
        <title>Campus Ride-Share Carbon Offset Engine | CampusConnect</title>
        <meta
          name="description"
          content="Track real-time carbon emissions avoided by carpooling to campus events."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-500">
            <Leaf className="h-4 w-4 text-emerald-500" />
            <span>Campus Sustainability & Climate Action Program</span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>EPA OTAQ Certified Emission Models</span>
          </div>
        </div>

        {/* Carbon Offset Component */}
        <DynamicRideShareCarbonOffset />
      </div>
    </SiteShell>
  );
}
