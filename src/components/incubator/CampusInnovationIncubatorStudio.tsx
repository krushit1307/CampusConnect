import React, { useState, useMemo } from 'react';
import {
  Rocket,
  TrendingUp,
  DollarSign,
  Briefcase,
  Search,
  Filter,
  Download,
  Award,
  BarChart3,
  Layers,
  ExternalLink,
  ShieldCheck,
  Zap,
  Users
} from 'lucide-react';
import { IncubatorStartupRecord, IncubatorMilestone, IncubatorFilterState } from '../../types/campusIncubator';

/**
 * Props for the Enterprise Campus Innovation & Startup Incubator Studio
 */
interface CampusInnovationIncubatorStudioProps {
  initialStartups?: IncubatorStartupRecord[];
  initialMilestones?: IncubatorMilestone[];
  onExportTelemetry?: (manifest: string) => void;
}

const DEFAULT_STARTUP_RECORDS: IncubatorStartupRecord[] = [
  {
    id: 'STARTUP-INC-8801',
    startupName: 'NeuroPulse Health AI',
    founderName: 'Aarav Sharma & Priya Patel',
    domainSector: 'HEALTH_TECH',
    incubatorCohort: 'Cohort 2025-A',
    ventureCapitalRaisedUSD: 1500000,
    incubationGrantUSD: 250000,
    incubationStage: 'SERIES_A_READY',
    patentFiledCount: 3,
    valuationRatingUSD: 8500000,
    tractionScore: 96
  },
  {
    id: 'STARTUP-INC-8802',
    startupName: 'EcoVolt Solid-State Batteries',
    founderName: 'Rohan Deshmukh',
    domainSector: 'CLEAN_ENERGY',
    incubatorCohort: 'Cohort 2024-B',
    ventureCapitalRaisedUSD: 3200000,
    incubationGrantUSD: 500000,
    incubationStage: 'SCALE_UP_GROWTH',
    patentFiledCount: 5,
    valuationRatingUSD: 14000000,
    tractionScore: 98
  },
  {
    id: 'STARTUP-INC-8803',
    startupName: 'AgriSense Autonomous Drones',
    founderName: 'Ananya Roy & Team',
    domainSector: 'AGRI_TECH',
    incubatorCohort: 'Cohort 2025-B',
    ventureCapitalRaisedUSD: 800000,
    incubationGrantUSD: 150000,
    incubationStage: 'EARLY_TRACTION',
    patentFiledCount: 2,
    valuationRatingUSD: 4200000,
    tractionScore: 91
  },
  {
    id: 'STARTUP-INC-8804',
    startupName: 'CyberGuard Post-Quantum Auth',
    founderName: 'Karan Malhotra',
    domainSector: 'CYBERSECURITY',
    incubatorCohort: 'Cohort 2026-A',
    ventureCapitalRaisedUSD: 4500000,
    incubationGrantUSD: 600000,
    incubationStage: 'SERIES_A_READY',
    patentFiledCount: 4,
    valuationRatingUSD: 22000000,
    tractionScore: 99
  },
  {
    id: 'STARTUP-INC-8805',
    startupName: 'EduVerse VR Classrooms',
    founderName: 'Meera Kapoor',
    domainSector: 'ED_TECH',
    incubatorCohort: 'Cohort 2026-A',
    ventureCapitalRaisedUSD: 400000,
    incubationGrantUSD: 100000,
    incubationStage: 'SEED_MVP_PROTOTYPE',
    patentFiledCount: 1,
    valuationRatingUSD: 2100000,
    tractionScore: 87
  }
];

const DEFAULT_MILESTONES: IncubatorMilestone[] = [
  {
    milestoneId: 'INC-M-01',
    startupId: 'STARTUP-INC-8801',
    title: 'FDA Class II Medical Software Pre-Submission',
    targetDate: '2026-05-15',
    status: 'VERIFIED',
    trancheReleaseUSD: 100000
  },
  {
    milestoneId: 'INC-M-02',
    startupId: 'STARTUP-INC-8802',
    title: '1MWh Pilot Battery Pack Commercial Deployment',
    targetDate: '2026-07-30',
    status: 'IN_PROGRESS',
    trancheReleaseUSD: 200000
  }
];

