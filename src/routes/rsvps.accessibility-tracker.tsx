// =============================================================================
// File: src/routes/rsvps.accessibility-tracker.tsx
// Issue: #4307 - Build a 'Real-Time "Accessibility Need" Fulfillment Tracker'
// Description: Student RSVP & Coordinator route for tracking real-time disability
//              accommodations, certified provider dispatch, and on-site check-in.
// =============================================================================

import React from "react";
import { Helmet } from "react-helmet-async";
import { Accessibility, ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { AccessibilityFulfillmentTracker } from "@/components/accessibility/AccessibilityFulfillmentTracker";

export default function AccessibilityTrackerRoute() {
  return (
    <SiteShell>
      <Helmet>
        <title>Accessibility Fulfillment Tracker | CampusConnect</title>
        <meta
          name="description"
          content="Real-time 4-step fulfillment tracker for student accessibility needs and event accommodations."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/events"
            className="neu-border inline-flex items-center gap-2 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-zinc-900 transition-colors hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Events & RSVPs
          </Link>

          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>ADA Title III Certified Support</span>
          </div>
        </div>

        {/* Interactive Accessibility Component */}
        <AccessibilityFulfillmentTracker />
      </div>
    </SiteShell>
  );
}
