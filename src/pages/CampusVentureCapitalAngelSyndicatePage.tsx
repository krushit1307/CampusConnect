import React, { useState, useEffect } from 'react';
import { CampusVentureSyndicateEngine } from '../../backend/src/services/CampusVentureSyndicateEngine';
import { CampusVentureSyndicateCard } from '../components/syndicate/CampusVentureSyndicateCard';
import { CampusVentureSyndicateTimeline } from '../components/syndicate/CampusVentureSyndicateTimeline';
import {
  Zap,
  Search,
  Filter,
  PlusCircle,
  ShieldCheck,
  Activity,
  X,
  DollarSign,
  Briefcase,
  TrendingUp,
  PieChart,
  Users,
} from 'lucide-react';

export default function CampusVentureCapitalAngelSyndicatePage() {
  const [syndicates, setSyndicates] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    investmentFocus: 'All',
    syndicateStatus: 'All',
    search: '',
  });

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newSyndicateName, setNewSyndicateName] = useState<string>('Stanford DeepTech Alumni Syndicate I');
  const [newLeadAngel, setNewLeadAngel] = useState<string>('Marcus Vance');
  const [newAlumniClass, setNewAlumniClass] = useState<number>(2012);
  const [newCampus, setNewCampus] = useState<string>('Stanford University');
  const [newFocus, setNewFocus] = useState<'PRE_SEED_DEEPTECH' | 'SEED_SAAS' | 'SERIES_A_BIOTECH' | 'WEB3_INFRASTRUCTURE' | 'CLIMATE_TECH'>('PRE_SEED_DEEPTECH');
  const [newTargetPool, setNewTargetPool] = useState<string>('2500000');
  const [newMinCheck, setNewMinCheck] = useState<string>('10000');
  const [newCarryFee, setNewCarryFee] = useState<number>(20.0);

  useEffect(() => {
    loadSyndicates();
  }, []);

  const loadSyndicates = async () => {
    const data = await CampusVentureSyndicateEngine.getSyndicates(filters);
    setSyndicates(data);
  };

  const applyFilterChanges = async (updated: any) => {
    const next = { ...filters, ...updated };
    setFilters(next);
    const data = await CampusVentureSyndicateEngine.getSyndicates(next);
    setSyndicates(data);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPool = parseFloat(newTargetPool);
    const minCheck = parseFloat(newMinCheck);

    if (!Number.isFinite(targetPool) || !Number.isFinite(minCheck)) {
      alert('Please enter valid numerical amounts for fund sizes and check sizes.');
      return;
    }

    await CampusVentureSyndicateEngine.createSyndicate({
      syndicateName: newSyndicateName,
      leadAngelName: newLeadAngel,
      leadAngelAlumniClass: newAlumniClass,
      campusAffiliation: newCampus,
      investmentFocus: newFocus,
      targetFundSizeUsd: targetPool,
      minimumCheckSizeUsd: minCheck,
      carryingFeePercentage: newCarryFee,
    });
    await loadSyndicates();
    setShowCreateModal(false);
  };

  const handleCommitCapital = async (id: string) => {
    await CampusVentureSyndicateEngine.commitCapital(id, 25000);
    await loadSyndicates();
  };

  const handleDeployCapital = async (id: string) => {
    await CampusVentureSyndicateEngine.deployCheckToStartup(id, 100000);
    await loadSyndicates();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-300">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Enterprise Campus Venture Capital & Angel Syndicate Portal
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Campus Venture Capital & Angel Syndicate
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Connect accredited alumni angel investors with high-growth campus student founders to deploy venture capital checks.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 fill-current" />
                Launch New Angel Syndicate Fund Node
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search venture syndicates by title, lead angel, or university..."
                value={filters.search}
                onChange={(e) => applyFilterChanges({ search: e.target.value })}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filters.investmentFocus}
                onChange={(e) => applyFilterChanges({ investmentFocus: e.target.value })}
                className="px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-sm font-semibold focus:outline-none focus:border-amber-500/50"
              >
                <option value="All">All Investment Focuses</option>
                <option value="PRE_SEED_DEEPTECH">Pre-Seed DeepTech</option>
                <option value="SEED_SAAS">Seed SaaS</option>
                <option value="SERIES_A_BIOTECH">Series A BioTech</option>
                <option value="WEB3_INFRASTRUCTURE">Web3 Infrastructure</option>
                <option value="CLIMATE_TECH">Climate Tech</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-extrabold text-2xl text-white flex items-center gap-2 tracking-tight">
            <Zap className="w-6 h-6 text-amber-400" />
            Active Venture Syndicates ({syndicates.length})
          </h2>

          {syndicates.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg">No active venture syndicates registered</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {syndicates.map((item) => (
                <CampusVentureSyndicateCard
                  key={item._id}
                  syndicate={item}
                  onCommitClick={handleCommitCapital}
                  onDeployClick={handleDeployCapital}
                />
              ))}
            </div>
          )}
        </div>

        <CampusVentureSyndicateTimeline syndicates={syndicates} />

        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-black text-white">Launch Angel Syndicate</h3>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Syndicate Name</label>
                  <input type="text" required value={newSyndicateName} onChange={(e) => setNewSyndicateName(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Lead Angel Name</label>
                    <input type="text" required value={newLeadAngel} onChange={(e) => setNewLeadAngel(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Alumni Class</label>
                    <input type="number" required value={newAlumniClass} onChange={(e) => setNewAlumniClass(parseInt(e.target.value))} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Campus</label>
                    <input type="text" required value={newCampus} onChange={(e) => setNewCampus(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Target Pool ($)</label>
                    <input type="number" required value={newTargetPool} onChange={(e) => setNewTargetPool(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Min Check ($)</label>
                    <input type="number" required value={newMinCheck} onChange={(e) => setNewMinCheck(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Carry Fee (%)</label>
                    <input type="number" required value={newCarryFee} onChange={(e) => setNewCarryFee(parseFloat(e.target.value))} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black py-3.5 rounded-2xl shadow-lg">
                  Deploy Syndicate Fund Node
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