export const CampusInnovationIncubatorStudio: React.FC<CampusInnovationIncubatorStudioProps> = ({
  initialStartups = DEFAULT_STARTUP_RECORDS,
  initialMilestones = DEFAULT_MILESTONES,
  onExportTelemetry
}) => {
  const [startups] = useState<IncubatorStartupRecord[]>(initialStartups);
  const [milestones] = useState<IncubatorMilestone[]>(initialMilestones);
  const [filters, setFilters] = useState<IncubatorFilterState>({
    searchQuery: '',
    sectorFilter: 'ALL',
    stageFilter: 'ALL',
    minValuationUSD: 0
  });

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const filteredStartups = useMemo(() => {
    return startups.filter((startup) => {
      if (filters.searchQuery.trim() !== '') {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = startup.startupName.toLowerCase().includes(query);
        const matchesFounder = startup.founderName.toLowerCase().includes(query);
        const matchesCohort = startup.incubatorCohort.toLowerCase().includes(query);
        if (!matchesName && !matchesFounder && !matchesCohort) return false;
      }

      if (filters.sectorFilter !== 'ALL' && startup.domainSector !== filters.sectorFilter) {
        return false;
      }

      if (filters.stageFilter !== 'ALL' && startup.incubationStage !== filters.stageFilter) {
        return false;
      }

      if (startup.valuationRatingUSD < filters.minValuationUSD) {
        return false;
      }

      return true;
    });
  }, [startups, filters]);

  const totalVCRaisedUSD = useMemo(() => {
    return startups.reduce((acc, curr) => acc + curr.ventureCapitalRaisedUSD, 0);
  }, [startups]);

  const averageTractionScore = useMemo(() => {
    if (startups.length === 0) return 0;
    const sum = startups.reduce((acc, curr) => acc + curr.tractionScore, 0);
    return Math.round(sum / startups.length);
  }, [startups]);

  const handleExportManifest = () => {
    const manifestData = JSON.stringify({
      timestamp: new Date().toISOString(),
      totalVCRaisedUSD: totalVCRaisedUSD,
      totalIncubatedStartups: startups.length,
      filteredCount: filteredStartups.length,
      records: filteredStartups
    }, null, 2);

    if (onExportTelemetry) {
      onExportTelemetry(manifestData);
    } else {
      const blob = new Blob([manifestData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incubator_telemetry_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-50 p-6 md:p-10 font-sans">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-900/50 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Rocket className="w-7 h-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-100 via-amber-200 to-amber-400 bg-clip-text text-transparent">
                CampusConnect Innovation & Venture Incubator Studio
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Enterprise Student Startup Acceleration, Valuation Telemetry & Patent Verification Engine
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs font-semibold text-amber-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            Venture Acceleration GIS Live Stream
          </span>
          <button
            onClick={handleExportManifest}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-sm transition shadow-lg shadow-amber-950/40"
          >
            <Download className="w-4 h-4" />
            Export Telemetry
          </button>
        </div>
      </header>

      {/* Top Quad Metric Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-slate-900/80 border border-amber-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Total VC Capital Raised</span>
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            ${(totalVCRaisedUSD / 1000000).toFixed(2)}M USD
          </div>
          <div className="text-xs text-amber-400/80 mt-1 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" /> +32.4% YoY Venture Inflow
          </div>
        </div>

        <div className="bg-slate-900/80 border border-amber-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Incubated Startups</span>
            <Briefcase className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            {startups.length} Active Ventures
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across 5 Technology Cohorts
          </div>
        </div>

        <div className="bg-slate-900/80 border border-amber-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Average Traction Score</span>
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            {averageTractionScore} / 100
          </div>
          <div className="text-xs text-amber-400 mt-1 font-medium">
            High Commercial Market Viability
          </div>
        </div>

        <div className="bg-slate-900/80 border border-amber-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Patents Filed</span>
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            15 IP Patents
          </div>
          <div className="text-xs text-slate-400 mt-1">
            USPTO & Indian Patent Office Certified
          </div>
        </div>
      </section>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Filter & Controls Panel */}
        <aside className="lg:col-span-4 bg-slate-900/80 border border-amber-900/40 rounded-2xl p-6 backdrop-blur-md h-fit">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Filter className="w-5 h-5 text-amber-400" />
              Venture Search & Filters
            </h2>
            <span className="text-xs bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded">
              Filter Engine
            </span>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Search Startup / Founder / Cohort
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. NeuroPulse, Aarav, Cohort 2025..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Technology Domain Sector
              </label>
              <select
                value={filters.sectorFilter}
                onChange={(e) => setFilters({ ...filters, sectorFilter: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition"
              >
                <option value="ALL">All Domain Sectors</option>
                <option value="HEALTH_TECH">HealthTech & Medical AI</option>
                <option value="CLEAN_ENERGY">Clean Energy & EV Storage</option>
                <option value="AGRI_TECH">AgriTech & Drones</option>
                <option value="CYBERSECURITY">Cybersecurity & Cryptography</option>
                <option value="ED_TECH">EdTech & AR/VR</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Incubation Lifecycle Stage
              </label>
              <select
                value={filters.stageFilter}
                onChange={(e) => setFilters({ ...filters, stageFilter: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500 transition"
              >
                <option value="ALL">All Incubation Stages</option>
                <option value="SEED_MVP_PROTOTYPE">Seed MVP Prototype</option>
                <option value="EARLY_TRACTION">Early Commercial Traction</option>
                <option value="SERIES_A_READY">Series A Institutional Ready</option>
                <option value="SCALE_UP_GROWTH">Scale-Up Growth Phase</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-300 mb-1.5">
                <span>Minimum Startup Valuation</span>
                <span className="text-amber-400 font-mono">${(filters.minValuationUSD / 1000000).toFixed(1)}M USD</span>
              </div>
              <input
                type="range"
                min="0"
                max="25000000"
                step="1000000"
                value={filters.minValuationUSD}
                onChange={(e) => setFilters({ ...filters, minValuationUSD: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setFilters({ searchQuery: '', sectorFilter: 'ALL', stageFilter: 'ALL', minValuationUSD: 0 })}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Reset Controls
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              Milestone Disbursal Summary
            </h3>
            {milestones.map((m, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl">
                <div className="flex justify-between text-xs font-medium text-slate-200">
                  <span>{m.title}</span>
                  <span className="text-amber-400 font-mono">${(m.trancheReleaseUSD / 1000).toFixed(0)}k</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                  <span>Target: {m.targetDate}</span>
                  <span className="text-amber-300 font-semibold">{m.status}</span>
                </div>
              </div>
            ))}
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full mt-2 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4" />
              View Acceleration Milestones
            </button>
          </div>
        </aside>

        {/* Right Records Display Panel */}
        <section className="lg:col-span-8 bg-slate-900/80 border border-amber-900/40 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Incubated Venture Registry</h2>
              <p className="text-xs text-slate-400">Showing {filteredStartups.length} of {startups.length} ventures</p>
            </div>
            <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-mono">
              Live GIS Registry
            </span>
          </div>

          <div className="space-y-4">
            {filteredStartups.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p className="text-base font-semibold">No incubated ventures match the filter criteria.</p>
                <p className="text-xs mt-1">Try resetting valuation thresholds or sector selections.</p>
              </div>
            ) : (
              filteredStartups.map((startup) => (
                <div
                  key={startup.id}
                  className="bg-slate-950 border border-slate-800/80 hover:border-amber-500/40 rounded-xl p-5 transition group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-300 transition">
                          {startup.startupName}
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs font-mono rounded">
                          {startup.incubatorCohort}
                        </span>
                      </div>
                      <p className="text-xs text-amber-400 font-medium mt-0.5">
                        Founders: {startup.founderName} &bull; {startup.domainSector.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-amber-400 font-mono">
                        ${(startup.valuationRatingUSD / 1000000).toFixed(2)}M Valuation
                      </span>
                      <span className="block text-[10px] text-slate-500 uppercase tracking-wider">
                        VC Raised: ${(startup.ventureCapitalRaisedUSD / 1000000).toFixed(2)}M
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-slate-800/60 pt-3 mt-3">
                    <div className="text-slate-400">
                      Grant Funded: <span className="text-slate-200 font-medium">${startup.incubationGrantUSD.toLocaleString()} USD</span>
                    </div>
                    <div className="text-slate-400 sm:text-right">
                      Stage: <span className="text-amber-300 font-semibold">{startup.incubationStage.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-2 text-xs text-slate-500 border-t border-slate-900">
                    <span className="flex items-center gap-1 font-mono">
                      Patents Filed: <strong className="text-amber-400">{startup.patentFiledCount} IP Patents</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                      Verified Incubator Asset
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Milestone Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Venture Acceleration Milestones
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              {milestones.map((m, i) => (
                <div key={i} className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex justify-between font-bold text-sm text-slate-200">
                    <span>{m.title}</span>
                    <span className="text-amber-400 font-mono">${(m.trancheReleaseUSD / 1000).toFixed(0)}k Tranche</span>
                  </div>
                  <div className="text-xs text-slate-400 flex justify-between">
                    <span>Target Date: {m.targetDate}</span>
                    <span>Status: {m.status}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
              >
                Close Overview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
