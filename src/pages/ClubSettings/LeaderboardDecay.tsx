import React, { useState } from 'react';
import { Trophy, TrendingDown, Timer, Users, ArrowUpRight, ArrowDownRight, BarChart3, Sparkles, AlertTriangle, RefreshCcw, Zap } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  name: string;
  currentPoints: number;
  lastActivityDate: string;
}

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  { id: 'l-1', name: 'Aarav Sharma', currentPoints: 2500, lastActivityDate: '2026-08-10' },
  { id: 'l-2', name: 'Priya Patel', currentPoints: 1800, lastActivityDate: '2026-07-25' },
  { id: 'l-3', name: 'Rohan Mehta', currentPoints: 1200, lastActivityDate: '2026-06-01' },
  { id: 'l-4', name: 'Sneha Gupta', currentPoints: 900, lastActivityDate: '2026-05-15' },
  { id: 'l-5', name: 'Kabir Singh', currentPoints: 600, lastActivityDate: '2026-04-01' },
  { id: 'l-6', name: 'Ananya Iyer', currentPoints: 400, lastActivityDate: '2026-03-20' },
];

const DECAY_RATE = 0.05; // 5% decay per month

export default function LeaderboardDecay() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(INITIAL_LEADERBOARD);
  const [decayRate, setDecayRate] = useState<number>(DECAY_RATE);
  const [showDecay, setShowDecay] = useState<boolean>(false);
  const [decayedScores, setDecayedScores] = useState<LeaderboardEntry[]>([]);

  const monthsSinceActivity = (dateString: string) => {
    const lastActive = new Date(dateString);
    const now = new Date();
    return Math.max(0, (now.getFullYear() - lastActive.getFullYear()) * 12 + (now.getMonth() - lastActive.getMonth()));
  };

  const applyDecay = () => {
    const updatedScores = leaderboard.map(member => {
      const monthsInactive = monthsSinceActivity(member.lastActivityDate);
      const decayedPoints = Math.round(member.currentPoints * Math.pow(1 - decayRate, monthsInactive));
      return { ...member, currentPoints: decayedPoints };
    });
    setDecayedScores(updatedScores);
    setShowDecay(true);
  };

  const resetLeaderboard = () => {
    setLeaderboard(INITIAL_LEADERBOARD);
    setShowDecay(false);
    setDecayedScores([]);
  };

  const getBadge = (points: number) => {
    if (points >= 2000) return { label: 'Elite', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' };
    if (points >= 1000) return { label: 'Gold', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' };
    if (points >= 500) return { label: 'Silver', color: 'text-slate-300 bg-slate-500/10 border-slate-500/30' };
    return { label: 'Bronze', color: 'text-amber-600 bg-amber-500/10 border-amber-500/30' };
  };

  const displayedScores = showDecay ? decayedScores : leaderboard;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="bg-gradient-to-r from-yellow-900/60 via-amber-900/40 to-slate-900 border border-yellow-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-yellow-500/20 text-yellow-300 text-xs px-3 py-1 rounded-full font-semibold border border-yellow-500/30 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" /> Decay Algorithm
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-amber-400" /> Dynamic Score Adjustment
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-yellow-200 bg-clip-text text-transparent">
                Dynamic Club Leaderboard Decay
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Automatically decay member points over time to encourage continuous participation.
              </p>
            </div>
            <button onClick={resetLeaderboard} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset Leaderboard
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><Users className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className="text-2xl font-bold">{leaderboard.length}</p>
                <p className="text-slate-400 text-xs">Total Members</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl"><BarChart3 className="w-6 h-6 text-blue-400" /></div>
              <div>
                <p className="text-2xl font-bold">{decayRate * 100}%</p>
                <p className="text-slate-400 text-xs">Monthly Decay Rate</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><Timer className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{showDecay ? 'Updated' : 'Live'}</p>
                <p className="text-slate-400 text-xs">Score Status</p>
              </div>
            </div>
          </div>
        </div>

        {/* Config */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Zap className="w-5 h-5 text-amber-400" /> Decay Configuration</h2>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-2">Decay Rate Per Month (%)</label>
              <input 
                type="number" 
                min={0}
                max={100}
                value={decayRate * 100}
                onChange={(e) => setDecayRate(Number(e.target.value) / 100)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500"
              />
            </div>
            <button 
              onClick={applyDecay}
              className="w-full md:w-auto bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-3 rounded-xl font-medium transition shadow-lg shadow-yellow-600/30 flex items-center justify-center gap-2"
            >
              <TrendingDown className="w-4 h-4" /> Apply Decay Algorithm
            </button>
          </div>
          
          <div className="mt-4 flex items-start gap-3 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              This is a standalone calculation dashboard. The decay algorithm is based on the number of months since the member's last activity.
            </p>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-slate-900/80 border border-yellow-500/20 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-400" /> Club Leaderboard</h2>
            <span className="text-xs text-slate-400">{displayedScores.length} Members</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Rank</th>
                  <th className="py-4 px-6">Member</th>
                  <th className="py-4 px-6">Points</th>
                  <th className="py-4 px-6">Months Inactive</th>
                  <th className="py-4 px-6">Badge</th>
                </tr>
              </thead>
              <tbody>
                {[...displayedScores].sort((a, b) => b.currentPoints - a.currentPoints).map((member, index) => {
                  const badge = getBadge(member.currentPoints);
                  return (
                    <tr key={member.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 transition">
                      <td className="py-4 px-6">
                        <span className={`font-bold text-lg ${index === 0 ? 'text-yellow-400' : 'text-slate-400'}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-lg">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{member.name}</p>
                            <p className="text-xs text-slate-500">Last active {member.lastActivityDate}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`font-bold text-lg flex items-center gap-1 ${
                          showDecay ? 'text-rose-400' : 'text-emerald-400'
                        }`}>
                          {showDecay ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          {member.currentPoints.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-400">{monthsSinceActivity(member.lastActivityDate)} months</td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Result Banner */}
        {showDecay && (
          <div className="bg-gradient-to-r from-rose-900/40 to-amber-900/40 border border-rose-500/20 rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 bg-rose-500/20 rounded-full">
              <Sparkles className="w-6 h-6 text-rose-300" />
            </div>
            <div>
              <h3 className="font-bold text-rose-300">Decay Applied Successfully</h3>
              <p className="text-slate-400 text-sm">Points have been adjusted based on the {decayRate * 100}% monthly decay rate.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}