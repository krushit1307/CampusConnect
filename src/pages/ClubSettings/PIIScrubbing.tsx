import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Search, FileText, CheckCircle2, Trash2, RefreshCcw, Eye, EyeOff, Lock, Database } from 'lucide-react';

interface PIIEntry {
  id: string;
  type: string;
  value: string;
  sourceFile: string;
  isScrubbed: boolean;
}

const INITIAL_PII_DATA: PIIEntry[] = [
  { id: 'p-1', type: 'Email', value: 'john.doe@example.com', sourceFile: 'event_roster.csv', isScrubbed: false },
  { id: 'p-2', type: 'Phone Number', value: '555-123-4567', sourceFile: 'volunteer_list.xlsx', isScrubbed: false },
  { id: 'p-3', type: 'Address', value: '123 Main St, Springfield', sourceFile: 'member_data.json', isScrubbed: false },
  { id: 'p-4', type: 'Social Security', value: '***-**-1234', sourceFile: 'financial_records.csv', isScrubbed: true },
  { id: 'p-5', type: 'Credit Card', value: '**** **** **** 1234', sourceFile: 'donations.xlsx', isScrubbed: true },
];

export default function PIIScrubbing() {
  const [piiData, setPiiData] = useState<PIIEntry[]>(INITIAL_PII_DATA);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [showValues, setShowValues] = useState(false);

  const types = ['All', 'Email', 'Phone Number', 'Address', 'Social Security', 'Credit Card'];

  const filteredPII = piiData.filter(entry => {
    const matchesSearch = entry.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          entry.sourceFile.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'All' || entry.type === filterType;
    return matchesSearch && matchesType;
  });

  const scrubEntry = (id: string) => {
    setPiiData(prev => prev.map(entry => {
      if (entry.id === id) {
        // Determine the scrub type
        let scrubbedValue = '[REDACTED]';
        if (entry.type === 'Phone Number') scrubbedValue = '***-***-****';
        if (entry.type === 'Email') scrubbedValue = '***@***.***';
        if (entry.type === 'Address') scrubbedValue = '*** Address ***';
        if (entry.type === 'Social Security') scrubbedValue = '***-**-****';
        if (entry.type === 'Credit Card') scrubbedValue = '**** **** **** ****';
        
        return { ...entry, value: scrubbedValue, isScrubbed: true };
      }
      return entry;
    }));
  };

  const scrubAll = () => {
    setPiiData(prev => prev.map(entry => {
      let scrubbedValue = '[REDACTED]';
      if (entry.type === 'Phone Number') scrubbedValue = '***-***-****';
      if (entry.type === 'Email') scrubbedValue = '***@***.***';
      if (entry.type === 'Address') scrubbedValue = '*** Address ***';
      if (entry.type === 'Social Security') scrubbedValue = '***-**-****';
      if (entry.type === 'Credit Card') scrubbedValue = '**** **** **** ****';
      
      return { ...entry, value: scrubbedValue, isScrubbed: true };
    }));
  };

  const resetData = () => {
    setPiiData(INITIAL_PII_DATA);
    setShowValues(false);
  };

  const unscrubbedCount = piiData.filter(entry => !entry.isScrubbed).length;
  const scrubbedCount = piiData.filter(entry => entry.isScrubbed).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-emerald-900/60 via-teal-900/40 to-slate-900 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Data Protection
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> {unscrubbedCount} Exposed Records
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-200 bg-clip-text text-transparent">
                PII Scrubbing on Export
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Identify and automatically remove Personally Identifiable Information (PII) before exporting data.
              </p>
            </div>
            <button onClick={resetData} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset Data
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><ShieldCheck className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{scrubbedCount}</p>
                <p className="text-slate-400 text-xs">Scrubbed</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><AlertTriangle className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className="text-2xl font-bold">{unscrubbedCount}</p>
                <p className="text-slate-400 text-xs">Exposed</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl"><Database className="w-6 h-6 text-blue-400" /></div>
              <div>
                <p className="text-2xl font-bold">{piiData.length}</p>
                <p className="text-slate-400 text-xs">Total Records</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by data or file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {types.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button 
              onClick={() => setShowValues(!showValues)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl text-sm transition"
            >
              {showValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button 
              onClick={scrubAll}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl text-sm font-medium transition shadow-lg shadow-emerald-600/30 flex items-center gap-2"
            >
              <Lock className="w-4 h-4" /> Scrub All
            </button>
          </div>
        </div>

        {/* PII Data Table */}
        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-400" /> Sensitive Data Found</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6">Data Value</th>
                  <th className="py-4 px-6">Source File</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPII.map(entry => (
                  <tr key={entry.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 transition">
                    <td className="py-4 px-6 font-medium text-white">{entry.type}</td>
                    <td className="py-4 px-6">
                      <span className={`font-mono text-sm ${entry.isScrubbed ? 'text-slate-500' : 'text-yellow-300'}`}>
                        {showValues ? entry.value : (entry.isScrubbed ? entry.value : '*** HIDDEN ***')}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-400">{entry.sourceFile}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        entry.isScrubbed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                      }`}>
                        {entry.isScrubbed ? 'Scrubbed' : 'Exposed'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {!entry.isScrubbed && (
                        <button 
                          onClick={() => scrubEntry(entry.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3 h-3" /> Scrub
                        </button>
                      )}
                      {entry.isScrubbed && (
                        <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Protected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}