import React, { useState } from "react";
import { FileText, Printer, Sparkles, Building, Check, Layers, Award, BarChart3, Eye } from "lucide-react";
import {
  ProposalHighlightEvent,
  SponsorshipTierProposal,
  ClubProposalData,
  DEFAULT_SPONSORSHIP_TIERS,
  aggregateClubProposalMetrics,
  generateSponsorshipProposalHtml,
} from "@/lib/sponsorProposalGenerator";
import { cn } from "@/lib/utils";

export interface SponsorshipProposalGeneratorProps {
  clubName?: string;
  clubTagline?: string;
  brandColor?: string;
  activeMembersCount?: number;
  availableEvents?: ProposalHighlightEvent[];
  className?: string;
}

export const MOCK_PAST_EVENTS: ProposalHighlightEvent[] = [
  {
    id: "evt-1",
    title: "Annual 36-Hour Hackathon",
    date: "Fall 2025",
    attendance: 400,
    keyMetric: "85% CS Majors • 50+ Projects Shipped",
    description: "Our premier hackathon attracting top student engineers across California.",
  },
  {
    id: "evt-2",
    title: "Tech Career & Networking Gala",
    date: "Winter 2025",
    attendance: 350,
    keyMetric: "35 Corporate Sponsors • 100+ Interviews",
    description: "Exclusive corporate networking banquet with top-tier student leadership.",
  },
  {
    id: "evt-3",
    title: "AI & Fullstack Workshop Series",
    date: "Spring 2025",
    attendance: 250,
    keyMetric: "500+ GitHub Repositories Starred",
    description: "Hands-on engineering workshops in AI, web development, and cloud.",
  },
];

export const SponsorshipProposalGenerator: React.FC<SponsorshipProposalGeneratorProps> = ({
  clubName = "Developer Student Club",
  clubTagline = "Empowering 1,500+ student engineers and builders on campus.",
  brandColor = "#6366f1",
  activeMembersCount = 500,
  availableEvents = MOCK_PAST_EVENTS,
  className,
}) => {
  const [targetSponsorName, setTargetSponsorName] = useState<string>("Google");
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>(() =>
    availableEvents.map((e) => e.id)
  );
  const [tiers, setTiers] = useState<SponsorshipTierProposal[]>(DEFAULT_SPONSORSHIP_TIERS);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  const selectedEvents = availableEvents.filter((e) => selectedEventIds.includes(e.id));
  const metrics = aggregateClubProposalMetrics(selectedEvents, activeMembersCount);

  const proposalData: ClubProposalData = {
    clubName,
    clubTagline,
    targetSponsorName,
    brandColor,
    totalReach: metrics.totalReach,
    avgAttendance: metrics.avgAttendance,
    activeMembersCount,
    csMajorPercent: metrics.csMajorPercent,
    highlightEvents: selectedEvents,
    sponsorshipTiers: tiers,
  };

  const handleToggleEvent = (id: string) => {
    if (selectedEventIds.includes(id)) {
      if (selectedEventIds.length > 1) {
        setSelectedEventIds(selectedEventIds.filter((eId) => eId !== id));
      }
    } else {
      if (selectedEventIds.length < 3) {
        setSelectedEventIds([...selectedEventIds, id]);
      }
    }
  };

  const handlePrintPdf = () => {
    const htmlContent = generateSponsorshipProposalHtml(proposalData);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const previewHtml = generateSponsorshipProposalHtml(proposalData);

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-amber-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-amber-950">
            <FileText className="w-5 h-5 text-amber-700" />
            <span>Sponsorship Pitch Deck Generator — {clubName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Generate stunning, data-backed corporate sponsorship proposals with hard demographic metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-3.5 py-2 border-2 border-black bg-white hover:bg-gray-100 font-bold text-xs uppercase rounded-md flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <Eye className="w-4 h-4 text-purple-600" />
            Live Preview
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-4 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <Printer className="w-4 h-4" />
            Download Proposal PDF
          </button>
        </div>
      </div>

      {/* Target Sponsor & Metric Summary Bar */}
      <div className="p-5 bg-white border-b-2 border-black grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <div className="md:col-span-2">
          <label htmlFor="sponsor-name-input" className="text-xs font-bold uppercase block text-gray-800 mb-1">
            Target Corporate Sponsor Name *
          </label>
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-gray-500" />
            <input
              id="sponsor-name-input"
              type="text"
              value={targetSponsorName}
              onChange={(e) => setTargetSponsorName(e.target.value)}
              placeholder="e.g. Google / Microsoft / Stripe"
              className="flex-1 px-3 py-1.5 border-2 border-black rounded-md text-xs font-bold bg-white"
            />
          </div>
        </div>

        <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-center">
          <div className="font-bold text-base text-indigo-900">{metrics.totalReach.toLocaleString()}+</div>
          <div className="text-[10px] uppercase font-bold text-indigo-700">Total Student Reach</div>
        </div>

        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
          <div className="font-bold text-base text-emerald-900">{metrics.avgAttendance.toLocaleString()}</div>
          <div className="text-[10px] uppercase font-bold text-emerald-700">Avg Event Attendance</div>
        </div>
      </div>

      {/* Main Grid: Highlight Events Selector & Tiers Customizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Highlight Events Selector */}
        <div className="p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Select Highlight Events ({selectedEventIds.length}/3)
            </h4>
            <span className="text-[11px] font-sans text-gray-500">Pick top 3 flagship events</span>
          </div>

          <div className="space-y-3">
            {availableEvents.map((evt) => {
              const isSelected = selectedEventIds.includes(evt.id);
              return (
                <div
                  key={evt.id}
                  onClick={() => handleToggleEvent(evt.id)}
                  className={cn(
                    "p-3.5 border-2 rounded-lg cursor-pointer transition-all space-y-1.5",
                    isSelected
                      ? "border-black bg-amber-50/80 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ring-1 ring-amber-400"
                      : "border-gray-300 bg-white hover:border-gray-500 opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-black">{evt.title}</span>
                    <span className="text-[10px] font-bold text-gray-500 font-mono">{evt.date}</span>
                  </div>
                  <p className="text-xs font-sans text-gray-600">{evt.description}</p>
                  <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-2">
                    <span>👥 {evt.attendance} Attendees</span>
                    <span>•</span>
                    <span>{evt.keyMetric}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sponsorship Tiers Preview & Benefit Matrix */}
        <div className="p-5 bg-slate-50 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-600" />
              Configured Sponsorship Tiers
            </h4>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
              3 Tiers Ready
            </span>
          </div>

          <div className="space-y-3">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="p-3.5 border-2 border-black rounded-lg bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-2"
              >
                <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                  <span className="font-bold text-xs text-black">{tier.name}</span>
                  <span className="font-bold text-sm text-amber-700">${tier.amount.toLocaleString()}</span>
                </div>
                <ul className="text-xs font-sans text-gray-600 space-y-1">
                  {tier.perks.map((perk, pIdx) => (
                    <li key={pIdx} className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Proposal Modal Preview */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-xl max-w-3xl w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-bold text-base uppercase flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Live Sponsorship Pitch Deck Preview
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="px-3 py-1 border border-black bg-black text-white rounded font-bold text-xs flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="px-3 py-1 border border-black bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="border border-gray-300 rounded-lg p-6 bg-white shadow-inner">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
