import React, { useState } from "react";
import {
  LeadScoreResult,
  LeadScoringMetrics,
  LeadTier,
  ScannedSponsorLead,
  SponsorScoringCriteria,
} from "@/types/sponsorLeadScoring";
import { sponsorLeadScoringService } from "@/services/sponsorLeadScoringService";
import { DynamicLeadScoreCard } from "./DynamicLeadScoreCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  SlidersHorizontal,
  Flame,
  Search,
  Download,
  RefreshCw,
  Sparkles,
  Award,
  Users,
  Target,
  BarChart3,
  Check,
} from "lucide-react";

export const SponsorLeadScoringDashboard: React.FC = () => {
  const [criteria, setCriteria] = useState<SponsorScoringCriteria>(
    sponsorLeadScoringService.getCriteria(),
  );

  const [scoredLeads, setScoredLeads] = useState<
    { lead: ScannedSponsorLead; result: LeadScoreResult }[]
  >(sponsorLeadScoringService.getAllLeadsWithScores());

  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    scoredLeads.length > 0 ? scoredLeads[0].lead.leadId : "",
  );

  const [tierFilter, setTierFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [metrics, setMetrics] = useState<LeadScoringMetrics>(
    sponsorLeadScoringService.getScoringMetrics(),
  );

  const [newSkill, setNewSkill] = useState("");

  const refreshData = () => {
    const updated = sponsorLeadScoringService.getAllLeadsWithScores();
    setScoredLeads(updated);
    setMetrics(sponsorLeadScoringService.getScoringMetrics());
  };

  const handleUpdateWeight = (
    key: keyof SponsorScoringCriteria["weights"],
    value: number,
  ) => {
    const updatedWeights = { ...criteria.weights, [key]: value };
    const updatedCriteria = sponsorLeadScoringService.updateCriteria({
      weights: updatedWeights,
    });
    setCriteria(updatedCriteria);
    refreshData();
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkill.trim()) return;
    if (criteria.requiredSkills.includes(newSkill.trim())) return;

    const updatedSkills = [...criteria.requiredSkills, newSkill.trim()];
    const updatedCriteria = sponsorLeadScoringService.updateCriteria({
      requiredSkills: updatedSkills,
    });
    setCriteria(updatedCriteria);
    setNewSkill("");
    refreshData();
  };

  const handleRemoveSkill = (skill: string) => {
    const updatedSkills = criteria.requiredSkills.filter((s) => s !== skill);
    const updatedCriteria = sponsorLeadScoringService.updateCriteria({
      requiredSkills: updatedSkills,
    });
    setCriteria(updatedCriteria);
    refreshData();
  };

  const filteredLeads = scoredLeads.filter(({ lead, result }) => {
    const matchesSearch =
      lead.candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.candidate.major.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.matchedSkills.some((s) =>
        s.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesTier =
      tierFilter === "all" ? true : result.tier === tierFilter;

    return matchesSearch && matchesTier;
  });

  const selectedLeadItem = scoredLeads.find(
    (item) => item.lead.leadId === selectedLeadId,
  ) || scoredLeads[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Dynamic Sponsor Lead Scoring
                </h1>
                <Badge className="bg-gradient-to-r from-amber-500 to-red-600 text-white text-xs border-0 shadow-md">
                  Real-Time Multi-Vector AI
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Multi-dimensional candidate scoring algorithm evaluating academic fit, engagement, skill match & recruitment intent.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              sponsorLeadScoringService.resetToSample();
              setCriteria(sponsorLeadScoringService.getCriteria());
              refreshData();
            }}
            className="border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reset Demo
          </Button>

          <Button
            size="sm"
            onClick={() => alert(`Exported ${scoredLeads.length} scored sponsor leads to CSV!`)}
            className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow-lg"
          >
            <Download className="h-4 w-4 mr-1.5" /> Export Scored Leads
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md">
          <div className="flex justify-between text-xs text-slate-400 font-semibold uppercase">
            <span>Total Scanned</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-3xl font-black text-white">{metrics.totalLeadsScanned}</div>
          <div className="mt-1 text-[11px] text-blue-400 font-medium">Booth Scans Logged</div>
        </div>

        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 backdrop-blur-md">
          <div className="flex justify-between text-xs text-red-400 font-semibold uppercase">
            <span>Hot Leads 🔥</span>
            <Flame className="h-4 w-4 text-red-400" />
          </div>
          <div className="mt-2 text-3xl font-black text-white">{metrics.hotLeadsCount}</div>
          <div className="mt-1 text-[11px] text-red-400 font-medium">Score ≥ 80 PTS (Priority)</div>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 backdrop-blur-md">
          <div className="flex justify-between text-xs text-amber-400 font-semibold uppercase">
            <span>Warm Leads ☀️</span>
            <Target className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-3xl font-black text-white">{metrics.warmLeadsCount}</div>
          <div className="mt-1 text-[11px] text-amber-400 font-medium">Score 60 - 79 PTS</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md">
          <div className="flex justify-between text-xs text-slate-400 font-semibold uppercase">
            <span>Avg Match Score</span>
            <BarChart3 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-black text-white">{metrics.avgOverallScore}</div>
          <div className="mt-1 text-[11px] text-emerald-400 font-medium">Real-time weighted avg</div>
        </div>
      </div>

      {/* Main Layout: Criteria Controls & Ranked Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Criteria & Vector Weight Tuner */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <SlidersHorizontal className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Algorithm Vector Weights
              </h3>
            </div>

            {/* Vector Sliders */}
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between font-semibold text-slate-300">
                  <span>Academic Fit (25%)</span>
                  <span className="font-mono text-blue-400">{Math.round(criteria.weights.academicWeight * 100)}%</span>
                </div>
                <Slider
                  value={[criteria.weights.academicWeight * 100]}
                  min={0}
                  max={50}
                  step={5}
                  onValueChange={([val]) => handleUpdateWeight("academicWeight", val / 100)}
                  className="mt-2"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-300">
                  <span>Engagement Depth (30%)</span>
                  <span className="font-mono text-purple-400">{Math.round(criteria.weights.engagementWeight * 100)}%</span>
                </div>
                <Slider
                  value={[criteria.weights.engagementWeight * 100]}
                  min={0}
                  max={50}
                  step={5}
                  onValueChange={([val]) => handleUpdateWeight("engagementWeight", val / 100)}
                  className="mt-2"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-300">
                  <span>Skill Match (25%)</span>
                  <span className="font-mono text-emerald-400">{Math.round(criteria.weights.skillWeight * 100)}%</span>
                </div>
                <Slider
                  value={[criteria.weights.skillWeight * 100]}
                  min={0}
                  max={50}
                  step={5}
                  onValueChange={([val]) => handleUpdateWeight("skillWeight", val / 100)}
                  className="mt-2"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-300">
                  <span>Recruitment Intent (20%)</span>
                  <span className="font-mono text-amber-400">{Math.round(criteria.weights.intentWeight * 100)}%</span>
                </div>
                <Slider
                  value={[criteria.weights.intentWeight * 100]}
                  min={0}
                  max={50}
                  step={5}
                  onValueChange={([val]) => handleUpdateWeight("intentWeight", val / 100)}
                  className="mt-2"
                />
              </div>
            </div>
          </div>

          {/* Required Skills Tuner */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Target Required Skills
              </span>
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                {criteria.requiredSkills.length} Required
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {criteria.requiredSkills.map((skill) => (
                <span
                  key={skill}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5"
                >
                  <span>{skill}</span>
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="hover:text-red-400 text-slate-400 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAddSkill} className="flex gap-2 pt-2">
              <Input
                placeholder="Add skill requirement (e.g. PyTorch)..."
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-white"
              />
              <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs">
                Add
              </Button>
            </form>
          </div>
        </div>

        {/* Right Column: Ranked Lead Leaderboard & Detailed Score Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* Detailed Score Card for Selected Candidate */}
          {selectedLeadItem && (
            <DynamicLeadScoreCard
              lead={selectedLeadItem.lead}
              scoreResult={selectedLeadItem.result}
              onUpdate={refreshData}
            />
          )}

          {/* Ranked Leaderboard Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Scored Candidate Leaderboard</h3>
                <p className="text-xs text-slate-400">
                  Real-time ranked sponsor leads dynamically updated as algorithm weights adjust
                </p>
              </div>

              {/* Filter & Search */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <Input
                    placeholder="Search candidate..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 bg-slate-950 border-slate-800 text-xs text-white h-8"
                  />
                </div>

                <div className="flex gap-1">
                  {["all", "hot", "warm", "cool"].map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setTierFilter(tier)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                        tierFilter === tier
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Candidate</th>
                    <th className="py-2.5 px-3">Major & Grad</th>
                    <th className="py-2.5 px-3">Match Tier</th>
                    <th className="py-2.5 px-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLeads.map(({ lead, result }, idx) => {
                    const isSelected = selectedLeadId === lead.leadId;
                    return (
                      <tr
                        key={lead.leadId}
                        onClick={() => setSelectedLeadId(lead.leadId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-amber-500/10 border-l-4 border-l-amber-500"
                            : "hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-400">
                          #{idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={lead.candidate.avatar}
                              alt={lead.candidate.name}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                            <span className="font-bold text-white">{lead.candidate.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          <div>{lead.candidate.major}</div>
                          <div className="text-[10px] text-slate-500">Class of {lead.candidate.graduationYear}</div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            className={`text-[10px] font-bold ${
                              result.tier === "hot"
                                ? "bg-red-500/20 text-red-400 border-red-500/30"
                                : result.tier === "warm"
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                            }`}
                          >
                            {result.tier.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-sm text-white font-mono">
                          {result.overallScore}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
