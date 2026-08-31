import React, { useState } from 'react';
import { Calculator, DollarSign, Calendar, Users, TrendingUp, CheckCircle2, AlertCircle, RefreshCcw, Settings2 } from 'lucide-react';

interface Member {
  id: string;
  name: string;
  joinDate: string;
  duesPaid: boolean;
}

const INITIAL_MEMBERS: Member[] = [
  { id: 'm-1', name: 'Aarav Sharma', joinDate: '2026-01-15', duesPaid: true },
  { id: 'm-2', name: 'Priya Patel', joinDate: '2026-03-01', duesPaid: false },
  { id: 'm-3', name: 'Rohan Mehta', joinDate: '2026-06-20', duesPaid: false },
  { id: 'm-4', name: 'Sneha Gupta', joinDate: '2026-08-10', duesPaid: false },
];

const TOTAL_YEARLY_DUES = 120;

export default function ClubDuesProration() {
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [annualDues, setAnnualDues] = useState<number>(TOTAL_YEARLY_DUES);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [result, setResult] = useState<{ name: string; amount: number }[] | null>(null);

  const calculateProratedDues = () => {
    const currentYear = new Date().getFullYear();
    const daysInYear = 365;
    
    const proratedResults = members.map(member => {
      const joinDate = new Date(member.joinDate);
      const startDay = Math.max(1, Math.min(selectedMonth, 12));
      const daysRemaining = Math.max(0, daysInYear - (startDay * 30));
      const monthsRemaining = Math.max(1, Math.round((12 - startDay) + 1));
      
      const proratedAmount = (annualDues / 12) * monthsRemaining;
      
      return {
        name: member.name,
        amount: Math.round(proratedAmount * 100) / 100,
      };
    });
    
    setResult(proratedResults);
  };

  const resetCalculator = () => {
    setResult(null);
    setAnnualDues(TOTAL_YEARLY_DUES);
    setSelectedMonth(new Date().getMonth() + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-indigo-900/60 via-blue-900/40 to-slate-900 border border-indigo-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full font-semibold border border-indigo-500/30 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" /> Dues Calculator
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                Club Dues Proration Engine
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Calculate accurate membership dues based on when a student joined the club.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={resetCalculator} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
                <RefreshCcw className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>
        </header>

        {/* Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><Settings2 className="w-5 h-5 text-indigo-400" /> Configure Proration</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Annual Dues Amount ($)</label>
                <input 
                  type="number" 
                  value={annualDues}
                  onChange={(e) => setAnnualDues(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Membership Start Month</label>
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>January</option>
                  <option value={2}>February</option>
                  <option value={3}>March</option>
                  <option value={4}>April</option>
                  <option value={5}>May</option>
                  <option value={6}>June</option>
                  <option value={7}>July</option>
                  <option value={8}>August</option>
                  <option value={9}>September</option>
                  <option value={10}>October</option>
                  <option value={11}>November</option>
                  <option value={12}>December</option>
                </select>
              </div>

              <button 
                onClick={calculateProratedDues}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <TrendingUp className="w-4 h-4" /> Calculate Prorated Dues
              </button>
            </div>
          </div>

          {/* Members List */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><Users className="w-5 h-5 text-blue-400" /> Members List</h2>
            
            <div className="space-y-3">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-lg">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-white">{member.name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> Joined {member.joinDate}</p>
                    </div>
                  </div>
                  <div className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                    member.duesPaid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {member.duesPaid ? 'Paid' : 'Pending'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-slate-900/80 border border-indigo-500/20 rounded-3xl p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><DollarSign className="w-5 h-5 text-green-400" /> Calculated Proration</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 pr-4">Member Name</th>
                    <th className="pb-3 pr-4">Start Month</th>
                    <th className="pb-3">Prorated Dues ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.map((member, index) => (
                    <tr key={index} className="border-b border-slate-800/50 last:border-0">
                      <td className="py-3 pr-4 text-white font-medium">{member.name}</td>
                      <td className="py-3 pr-4 text-slate-400">{selectedMonth}</td>
                      <td className="py-3 font-bold text-indigo-300">${member.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <p className="text-sm text-emerald-300">Proration calculated based on monthly recurring dues.</p>
            </div>
            <div className="mt-4 flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <p className="text-sm text-yellow-300">Note: This is a standalone calculator feature. It does not modify any existing backend data.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}