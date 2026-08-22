import React, { useState, useMemo } from 'react';
import {
  FileText,
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
  ShieldCheck
} from 'lucide-react';
import { ResearchGrantRecord, GrantMilestone, GrantFilterState } from '../../types/researchGrant';

/**
 * Props for the Enterprise Campus Research Grant & Sponsored Projects Telemetry Suite
 */
interface CampusResearchGrantAnalyticsProps {
  initialGrants?: ResearchGrantRecord[];
  initialMilestones?: GrantMilestone[];
  onExportTelemetry?: (manifest: string) => void;
}

const DEFAULT_GRANT_RECORDS: ResearchGrantRecord[] = [
  {
    id: 'GRANT-NSF-9901',
    projectTitle: 'Autonomous Swarm Robotics for Disaster Relief GIS',
    principalInvestigator: 'Dr. Aris Thorne',
    academicDepartment: 'School of Robotics & Autonomous Systems',
    fundingAgency: 'National Science Foundation (NSF)',
    totalGrantAmountUSD: 3500000,
    disbursedFundsUSD: 2100000,
    grantCategory: 'FEDERAL_FUNDED',
    grantStatus: 'ACTIVE_DISBURSEMENT',
    awardDate: '2025-09-01',
    complianceRating: 99
  },
  {
    id: 'GRANT-NIH-9902',
    projectTitle: 'Genomic CRISPR Diagnostics for Rare Neurological Disorders',
    principalInvestigator: 'Dr. Elena Rostova',
    academicDepartment: 'Department of Bioengineering & Health',
    fundingAgency: 'National Institutes of Health (NIH)',
    totalGrantAmountUSD: 4200000,
    disbursedFundsUSD: 4200000,
    grantCategory: 'FEDERAL_FUNDED',
    grantStatus: 'COMPLETED_SUCCESSFUL',
    awardDate: '2024-06-15',
    complianceRating: 97
  },
  {
    id: 'GRANT-IND-9903',
    projectTitle: 'Next-Gen Solid State Battery Electrolytes for Micro-Grid Storage',
    principalInvestigator: 'Prof. Marcus Vance',
    academicDepartment: 'Department of Materials Science & Clean Energy',
    fundingAgency: 'Tesla Energy Research Consortium',
    totalGrantAmountUSD: 1800000,
    disbursedFundsUSD: 900000,
    grantCategory: 'CORPORATE_SPONSORED',
    grantStatus: 'ACTIVE_DISBURSEMENT',
    awardDate: '2026-01-10',
    complianceRating: 95
  },
  {
    id: 'GRANT-DAR-9904',
    projectTitle: 'Post-Quantum Cryptographic Key Distribution Protocols',
    principalInvestigator: 'Dr. Samir Al-Mansoor',
    academicDepartment: 'Department of Computer Science & Cybersecurity',
    fundingAgency: 'DARPA Cyber Division',
    totalGrantAmountUSD: 6000000,
    disbursedFundsUSD: 3000000,
    grantCategory: 'DEFENSE_CONTRACT',
    grantStatus: 'UNDER_AUDIT_REVIEW',
    awardDate: '2025-11-20',
    complianceRating: 92
  },
  {
    id: 'GRANT-FOUND-9905',
    projectTitle: 'Socio-Economic Impact of Algorithmic Micro-Loans in Rural India',
    principalInvestigator: 'Dr. Kavita Menon',
    academicDepartment: 'School of Public Policy & Global Economics',
    fundingAgency: 'Bill & Melinda Gates Foundation',
    totalGrantAmountUSD: 950000,
    disbursedFundsUSD: 600000,
    grantCategory: 'FOUNDATION_GRANT',
    grantStatus: 'ACTIVE_DISBURSEMENT',
    awardDate: '2026-02-01',
    complianceRating: 98
  }
];

const DEFAULT_MILESTONES: GrantMilestone[] = [
  {
    milestoneId: 'M-01',
    grantId: 'GRANT-NSF-9901',
    title: 'Phase I Swarm Algorithm Simulation Baseline',
    targetDate: '2026-04-15',
    status: 'VERIFIED',
    trancheAmountUSD: 700000
  },
  {
    milestoneId: 'M-02',
    grantId: 'GRANT-IND-9903',
    title: 'Prototype Cleanroom Battery Cell Validation',
    targetDate: '2026-06-30',
    status: 'IN_PROGRESS',
    trancheAmountUSD: 450000
  }
];

