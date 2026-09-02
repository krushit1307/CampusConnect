/**
 * Event HVAC Pre-Cooling Predictive Analytics Page
 * Route: /events/:eventId/hvac-pre-cooling
 * Issue #5355
 */

import React from "react";
import { useParams, Link } from "react-router-dom";
import { HvacPreCoolingPredictionCard } from "@/components/events/HvacPreCoolingPredictionCard";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Thermometer from "lucide-react/dist/esm/icons/thermometer";

export default function EventHvacPreCoolingPage() {
  const { eventId } = useParams<{ eventId: string }>();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6 font-sans">
      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Link
          to={eventId ? `/events/${eventId}/dashboard` : "/facility-dashboard"}
          className="inline-flex items-center text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>

        <span className="text-xs font-mono text-cyan-400 bg-cyan-950 border border-cyan-800 px-3 py-1 rounded-full font-bold">
          THERMAL RESOURCE MODELING
        </span>
      </div>

      {/* Main Prediction Card */}
      <HvacPreCoolingPredictionCard
        venueId="venue-auditorium-main"
        initialAttendees={1200}
        initialVenueAreaSqFt={5000}
      />
    </div>
  );
}
