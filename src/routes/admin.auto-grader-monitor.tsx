// =============================================================================
// Route Page: AdminAutoGraderMonitorRoute
// Issue: #5131 - Automated "Event Series" GitHub Classroom Auto-Grader Load Balancer
// Description: Page route for /admin/auto-grader-monitor displaying telemetry dashboard.
// =============================================================================

import React from "react";
import { AutoGraderMonitorDashboard } from "@/components/admin/AutoGraderMonitorDashboard";
import { ArrowLeft } from "lucide-react";

export default function AdminAutoGraderMonitorRoute() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
          <a href="/dashboard" className="flex items-center gap-1 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </a>
        </div>

        <AutoGraderMonitorDashboard />
      </div>
    </div>
  );
}