export const CampusResearchGrantAnalytics: React.FC<CampusResearchGrantAnalyticsProps> = ({
  initialGrants = DEFAULT_GRANT_RECORDS,
  initialMilestones = DEFAULT_MILESTONES,
  onExportTelemetry
}) => {
  const [grants] = useState<ResearchGrantRecord[]>(initialGrants);
  const [milestones] = useState<GrantMilestone[]>(initialMilestones);
  const [filters, setFilters] = useState<GrantFilterState>({
    searchQuery: '',
    categoryFilter: 'ALL',
    statusFilter: 'ALL',
    minGrantAmountUSD: 0
  });

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const filteredGrants = useMemo(() => {
    return grants.filter((grant) => {
      if (filters.searchQuery.trim() !== '') {
        const query = filters.searchQuery.toLowerCase();
        const matchesTitle = grant.projectTitle.toLowerCase().includes(query);
        const matchesPI = grant.principalInvestigator.toLowerCase().includes(query);
        const matchesAgency = grant.fundingAgency.toLowerCase().includes(query);
        if (!matchesTitle && !matchesPI && !matchesAgency) return false;
      }

      if (filters.categoryFilter !== 'ALL' && grant.grantCategory !== filters.categoryFilter) {
        return false;
      }

      if (filters.statusFilter !== 'ALL' && grant.grantStatus !== filters.statusFilter) {
        return false;
      }

      if (grant.totalGrantAmountUSD < filters.minGrantAmountUSD) {
        return false;
      }

      return true;
    });
  }, [grants, filters]);

  const totalResearchFundingUSD = useMemo(() => {
    return grants.reduce((acc, curr) => acc + curr.totalGrantAmountUSD, 0);
  }, [grants]);

  const averageComplianceRating = useMemo(() => {
    if (grants.length === 0) return 0;
    const sum = grants.reduce((acc, curr) => acc + curr.complianceRating, 0);
    return Math.round(sum / grants.length);
  }, [grants]);

  const handleExportManifest = () => {
    const manifestData = JSON.stringify({
      timestamp: new Date().toISOString(),
      totalFundingUSD: totalResearchFundingUSD,
      totalActiveGrants: grants.length,
      filteredCount: filteredGrants.length,
      records: filteredGrants
    }, null, 2);

    if (onExportTelemetry) {
      onExportTelemetry(manifestData);
    } else {
      const blob = new Blob([manifestData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `research_grants_telemetry_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-50 p-6 md:p-10 font-sans">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-900/50 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <FileText className="w-7 h-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-100 via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                CampusConnect Research Grant & Sponsored Projects Telemetry
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Enterprise Academic Research Capital, Grant Milestone Verification & Compliance Scorecard
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-xs font-semibold text-indigo-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            Sponsored Projects Live GIS Stream
          </span>
          <button
            onClick={handleExportManifest}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-950 font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-950/40"
          >
            <Download className="w-4 h-4" />
            Export Telemetry
          </button>
        </div>
      </header>

      {/* Top Quad Metric Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-slate-900/80 border border-indigo-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Total Sponsored Portfolio</span>
            <DollarSign className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            ${(totalResearchFundingUSD / 1000000).toFixed(2)}M USD
          </div>
          <div className="text-xs text-indigo-400/80 mt-1 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" /> +18.2% Active Portfolio Expansion
          </div>
        </div>

        <div className="bg-slate-900/80 border border-indigo-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Active Principal Investigators</span>
            <Briefcase className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            {grants.length} Lead PIs
          </div>
          <div className="text-xs text-slate-400 mt-1">
            28 Academic Departments Represented
          </div>
        </div>

        <div className="bg-slate-900/80 border border-indigo-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Audit Compliance Rating</span>
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            {averageComplianceRating} / 100
          </div>
          <div className="text-xs text-indigo-400 mt-1 font-medium">
            Federal Audit Standard Compliant
          </div>
        </div>

        <div className="bg-slate-900/80 border border-indigo-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Verified Publications</span>
            <Award className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            342 Papers
          </div>
          <div className="text-xs text-slate-400 mt-1">
            High Impact Factor Journals (2025 - 2026)
          </div>
        </div>
      </section>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Filter & Controls Panel */}
        <aside className="lg:col-span-4 bg-slate-900/80 border border-indigo-900/40 rounded-2xl p-6 backdrop-blur-md h-fit">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-400" />
              Grant Filters & Controls
            </h2>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 font-mono px-2 py-0.5 rounded">
              Filter Engine
            </span>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Search Project / PI / Agency
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. Swarm, Dr. Thorne, NSF..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Grant Sponsorship Category
              </label>
              <select
                value={filters.categoryFilter}
                onChange={(e) => setFilters({ ...filters, categoryFilter: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="ALL">All Sponsorship Types</option>
                <option value="FEDERAL_FUNDED">Federal Funded (NSF, NIH)</option>
                <option value="CORPORATE_SPONSORED">Corporate & Industry R&D</option>
                <option value="DEFENSE_CONTRACT">Defense & Security Contract</option>
                <option value="FOUNDATION_GRANT">Philanthropic Foundation Grant</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Grant Lifecycle Status
              </label>
              <select
                value={filters.statusFilter}
                onChange={(e) => setFilters({ ...filters, statusFilter: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="ALL">All Lifecycle Statuses</option>
                <option value="ACTIVE_DISBURSEMENT">Active Disbursement</option>
                <option value="UNDER_AUDIT_REVIEW">Under Audit Review</option>
                <option value="COMPLETED_SUCCESSFUL">Completed Successfully</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-300 mb-1.5">
                <span>Minimum Award Capital</span>
                <span className="text-indigo-400 font-mono">${(filters.minGrantAmountUSD / 1000).toFixed(0)}k USD</span>
              </div>
              <input
                type="range"
                min="0"
                max="5000000"
                step="250000"
                value={filters.minGrantAmountUSD}
                onChange={(e) => setFilters({ ...filters, minGrantAmountUSD: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setFilters({ searchQuery: '', categoryFilter: 'ALL', statusFilter: 'ALL', minGrantAmountUSD: 0 })}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Reset Controls
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Milestone Disbursal Summary
            </h3>
            {milestones.map((m, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl">
                <div className="flex justify-between text-xs font-medium text-slate-200">
                  <span>{m.title}</span>
                  <span className="text-indigo-400 font-mono">${(m.trancheAmountUSD / 1000).toFixed(0)}k</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                  <span>Target: {m.targetDate}</span>
                  <span className="text-indigo-300 font-semibold">{m.status}</span>
                </div>
              </div>
            ))}
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full mt-2 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4" />
              View Full Milestone Timeline
            </button>
          </div>
        </aside>

        {/* Right Records Display Panel */}
        <section className="lg:col-span-8 bg-slate-900/80 border border-indigo-900/40 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Sponsored Research Projects Registry</h2>
              <p className="text-xs text-slate-400">Showing {filteredGrants.length} of {grants.length} records</p>
            </div>
            <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-mono">
              Live GIS Registry
            </span>
          </div>

          <div className="space-y-4">
            {filteredGrants.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p className="text-base font-semibold">No research grants match the filter criteria.</p>
                <p className="text-xs mt-1">Try resetting funding thresholds or category selections.</p>
              </div>
            ) : (
              filteredGrants.map((grant) => (
                <div
                  key={grant.id}
                  className="bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 rounded-xl p-5 transition group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition">
                          {grant.projectTitle}
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs font-mono rounded">
                          {grant.grantCategory.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-indigo-400 font-medium mt-0.5">
                        PI: {grant.principalInvestigator} &bull; {grant.academicDepartment}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-indigo-400 font-mono">
                        ${grant.totalGrantAmountUSD.toLocaleString()} USD
                      </span>
                      <span className="block text-[10px] text-slate-500 uppercase tracking-wider">
                        Awarded: {grant.awardDate}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-slate-800/60 pt-3 mt-3">
                    <div className="text-slate-400">
                      Funding Agency: <span className="text-slate-200 font-medium">{grant.fundingAgency}</span>
                    </div>
                    <div className="text-slate-400 sm:text-right">
                      Status: <span className="text-indigo-300 font-semibold">{grant.grantStatus.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-2 text-xs text-slate-500 border-t border-slate-900">
                    <span className="flex items-center gap-1 font-mono">
                      Compliance Rating: <strong className="text-indigo-400">{grant.complianceRating}/100</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                      Verified Federal Grant
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
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                Research Grant Milestone Timeline
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
                    <span className="text-indigo-400 font-mono">${(m.trancheAmountUSD / 1000).toFixed(0)}k Tranche</span>
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
