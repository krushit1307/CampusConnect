import React, { useState, useEffect } from 'react';
import { CampusHackathonIncubatorEngine } from '../../backend/src/services/CampusHackathonIncubatorEngine';
import { CampusHackathonIncubatorCard } from '../components/incubator/CampusHackathonIncubatorCard';
import { CampusHackathonIncubatorTimeline } from '../components/incubator/CampusHackathonIncubatorTimeline';
import {
  Rocket,
  Search,
  Filter,
  PlusCircle,
  ShieldCheck,
  Activity,
  X,
  DollarSign,
} from 'lucide-react';

export default function CampusHackathonProjectIncubatorPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    projectDomain: 'All',
    prototypeStatus: 'All',
    search: '',
  });

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('NeuralStream Decentralized Video AI');
  const [newCampus, setNewCampus] = useState<string>('Stanford University');
  const [newLead, setNewLead] = useState<string>('Alex Mercer');
  const [newTeamSize, setNewTeamSize] = useState<number>(4);
  const [newDomain, setNewDomain] = useState<'FINTECH' | 'HEALTH_TECH' | 'ED_TECH' | 'WEB3' | 'AI_ML'>('AI_ML');
  const [newPrize, setNewPrize] = useState<string>('15000');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const data = await CampusHackathonIncubatorEngine.getProjects(filters);
    setProjects(data);
  };

  const applyFilterChanges = async (updated: any) => {
    const next = { ...filters, ...updated };
    setFilters(next);
    const data = await CampusHackathonIncubatorEngine.getProjects(next);
    setProjects(data);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prize = parseFloat(newPrize);

    if (!Number.isFinite(prize)) {
      alert('Please enter a valid prize amount.');
      return;
    }

    await CampusHackathonIncubatorEngine.registerProject({
      projectName: newName,
      campusName: newCampus,
      leadStudentName: newLead,
      teamSize: newTeamSize,
      projectDomain: newDomain,
      prizeFundingUsd: prize,
    });
    await loadProjects();
    setShowCreateModal(false);
  };

  const handleAwardGrant = async (id: string) => {
    await CampusHackathonIncubatorEngine.awardIncubatorGrant(id, 10000);
    await loadProjects();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/40 rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-purple-300">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              Enterprise Campus Hackathon & Venture Incubator Hub
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Campus Hackathon & Project Incubator
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Transform winning hackathon prototypes into scalable, funded student startups through direct venture grants.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 fill-current" />
                Submit Hackathon Prototype Node
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
                placeholder="Search projects by name, lead founder, or university..."
                value={filters.search}
                onChange={(e) => applyFilterChanges({ search: e.target.value })}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filters.projectDomain}
                onChange={(e) => applyFilterChanges({ projectDomain: e.target.value })}
                className="px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-sm font-semibold focus:outline-none focus:border-purple-500/50"
              >
                <option value="All">All Domains</option>
                <option value="AI_ML">Artificial Intelligence / ML</option>
                <option value="WEB3">Web3 & Blockchain</option>
                <option value="FINTECH">FinTech</option>
                <option value="HEALTH_TECH">HealthTech</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-extrabold text-2xl text-white flex items-center gap-2 tracking-tight">
            <Rocket className="w-6 h-6 text-purple-400" />
            Registered Prototypes & Startups ({projects.length})
          </h2>

          {projects.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg">No hackathon projects registered</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map((item) => (
                <CampusHackathonIncubatorCard
                  key={item._id}
                  project={item}
                  onGrantClick={handleAwardGrant}
                />
              ))}
            </div>
          )}
        </div>

        <CampusHackathonIncubatorTimeline projects={projects} />

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
                <h3 className="text-2xl font-black text-white">Register Prototype</h3>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Project Name</label>
                  <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Lead Student</label>
                    <input type="text" required value={newLead} onChange={(e) => setNewLead(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Team Size</label>
                    <input type="number" required value={newTeamSize} onChange={(e) => setNewTeamSize(parseInt(e.target.value))} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Campus</label>
                    <input type="text" required value={newCampus} onChange={(e) => setNewCampus(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Hackathon Prize ($)</label>
                    <input type="number" required value={newPrize} onChange={(e) => setNewPrize(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-slate-950 font-black py-3.5 rounded-2xl shadow-lg">
                  Submit Prototype Node
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
