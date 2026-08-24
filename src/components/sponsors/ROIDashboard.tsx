// =============================================================================
// Component: ROIDashboard
// Issue: #3238 - Build a 'Sponsorship ROI Dashboard' for Corporate Partners
// Description: The main portal for corporate sponsors to view the Return on
// Investment for events they funded.Displays k - anonymity warnings, total
// reach metrics, demographic charts, and the lead export functionality.
// =============================================================================

import React, { useState } from "react";
import { useSponsorROI } from "../../hooks/useSponsorROI";
import { DemographicCharts } from "./DemographicCharts";
import { LeadExportButton } from "./LeadExportButton";
import LeadScanner from "./LeadScanner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ROIDashboardProps {
  eventId: string;
  sponsorId: string;
  eventTitle: string;
}

export const ROIDashboard: React.FC<ROIDashboardProps> = ({ eventId, sponsorId, eventTitle }) => {
  const { roiData, isLoading, error, exportLeads } = useSponsorROI(eventId, sponsorId);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
          <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-center">
        <p className="font-bold mb-1">Failed to load ROI Dashboard</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!roiData) return null;

  return (
    <div className="space-y-8">
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">
            Sponsorship ROI: {eventTitle}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Aggregated demographic insights for your sponsored event.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-white dark:bg-gray-800 h-[40px]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                Scan Booth Leads
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Sponsor Booth Lead Scanner</DialogTitle>
              </DialogHeader>
              <LeadScanner eventId={eventId} sponsorId={sponsorId} />
            </DialogContent>
          </Dialog>
          <LeadExportButton onExport={exportLeads} disabled={!roiData.isAnonymous} />
        </div>
      </div>

      {/* K-Anonymity Warning */}
      {!roiData.isAnonymous && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r-lg flex items-start gap-3">
          <svg
            className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="font-bold text-amber-800 dark:text-amber-300">
              Privacy Protection Active
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              {roiData.message ||
                "Not enough data to ensure anonymity. Minimum 10 attendees required to display demographic charts."}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-2 font-medium">
              Total Confirmed RSVPs: {roiData.totalRsvps}
            </p>
          </div>
        </div>
      )}

      {/* Metrics Cards */}
      {roiData.isAnonymous && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total Reach
              </p>
              <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                {roiData.totalRsvps}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Confirmed Attendees</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Majors Reached
              </p>
              <p className="text-4xl font-black text-purple-600 dark:text-purple-400 mt-2">
                {roiData.majors?.length || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Distinct Fields of Study
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Brand Engagement
              </p>
              <p className="text-4xl font-black text-blue-600 dark:text-blue-400 mt-2 flex items-baseline gap-2">
                {roiData.hoverDurationMinutes || 0}{" "}
                <span className="text-sm font-medium text-gray-500">min</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Users hovered over your logo for a combined total of{" "}
                {roiData.hoverDurationMinutes || 0} minutes.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Data Privacy
              </p>
              <p className="text-4xl font-black text-green-600 dark:text-green-400 mt-2 flex items-center gap-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">k-Anonymity Enforced</p>
            </div>
          </div>

          {/* Charts */}
          <DemographicCharts
            majors={roiData.majors || []}
            graduationYears={roiData.graduationYears || []}
          />
        </>
      )}
    </div>
  );
}; // =============================================================================
