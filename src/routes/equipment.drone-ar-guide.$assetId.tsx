// =============================================================================
// Route Page: DroneArSetupGuideRoute
// Issue: #5132 - Dynamic "Hardware Resource" Drone Maintenance Augmented Reality Guide
// Description: Page route for /equipment/drone-ar-guide/:assetId displaying the AR setup card.
// =============================================================================

import React from "react";
import { useParams } from "react-router-dom";
import { DroneArSetupGuideCard } from "@/components/equipment/DroneArSetupGuideCard";
import { ArrowLeft } from "lucide-react";

export default function DroneArSetupGuideRoute() {
  const { assetId } = useParams<{ assetId: string }>();

  if (!assetId) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono">
        Missing or invalid hardware asset ID.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
          <a href="/equipment" className="flex items-center gap-1 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Equipment Inventory</span>
          </a>
        </div>

        <DroneArSetupGuideCard assetId={assetId} />
      </div>
    </div>
  );
}
