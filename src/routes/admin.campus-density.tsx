// =============================================================================
// File: src/routes/admin.campus-density.tsx
// Issue: #4283 - Build a 'Real-Time "Event Capacity" Thermal Map'
// Description: Admin facility route for enterprise campus WiFi location tracking,
//              venue fire code compliance, and crowd load balancing.
// =============================================================================

import React from "react";
import { Helmet } from "react-helmet-async";
import { Flame, ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { InteractiveVenueThermalMap } from "@/components/capacity/InteractiveVenueThermalMap";

export default function AdminCampusDensityRoute() {
  return (
    <SiteShell>
      <Helmet>
        <title>Campus Venue Capacity & Spatial Thermal Map | Admin | CampusConnect</title>
        <meta
          name="description"
          content="Enterprise WiFi crowd density heatmap, fire code compliance auditing, and emergency crowd redirection."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/admin"
            className="neu-border inline-flex items-center gap-2 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-zinc-900 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Admin Console
          </Link>

          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Cisco Meraki CMX Scanning API Live</span>
          </div>
        </div>

        {/* Dynamic Thermal Map Component */}
        <InteractiveVenueThermalMap
          eventTitle="Campus-Wide Facility Spatial Intelligence & Heatmap"
        />
      </div>
    </SiteShell>
  );
}
