// =============================================================================
// File: src/routes/admin.hardware-telemetry.tsx
// Issue: #4304 - Build a 'Real-Time "Hardware Resource" Status Dashboard'
// Description: Admin infrastructure route for real-time cloud resource telemetry,
//              AWS CloudWatch stream monitoring, and rogue miner kill switches.
// =============================================================================

import React from "react";
import { Helmet } from "react-helmet-async";
import { Server, ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { HardwareResourceDashboard } from "@/components/hardware/HardwareResourceDashboard";

export default function AdminHardwareTelemetryRoute() {
  return (
    <SiteShell>
      <Helmet>
        <title>Cloud Hardware & Infrastructure Telemetry | Admin | CampusConnect</title>
        <meta
          name="description"
          content="Real-time AWS EC2 compute resource telemetry, rogue crypto-mining detection, and cloud cost management."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Top Breadcrumb Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/admin"
            className="neu-border inline-flex items-center gap-2 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-zinc-900 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Admin Console
          </Link>

          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>AWS CloudWatch Metric Stream Active (us-east-1)</span>
          </div>
        </div>

        {/* Dynamic Hardware Dashboard Component */}
        <HardwareResourceDashboard
          eventTitle="Campus-Wide Compute Cluster & Hackathon Fleet"
          totalCloudBudgetUsd={1500.0}
        />
      </div>
    </SiteShell>
  );
}
