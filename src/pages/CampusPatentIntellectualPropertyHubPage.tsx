import React, { useState, useEffect } from 'react';
import { CampusPatentIPEngine } from '../../backend/src/services/CampusPatentIPEngine';
import { CampusPatentIPCard } from '../components/patent/CampusPatentIPCard';
import { CampusPatentIPTimeline } from '../components/patent/CampusPatentIPTimeline';
import {
  ShieldCheck,
  Search,
  Filter,
  PlusCircle,
  Activity,
  X,
  Building2,
  FileText,
  DollarSign,
  Award,
} from 'lucide-react';

export default function CampusPatentIntellectualPropertyHubPage() {
  const [patents, setPatents] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    patentType: 'All',
    patentStatus: 'All',
    search: '',
  });

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('Fault-Tolerant Quantum Cryptographic Coprocessor');
  const [newInventors, setNewInventors] = useState<string>('Dr. Elena Rostova, Kenneth Vance');
  const [newDept, setNewDept] = useState<string>('Electrical Engineering & Computer Science');
  const [newCampus, setNewCampus] = useState<string>('MIT');
  const [newType, setNewType] = useState<'UTILITY_PATENT' | 'DESIGN_PATENT' | 'SOFTWARE_COPYRIGHT' | 'BIOTECH_GENOME' | 'HARDWARE_CIRCUIT'>('HARDWARE_CIRCUIT');
  const [newFilingNo, setNewFilingNo] = useState<string>('US-2026-098234-B2');
  const [newJurisdiction, setNewJurisdiction] = useState<string>('USPTO');
  const [newFee, setNewFee] = useState<string>('500000');
  const [newRoyalty, setNewRoyalty] = useState<number>(50.0);

  const [showLicenseModal, setShowLicenseModal] = useState<boolean>(false);
  const [selectedPatentId, setSelectedPatentId] = useState<string | null>(null);
  const [licenseeName, setLicenseeName] = useState<string>('NVIDIA Tech Ventures');
  const [agreedFee, setAgreedFee] = useState<string>('750000');

  useEffect(() => {
    loadPatents();
  }, []);

  const loadPatents = async () => {
    const data = await CampusPatentIPEngine.getPatents(filters);
    setPatents(data);
  };

  const applyFilterChanges = async (updated: any) => {
    const next = { ...filters, ...updated };
    setFilters(next);
    const data = await CampusPatentIPEngine.getPatents(next);
    setPatents(data);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = parseFloat(newFee);
    const inventorsArr = newInventors.split(',').map((s) => s.trim()).filter((s) => s !== '');

    if (!Number.isFinite(fee) || inventorsArr.length === 0) {
      alert('Please enter valid inputs.');
      return;
    }

    await CampusPatentIPEngine.filePatentDisclosure({
      inventionTitle: newTitle,
      inventorNames: inventorsArr,
      department: newDept,
      campusName: newCampus,
      patentType: newType,
      filingNumber: newFilingNo,
      jurisdiction: newJurisdiction,
      commercialLicensingFeeUsd: fee,
      royaltySharePercentage: newRoyalty,
    });
    await loadPatents();
    setShowCreateModal(false);
  };

  const handleAdvanceStatus = async (id: string, currentStatus: string) => {
    let next: any = 'PROVISIONAL_FILED';
    if (currentStatus === 'PROVISIONAL_FILED') next = 'PATENT_GRANTED';
    else if (currentStatus === 'PATENT_GRANTED') next = 'LICENSED_ENTERPRISE';

    await CampusPatentIPEngine.updatePatentStatus(id, next);
    await loadPatents();
  };

  const handleOpenLicenseModal = (id: string) => {
    setSelectedPatentId(id);
    setShowLicenseModal(true);
  };

  const handleLicenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatentId) return;

    const fee = parseFloat(agreedFee);
    if (!Number.isFinite(fee)) return;

    await CampusPatentIPEngine.licensePatentToEnterprise(selectedPatentId, licenseeName, fee);
    await loadPatents();
    setShowLicenseModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold text-indigo-300">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Enterprise Campus Patent & IP Commercialization Hub
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Campus Patent & Intellectual Property Hub
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Log university research disclosures, track USPTO patent filings, manage inventor royalty shares, and license IP to corporate partners.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 fill-current" />
                Submit Intellectual Property Disclosure
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
                placeholder="Search patent disclosures by title, filing number, department, or university..."
                value={filters.search}
                onChange={(e) => applyFilterChanges({ search: e.target.value })}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filters.patentType}
                onChange={(e) => applyFilterChanges({ patentType: e.target.value })}
                className="px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-sm font-semibold focus:outline-none focus:border-indigo-500/50"
              >
                <option value="All">All IP Categories</option>
                <option value="UTILITY_PATENT">Utility Patent</option>
                <option value="HARDWARE_CIRCUIT">Hardware Circuit</option>
                <option value="BIOTECH_GENOME">BioTech Genome</option>
                <option value="SOFTWARE_COPYRIGHT">Software Copyright</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-extrabold text-2xl text-white flex items-center gap-2 tracking-tight">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            Active Patent Disclosures & IP ({patents.length})
          </h2>

          {patents.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg">No patent disclosures registered</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {patents.map((item) => (
                <CampusPatentIPCard
                  key={item._id}
                  patent={item}
                  onAdvanceStatus={handleAdvanceStatus}
                  onLicenseClick={handleOpenLicenseModal}
                />
              ))}
            </div>
          )}
        </div>

        <CampusPatentIPTimeline patents={patents} />

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
                <h3 className="text-2xl font-black text-white">Submit IP Disclosure</h3>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Invention Title</label>
                  <input type="text" required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Inventors (Comma-separated)</label>
                    <input type="text" required value={newInventors} onChange={(e) => setNewInventors(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Filing Number</label>
                    <input type="text" required value={newFilingNo} onChange={(e) => setNewFilingNo(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Department</label>
                    <input type="text" required value={newDept} onChange={(e) => setNewDept(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Campus</label>
                    <input type="text" required value={newCampus} onChange={(e) => setNewCampus(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">License Fee Target ($)</label>
                    <input type="number" required value={newFee} onChange={(e) => setNewFee(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Royalty Split (%)</label>
                    <input type="number" required value={newRoyalty} onChange={(e) => setNewRoyalty(parseFloat(e.target.value))} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                  </div>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 text-slate-950 font-black py-3.5 rounded-2xl shadow-lg">
                  Register IP Disclosure Node
                </button>
              </form>
            </div>
          </div>
        )}

        {showLicenseModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
              <button
                onClick={() => setShowLicenseModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-black text-white">License to Enterprise</h3>
              </div>

              <form onSubmit={handleLicenseSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Licensee Corporate Entity</label>
                  <input type="text" required value={licenseeName} onChange={(e) => setLicenseeName(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Agreed Licensing Fee ($)</label>
                  <input type="number" required value={agreedFee} onChange={(e) => setAgreedFee(e.target.value)} className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm" />
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black py-3.5 rounded-2xl shadow-lg">
                  Confirm Enterprise License Agreement
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
