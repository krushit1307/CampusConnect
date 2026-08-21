import React, { useState, useEffect } from 'react';
import { CampusResearchLabGrantEngine } from '../../backend/src/services/CampusResearchLabGrantEngine';
import { CampusResearchLabGrantCard } from '../components/research/CampusResearchLabGrantCard';
import { CampusResearchLabGrantTimeline } from '../components/research/CampusResearchLabGrantTimeline';
import {
  Atom,
  Search,
  Filter,
  PlusCircle,
  ShieldCheck,
  Activity,
  X,
  DollarSign,
} from 'lucide-react';

export default function CampusResearchLabGrantPortalPage() {
  const [labs, setLabs] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    department: 'All',
    grantCategory: 'All',
    search: '',
  });

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newLabTitle, setNewLabTitle] = useState<string>('Autonomous Robotics & Swarm AI Lab');
  const [newDept, setNewDept] = useState<string>('Computer Science');
  const [newPI, setNewPI] = useState<string>('Dr. Aris Thorne');
  const [newCampus, setNewCampus] = useState<string>('MIT');
  const [newCategory, setNewCategory] = useState<'ARTIFICIAL_INTELLIGENCE' | 'QUANTUM_COMPUTING' | 'BIOMEDICAL' | 'RENEWABLE_ENERGY'>('ARTIFICIAL_INTELLIGENCE');
  const [newTarget, setNewTarget] = useState<string>('250000');
  const [newRAPositions, setNewRAPositions] = useState<number>(3);

  useEffect(() => {
    loadLabs();
  }, []);

  const loadLabs = async () => {
    const data = await CampusResearchLabGrantEngine.getLabGrants(filters);
    setLabs(data);
  };

  const applyFilterChanges = async (updated: any) => {
    const next = { ...filters, ...updated };
    setFilters(next);
    const data = await CampusResearchLabGrantEngine.getLabGrants(next);
    setLabs(data);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(newTarget);

    if (!Number.isFinite(target)) {
      alert('Please enter a valid target amount.');
      return;
    }

    await CampusResearchLabGrantEngine.createLabGrant({
      labTitle: newLabTitle,
      department: newDept,
      principalInvestigator: newPI,
      campusName: newCampus,
      grantCategory: newCategory,
      fundingTargetUsd: target,
      openRAPositionsCount: newRAPositions,
    });
    await loadLabs();
    setShowCreateModal(false);
  };

  const handleAwardFunding = async (id: string) => {
    await CampusResearchLabGrantEngine.awardFunding(id, 25000);
    await loadLabs();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-cyan-300">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Enterprise Campus Research Lab & Grant Registry
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Campus Research Lab & Grant Portal
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Accelerate groundbreaking academic research, track institutional lab grants, and recruit student research assistants.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 fill-current" />
                Register New Research Lab Node
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
                placeholder="Search research labs by title, PI, department, or university..."
                value={filters.search}
                onChange={(e) => applyFilterChanges({ search: e.target.value })}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filters.grantCategory}
                onChange={(e) => applyFilterChanges({ grantCategory: e.target.value })}
                className="px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-sm font-semibold focus:outline-none focus:border-cyan-500/50"
              >
                <option value="All">All Categories</option>
                <option value="ARTIFICIAL_INTELLIGENCE">Artificial Intelligence</option>
                <option value="QUANTUM_COMPUTING">Quantum Computing</option>
                <option value="BIOMEDICAL">Biomedical</option>
                <option value="RENEWABLE_ENERGY">Renewable Energy</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-extrabold text-2xl text-white flex items-center gap-2 tracking-tight">
            <Atom className="w-6 h-6 text-cyan-400" />
            Active Research Labs ({labs.length})
          </h2>

          {labs.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg">No active research labs registered</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {labs.map((item) => (
                <CampusResearchLabGrantCard
                  key={item._id}
                  lab={item}
                  onFundClick={handleAwardFunding}
                />
              ))}
            </div>
          )}
        </div>

        <CampusResearchLabGrantTimeline labs={labs} />

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
                <h3 className="text-2xl font-black text-white">Register Research Lab</h3>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Lab Title</label>
                  <input type="text" required value={newLabTitle} onChange={(e) => setNewLabTitle(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Principal Investigator</label>
                    <input type="text" required value={newPI} onChange={(e) => setNewPI(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Department</label>
                    <input type="text" required value={newDept} onChange={(e) => setNewDept(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Campus</label>
                    <input type="text" required value={newCampus} onChange={(e) => setNewCampus(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Grant Target ($)</label>
                    <input type="number" required value={newTarget} onChange={(e) => setNewTarget(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black py-3.5 rounded-2xl shadow-lg">
                  Register Lab Node
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
