import React, { useState, useEffect } from 'react';
import { CampusAlumniEndowmentEngine } from '../../backend/src/services/CampusAlumniEndowmentEngine';
import { CampusAlumniEndowmentCard } from '../components/endowment/CampusAlumniEndowmentCard';
import { CampusAlumniEndowmentTimeline } from '../components/endowment/CampusAlumniEndowmentTimeline';
import {
  Award,
  Search,
  Filter,
  PlusCircle,
  ShieldCheck,
  Activity,
  X,
  DollarSign,
  Gift,
} from 'lucide-react';

export default function CampusAlumniEndowmentStudioPage() {
  const [endowments, setEndowments] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    campusName: 'All',
    fundCategory: 'All',
    search: '',
  });

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newFundName, setNewFundName] = useState<string>('Quantum Research Student Grant');
  const [newCampus, setNewCampus] = useState<string>('UC Berkeley');
  const [newDonor, setNewDonor] = useState<string>('Sarah Jenkins');
  const [newYear, setNewYear] = useState<number>(2015);
  const [newCategory, setNewCategory] = useState<'RESEARCH_GRANT' | 'STUDENT_EMERGENCY' | 'SCHOLARSHIP' | 'STARTUP_SEED'>('RESEARCH_GRANT');
  const [newTarget, setNewTarget] = useState<string>('100000');
  const [newRatio, setNewRatio] = useState<number>(2.0);

  useEffect(() => {
    loadEndowments();
  }, []);

  const loadEndowments = async () => {
    const data = await CampusAlumniEndowmentEngine.getEndowments(filters);
    setEndowments(data);
  };

  const applyFilterChanges = async (updated: any) => {
    const next = { ...filters, ...updated };
    setFilters(next);
    const data = await CampusAlumniEndowmentEngine.getEndowments(next);
    setEndowments(data);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(newTarget);

    if (!Number.isFinite(target)) {
      alert('Please enter a valid target amount.');
      return;
    }

    await CampusAlumniEndowmentEngine.createEndowment({
      fundName: newFundName,
      campusName: newCampus,
      donorAlumniName: newDonor,
      donorGraduationYear: newYear,
      fundCategory: newCategory,
      targetAmountUsd: target,
      donorMatchingRatio: newRatio,
    });
    await loadEndowments();
    setShowCreateModal(false);
  };

  const handleContribute = async (id: string) => {
    await CampusAlumniEndowmentEngine.contributeToFund(id, 5000);
    await loadEndowments();
  };

  const handleDisburse = async (id: string) => {
    await CampusAlumniEndowmentEngine.disburseGrant(id, 2500);
    await loadEndowments();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Enterprise Campus Alumni Endowment & Grant Studio
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Alumni Endowment & Grant Studio
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Empower student innovation, research grants, and emergency funds backed by matching alumni donations and university endowments.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 fill-current" />
                Propose New Alumni Endowment
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
                placeholder="Search endowment funds by title, donor alumni, or university..."
                value={filters.search}
                onChange={(e) => applyFilterChanges({ search: e.target.value })}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filters.fundCategory}
                onChange={(e) => applyFilterChanges({ fundCategory: e.target.value })}
                className="px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-sm font-semibold focus:outline-none focus:border-emerald-500/50"
              >
                <option value="All">All Categories</option>
                <option value="RESEARCH_GRANT">Research Grant</option>
                <option value="SCHOLARSHIP">Scholarship</option>
                <option value="STUDENT_EMERGENCY">Emergency Fund</option>
                <option value="STARTUP_SEED">Startup Seed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-extrabold text-2xl text-white flex items-center gap-2 tracking-tight">
            <Award className="w-6 h-6 text-emerald-400" />
            Active Endowment Funds ({endowments.length})
          </h2>

          {endowments.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg">No active endowment funds registered</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {endowments.map((item) => (
                <CampusAlumniEndowmentCard
                  key={item._id}
                  endowment={item}
                  onContributeClick={handleContribute}
                  onDisburseClick={handleDisburse}
                />
              ))}
            </div>
          )}
        </div>

        <CampusAlumniEndowmentTimeline endowments={endowments} />

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
                <h3 className="text-2xl font-black text-white">Propose Alumni Endowment</h3>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Fund Name</label>
                  <input type="text" required value={newFundName} onChange={(e) => setNewFundName(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Donor Name</label>
                    <input type="text" required value={newDonor} onChange={(e) => setNewDonor(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Graduation Year</label>
                    <input type="number" required value={newYear} onChange={(e) => setNewYear(parseInt(e.target.value))} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Campus</label>
                    <input type="text" required value={newCampus} onChange={(e) => setNewCampus(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Target ($)</label>
                    <input type="number" required value={newTarget} onChange={(e) => setNewTarget(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black py-3.5 rounded-2xl shadow-lg">
                  Establish Endowment Fund Node
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
