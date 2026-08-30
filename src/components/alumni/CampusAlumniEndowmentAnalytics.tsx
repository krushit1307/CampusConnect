import React, { useState, useMemo } from 'react';
import {
  Award,
  TrendingUp,
  DollarSign,
  Users,
  Search,
  Filter,
  Download,
  Building,
  PieChart,
  Layers,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { AlumniDonationRecord, EndowmentAllocation, EndowmentFilterState } from '../../types/alumniEndowment';

/**
 * Props for the Enterprise Alumni Endowment & Donor Analytics Component
 */
interface CampusAlumniEndowmentAnalyticsProps {
  initialDonations?: AlumniDonationRecord[];
  initialAllocations?: EndowmentAllocation[];
  onExportTelemetry?: (manifest: string) => void;
}

const DEFAULT_DONATION_RECORDS: AlumniDonationRecord[] = [
  {
    id: 'ALUM-DON-8801',
    donorName: 'Dr. Vikramaditya Singhania',
    graduationYear: 1998,
    degreeProgram: 'B.Tech Computer Science',
    donationAmountUSD: 2500000,
    fundCategory: 'RESEARCH_CHAIR',
    targetDepartment: 'School of AI & Robotics',
    contributionDate: '2026-01-15',
    anonymityLevel: 'PUBLIC_RECOGNITION',
    impactScore: 98
  },
  {
    id: 'ALUM-DON-8802',
    donorName: 'Meera Deshmukh & Family',
    graduationYear: 2005,
    degreeProgram: 'MBA Finance',
    donationAmountUSD: 1200000,
    fundCategory: 'NEED_SCHOLARSHIP',
    targetDepartment: 'Department of Management Studies',
    contributionDate: '2026-02-10',
    anonymityLevel: 'PUBLIC_RECOGNITION',
    impactScore: 94
  },
  {
    id: 'ALUM-DON-8803',
    donorName: 'Anonymous Benefactor #42',
    graduationYear: 1989,
    degreeProgram: 'B.E. Mechanical Engineering',
    donationAmountUSD: 5000000,
    fundCategory: 'CAPITAL_EXPANSION',
    targetDepartment: 'Central Innovation Lab & FabLab',
    contributionDate: '2026-03-01',
    anonymityLevel: 'ANONYMOUS',
    impactScore: 99
  },
  {
    id: 'ALUM-DON-8804',
    donorName: 'Rajesh & Sunita Goel',
    graduationYear: 2010,
    degreeProgram: 'M.Tech Electronics',
    donationAmountUSD: 750000,
    fundCategory: 'ATHLETICS_COMPLEX',
    targetDepartment: 'University Sports & Wellness Complex',
    contributionDate: '2026-03-22',
    anonymityLevel: 'PUBLIC_RECOGNITION',
    impactScore: 88
  },
  {
    id: 'ALUM-DON-8805',
    donorName: 'Ananya Roy',
    graduationYear: 2018,
    degreeProgram: 'B.A. Economics',
    donationAmountUSD: 300000,
    fundCategory: 'MERIT_SCHOLARSHIP',
    targetDepartment: 'Department of Economics & Policy',
    contributionDate: '2026-04-05',
    anonymityLevel: 'PUBLIC_RECOGNITION',
    impactScore: 91
  }
];

const DEFAULT_ALLOCATIONS: EndowmentAllocation[] = [
  {
    category: 'Quantum Computing Research Chair',
    allocatedUSD: 4500000,
    disbursedUSD: 3200000,
    beneficiaryCount: 14,
    fiscalYear: 2026
  },
  {
    category: 'STEM Diversity Merit Scholarships',
    allocatedUSD: 3800000,
    disbursedUSD: 3800000,
    beneficiaryCount: 450,
    fiscalYear: 2026
  },
  {
    category: 'Nanotechnology FabLab Cleanroom',
    allocatedUSD: 6200000,
    disbursedUSD: 5100000,
    beneficiaryCount: 880,
    fiscalYear: 2026
  }
];

export const CampusAlumniEndowmentAnalytics: React.FC<CampusAlumniEndowmentAnalyticsProps> = ({
  initialDonations = DEFAULT_DONATION_RECORDS,
  initialAllocations = DEFAULT_ALLOCATIONS,
  onExportTelemetry
}) => {
  const [donations] = useState<AlumniDonationRecord[]>(initialDonations);
  const [allocations] = useState<EndowmentAllocation[]>(initialAllocations);
  const [filters, setFilters] = useState<EndowmentFilterState>({
    searchQuery: '',
    categoryFilter: 'ALL',
    anonymityFilter: 'ALL',
    minAmountUSD: 0
  });

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const filteredDonations = useMemo(() => {
    return donations.filter((record) => {
      if (filters.searchQuery.trim() !== '') {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = record.donorName.toLowerCase().includes(query);
        const matchesDept = record.targetDepartment.toLowerCase().includes(query);
        const matchesDegree = record.degreeProgram.toLowerCase().includes(query);
        if (!matchesName && !matchesDept && !matchesDegree) return false;
      }

      if (filters.categoryFilter !== 'ALL' && record.fundCategory !== filters.categoryFilter) {
        return false;
      }

      if (filters.anonymityFilter !== 'ALL' && record.anonymityLevel !== filters.anonymityFilter) {
        return false;
      }

      if (record.donationAmountUSD < filters.minAmountUSD) {
        return false;
      }

      return true;
    });
  }, [donations, filters]);

  const totalEndowmentValuation = useMemo(() => {
    return donations.reduce((acc, curr) => acc + curr.donationAmountUSD, 0);
  }, [donations]);

  const averageImpactScore = useMemo(() => {
    if (donations.length === 0) return 0;
    const sum = donations.reduce((acc, curr) => acc + curr.impactScore, 0);
    return Math.round(sum / donations.length);
  }, [donations]);

  const handleExportManifest = () => {
    const manifestData = JSON.stringify({
      timestamp: new Date().toISOString(),
      totalValuationUSD: totalEndowmentValuation,
      totalDonors: donations.length,
      filteredCount: filteredDonations.length,
      records: filteredDonations
    }, null, 2);

    if (onExportTelemetry) {
      onExportTelemetry(manifestData);
    } else {
      const blob = new Blob([manifestData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alumni_endowment_telemetry_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-50 p-6 md:p-10 font-sans">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-900/50 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Award className="w-7 h-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-100 via-emerald-200 to-emerald-400 bg-clip-text text-transparent">
                CampusConnect Alumni Endowment & Donor Analytics
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Enterprise Capital Campaigns, Philanthropic Impact Scoring & Capital Allocation Telemetry
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-semibold text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Endowment GIS Live Stream
          </span>
          <button
            onClick={handleExportManifest}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold rounded-xl text-sm transition shadow-lg shadow-emerald-950/40"
          >
            <Download className="w-4 h-4" />
            Export Telemetry
          </button>
        </div>
      </header>

      {/* Top Quad Metric Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-slate-900/80 border border-emerald-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Total Endowment Raised</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            ${(totalEndowmentValuation / 1000000).toFixed(2)}M USD
          </div>
          <div className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" /> +24.5% vs Previous Fiscal Year
          </div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Active Donor Cohort</span>
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            {donations.length} Benefactors
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Global Alumni Network (1975 - 2024)
          </div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Average Impact Score</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            {averageImpactScore} / 100
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-medium">
            High Institutional Efficacy
          </div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-900/40 rounded-2xl p-5 backdrop-blur-md hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Disbursed Scholarships</span>
            <Building className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            1,344 Scholars
          </div>
          <div className="text-xs text-slate-400 mt-1">
            100% Tuition & Research Grant Coverage
          </div>
        </div>
      </section>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Filter & Controls Panel */}
        <aside className="lg:col-span-4 bg-slate-900/80 border border-emerald-900/40 rounded-2xl p-6 backdrop-blur-md h-fit">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Filter className="w-5 h-5 text-emerald-400" />
              Donor Search & Filters
            </h2>
            <span className="text-xs bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded">
              Filter Engine
            </span>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Search Benefactor / Department
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. Singhania, AI & Robotics, Finance..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Endowment Fund Category
              </label>
              <select
                value={filters.categoryFilter}
                onChange={(e) => setFilters({ ...filters, categoryFilter: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="ALL">All Categories</option>
                <option value="RESEARCH_CHAIR">Research Chair & Professorship</option>
                <option value="NEED_SCHOLARSHIP">Need-Based Financial Aid</option>
                <option value="MERIT_SCHOLARSHIP">Merit Scholarship</option>
                <option value="CAPITAL_EXPANSION">Capital Infrastructure & FabLab</option>
                <option value="ATHLETICS_COMPLEX">Athletics & Sports Complex</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Anonymity Level
              </label>
              <select
                value={filters.anonymityFilter}
                onChange={(e) => setFilters({ ...filters, anonymityFilter: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="ALL">All Levels</option>
                <option value="PUBLIC_RECOGNITION">Public Recognition</option>
                <option value="ANONYMOUS">Anonymous Donor</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-300 mb-1.5">
                <span>Minimum Donation Threshold</span>
                <span className="text-emerald-400 font-mono">${(filters.minAmountUSD / 1000).toFixed(0)}k USD</span>
              </div>
              <input
                type="range"
                min="0"
                max="5000000"
                step="100000"
                value={filters.minAmountUSD}
                onChange={(e) => setFilters({ ...filters, minAmountUSD: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setFilters({ searchQuery: '', categoryFilter: 'ALL', anonymityFilter: 'ALL', minAmountUSD: 0 })}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Reset Controls
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-emerald-400" />
              Allocation Summary
            </h3>
            {allocations.map((alloc, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl">
                <div className="flex justify-between text-xs font-medium text-slate-200">
                  <span>{alloc.category}</span>
                  <span className="text-emerald-400 font-mono">${(alloc.allocatedUSD / 1000000).toFixed(1)}M</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, (alloc.disbursedUSD / alloc.allocatedUSD) * 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full mt-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4" />
              View Allocation Breakdown
            </button>
          </div>
        </aside>

        {/* Right Records Display Panel */}
        <section className="lg:col-span-8 bg-slate-900/80 border border-emerald-900/40 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Alumni Philanthropic Registry</h2>
              <p className="text-xs text-slate-400">Showing {filteredDonations.length} of {donations.length} records</p>
            </div>
            <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-mono">
              Live GIS Registry
            </span>
          </div>

          <div className="space-y-4">
            {filteredDonations.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p className="text-base font-semibold">No benefactor records match the filter criteria.</p>
                <p className="text-xs mt-1">Try resetting donation thresholds or category selections.</p>
              </div>
            ) : (
              filteredDonations.map((record) => (
                <div
                  key={record.id}
                  className="bg-slate-950 border border-slate-800/80 hover:border-emerald-500/40 rounded-xl p-5 transition group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition">
                          {record.donorName}
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs font-mono rounded">
                          Class of {record.graduationYear}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-400 font-medium mt-0.5">
                        {record.degreeProgram}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-emerald-400 font-mono">
                        ${record.donationAmountUSD.toLocaleString()} USD
                      </span>
                      <span className="block text-[10px] text-slate-500 uppercase tracking-wider">
                        {record.contributionDate}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-slate-800/60 pt-3 mt-3">
                    <div className="text-slate-400">
                      Target Dept: <span className="text-slate-200 font-medium">{record.targetDepartment}</span>
                    </div>
                    <div className="text-slate-400 sm:text-right">
                      Fund Category: <span className="text-emerald-300 font-semibold">{record.fundCategory.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-2 text-xs text-slate-500 border-t border-slate-900">
                    <span className="flex items-center gap-1 font-mono">
                      Impact Score: <strong className="text-emerald-400">{record.impactScore}/100</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                      Verified Capital Asset
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Allocation Breakdown Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Fiscal Year 2026 Endowment Allocation Breakdown
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              {allocations.map((alloc, i) => (
                <div key={i} className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex justify-between font-bold text-sm text-slate-200">
                    <span>{alloc.category}</span>
                    <span className="text-emerald-400 font-mono">${(alloc.allocatedUSD / 1000000).toFixed(2)}M Allocated</span>
                  </div>
                  <div className="text-xs text-slate-400 flex justify-between">
                    <span>Disbursed: ${(alloc.disbursedUSD / 1000000).toFixed(2)}M</span>
                    <span>Beneficiaries: {alloc.beneficiaryCount} Scholars/Labs</span>
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
