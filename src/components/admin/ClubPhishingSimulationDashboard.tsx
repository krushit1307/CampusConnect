import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Mail,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  Zap,
  Lock,
  Unlock,
  Send,
  Eye,
  Building,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  OfficerSimulationResult,
  PhishingSecuritySummary,
  PhishingSimulationStatus,
} from "@/types/clubPhishingSimulation";
import {
  clubPhishingSimulationService,
  DEFAULT_PHISHING_TEMPLATES,
} from "@/services/clubPhishingSimulationService";

export function ClubPhishingSimulationDashboard() {
  const [results, setResults] = useState<OfficerSimulationResult[]>([]);
  const [activeTab, setActiveTab] = useState<"roster" | "templates" | "summary">("roster");
  const [selectedOfficer, setSelectedOfficer] = useState<OfficerSimulationResult | null>(null);
  const [showRetrainingModal, setShowRetrainingModal] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string>("tpl-grant-wire");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const data = clubPhishingSimulationService.getAllResults();
    setResults([...data]);
  };

  const handleTriggerAction = (resultId: string, action: "REPORT" | "CLICK" | "SUBMIT_CREDENTIALS") => {
    const updated = clubPhishingSimulationService.recordOfficerAction(resultId, action);
    loadData();
    setActionNotice(
      action === "REPORT"
        ? `Prompt reporting recorded for ${updated.officerName}. Security compliance passed!`
        : `Simulated breach recorded for ${updated.officerName}. Budget authorization gated until retraining.`,
    );
  };

  const handleCompleteRetraining = (resultId: string) => {
    const updated = clubPhishingSimulationService.completeOfficerRetraining(resultId);
    loadData();
    setShowRetrainingModal(false);
    setSelectedOfficer(null);
    setActionNotice(`Retraining completed for ${updated.officerName}. Budget authorization un-gated!`);
  };

  const handleGenerateNewCampaign = () => {
    clubPhishingSimulationService.generateCampaign(
      "Automated Fall Leadership Phishing Assessment",
    );
    loadData();
    setActionNotice("New simulation campaign triggered for all active club executive officers!");
  };

  const getStatusBadge = (status: PhishingSimulationStatus) => {
    switch (status) {
      case "PASSED_REPORTED":
        return <Badge className="bg-emerald-600 text-white font-mono uppercase">Passed (Reported)</Badge>;
      case "COMPLIANT_CLEARED":
        return <Badge className="bg-emerald-500 text-white font-mono uppercase">Retrained & Cleared</Badge>;
      case "FAILED_CLICKED":
        return <Badge className="bg-amber-600 text-white font-mono uppercase">Failed (Clicked Link)</Badge>;
      case "FAILED_CREDENTIALS":
        return <Badge className="bg-red-600 text-white font-mono uppercase">Critical (Credentials Submitted)</Badge>;
      default:
        return <Badge className="bg-blue-600 text-white font-mono uppercase font-semibold">Simulated Email Sent</Badge>;
    }
  };

  const roboticsSummary = clubPhishingSimulationService.getClubSecuritySummary("club-robotics");
  const financeSummary = clubPhishingSimulationService.getClubSecuritySummary("club-finance");

  return (
    <div
      data-testid="phishing-simulation-dashboard"
      className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-indigo-900/40 text-slate-100 shadow-2xl space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-950/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-indigo-400" />
            <h2 className="text-xl md:text-2xl font-bold font-display tracking-tight text-white">
              Club Leadership Mandatory Phishing Simulation
            </h2>
            <Badge className="bg-indigo-600 text-white font-mono uppercase">Security Awareness</Badge>
          </div>
          <p className="text-xs md:text-sm text-slate-400 font-mono mt-1">
            Automated simulation scenarios, engagement tracking & budget authorization gating for club executives
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleGenerateNewCampaign}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs uppercase px-4 py-2 font-bold transition shadow-lg"
          >
            <Send className="w-3.5 h-3.5 mr-2" />
            Trigger Campaign
          </Button>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-between text-xs font-mono text-indigo-200 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {/* Security Health Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs font-mono uppercase text-slate-400">Total Officers Screened</span>
          <div className="text-2xl font-extrabold text-white mt-1 font-mono">{results.length}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Presidents & Treasurers</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs font-mono uppercase text-slate-400">Robotics Society Pass Rate</span>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
            {roboticsSummary.passRatePercentage}%
          </div>
          <span className="text-[11px] text-emerald-300/80 mt-1 block font-mono">
            Grade: {roboticsSummary.overallRiskGrade}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs font-mono uppercase text-slate-400">Investment Fund Pass Rate</span>
          <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">
            {financeSummary.passRatePercentage}%
          </div>
          <span className="text-[11px] text-amber-300/80 mt-1 block font-mono">
            Grade: {financeSummary.overallRiskGrade}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs font-mono uppercase text-slate-400">Budget Sign-off Gated</span>
          <div className="text-2xl font-extrabold text-red-400 mt-1 font-mono">
            {results.filter((r) => r.isBudgetAuthorizationGated).length}
          </div>
          <span className="text-[11px] text-red-300/80 mt-1 block">Retraining mandatory</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 text-xs font-mono">
        <button
          onClick={() => setActiveTab("roster")}
          className={`px-4 py-2 border-b-2 font-semibold transition ${
            activeTab === "roster"
              ? "border-indigo-500 text-indigo-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Executive Roster & Simulation Status ({results.length})
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2 border-b-2 font-semibold transition ${
            activeTab === "templates"
              ? "border-indigo-500 text-indigo-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Phishing Scenario Templates ({DEFAULT_PHISHING_TEMPLATES.length})
        </button>
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 border-b-2 font-semibold transition ${
            activeTab === "summary"
              ? "border-indigo-500 text-indigo-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Student Union Compliance Overview
        </button>
      </div>

      {/* Tab: Executive Roster */}
      {activeTab === "roster" && (
        <div className="space-y-4" data-testid="roster-tab">
          <div className="grid grid-cols-1 gap-3">
            {results.map((officer) => (
              <div
                key={officer.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-indigo-900/50 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-base">{officer.officerName}</span>
                    <Badge variant="outline" className="text-[10px] font-mono border-slate-700 text-slate-300">
                      {officer.officerRole} ({officer.clubName})
                    </Badge>
                    {getStatusBadge(officer.status)}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Scenario: <span className="text-slate-200 font-semibold">{officer.scenarioTitle}</span> | Target Email: {officer.officerEmail}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Budget authorization status badge */}
                  {officer.isBudgetAuthorizationGated ? (
                    <Badge className="bg-red-950/60 text-red-400 border border-red-800/60 font-mono text-[11px] flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Budget Sign-off Blocked
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-mono text-[11px] flex items-center gap-1">
                      <Unlock className="w-3 h-3" /> Budget Sign-off Authorized
                    </Badge>
                  )}

                  {/* Interactive test actions */}
                  {officer.status === "DELIVERED" && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTriggerAction(officer.id, "REPORT")}
                        className="h-7 text-xs border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/40 font-mono"
                      >
                        Simulate Report
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTriggerAction(officer.id, "CLICK")}
                        className="h-7 text-xs border-amber-700/60 text-amber-300 hover:bg-amber-900/40 font-mono"
                      >
                        Simulate Click
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTriggerAction(officer.id, "SUBMIT_CREDENTIALS")}
                        className="h-7 text-xs border-red-700/60 text-red-300 hover:bg-red-900/40 font-mono"
                      >
                        Simulate Compromise
                      </Button>
                    </div>
                  )}

                  {/* Retraining action button */}
                  {officer.isBudgetAuthorizationGated && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedOfficer(officer);
                        setShowRetrainingModal(true);
                      }}
                      className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-mono text-xs uppercase px-3 font-bold"
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-1" />
                      Complete Retraining
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Phishing Templates */}
      {activeTab === "templates" && (
        <div className="space-y-4" data-testid="templates-tab">
          <p className="text-xs text-slate-400 font-mono">
            Security awareness simulation scenarios sent to club leadership to train vulnerability detection.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DEFAULT_PHISHING_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[10px] uppercase font-mono border-indigo-700 text-indigo-300">
                      {tpl.category}
                    </Badge>
                    <Badge className="bg-slate-800 text-slate-300 font-mono text-[10px]">
                      {tpl.difficultyRating}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-slate-100 text-sm mt-2">{tpl.subject}</h4>
                  <p className="text-xs text-slate-400 font-mono mt-1">From: {tpl.senderName} ({tpl.senderEmail})</p>
                  <p className="text-xs text-slate-300 italic bg-slate-950/60 p-2.5 rounded border border-slate-800/80 mt-2 font-sans">
                    "{tpl.bodyPreview}"
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block mb-1">
                    Red Flags Included:
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-400 font-mono">
                    {tpl.redFlags.map((flag, idx) => (
                      <li key={idx}>• {flag}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Summary */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="summary-tab">
          {[roboticsSummary, financeSummary].map((summary) => (
            <div key={summary.clubId} className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-100 text-base">{summary.clubName}</h4>
                  <span className="text-xs text-slate-400 font-mono">
                    {summary.totalLeadershipOfficers} Executive Officers Evaluated
                  </span>
                </div>
                <Badge
                  className={`font-mono text-xs ${
                    summary.overallRiskGrade === "A_EXCELLENT"
                      ? "bg-emerald-600"
                      : summary.overallRiskGrade === "B_GOOD"
                      ? "bg-blue-600"
                      : "bg-amber-600"
                  }`}
                >
                  Grade: {summary.overallRiskGrade}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-xs text-center">
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Pass Rate</span>
                  <span className="text-base font-bold text-emerald-400">{summary.passRatePercentage}%</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Compliant</span>
                  <span className="text-base font-bold text-slate-100">{summary.compliantCount}</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Retraining Required</span>
                  <span className="text-base font-bold text-red-400">{summary.activeRetrainingMandates}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Retraining Modal */}
      {showRetrainingModal && selectedOfficer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 text-slate-100">
            <div className="flex items-center gap-3 text-amber-400">
              <BookOpen className="w-6 h-6" />
              <h4 className="text-lg font-bold font-display uppercase">Mandatory Security Retraining</h4>
            </div>

            <p className="text-xs text-slate-300 font-mono">
              Officer <span className="font-bold text-white">{selectedOfficer.officerName}</span> ({selectedOfficer.officerRole}) failed the simulated security awareness test.
            </p>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-2">
              <span className="text-amber-400 font-bold block">Micro-Learning Module: Identifying Domain Spoofing</span>
              <p className="text-slate-400">
                1. Always verify email sender domains (e.g. @campus.edu vs @campus-portal.net).
              </p>
              <p className="text-slate-400">
                2. Never input password or financial credentials from links received via unverified emails.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRetrainingModal(false)}
                className="border-slate-700 text-slate-300 font-mono"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => handleCompleteRetraining(selectedOfficer.id)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold"
                data-testid="complete-retraining-btn"
              >
                Mark Retraining Completed & Un-gate Budget
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
