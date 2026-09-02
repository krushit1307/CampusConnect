// =============================================================================
// Route Page: SponsorZkLeadsRoute
// Issue: #5130 - Real-Time "Sponsor Lead" CRM Webhook Zero-Knowledge Proof
// Description: Page route for /sponsors/zk-leads displaying the ZK Lead Prover & CRM Webhook.
// =============================================================================

import React from "react";
import { SponsorZkLeadProverCard } from "@/components/sponsors/SponsorZkLeadProverCard";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function SponsorZkLeadsRoute() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
          <a href="/dashboard" className="flex items-center gap-1 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </a>
        </div>

        <SponsorZkLeadProverCard />
      </div>
    </div>
  );
}
