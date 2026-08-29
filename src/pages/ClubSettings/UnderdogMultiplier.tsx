import React, { useState } from 'react';
import { Trophy, TrendingUp, Users, Star, Medal, ShieldCheck, RefreshCcw, Zap, AlertTriangle, Sparkles, ArrowUp } from 'lucide-react';

interface Club {
  id: string;
  name: string;
  points: number;
  weeklyChange: number;
  members: number;
}

const INITIAL_CLUBS: Club[] = [
  { id: 'c-1', name: 'Computer Science Society', points: 2500, weeklyChange: 150, members: 120 },
  { id: 'c-2', name: 'Sports Club', points: 2200, weeklyChange: -50, members: 200 },
  { id: 'c-3', name: 'Drama Society', points: 1800, weeklyChange: 100, members: 80 },
  { id: 'c-4', name: 'Debate Team', points: 1200, weeklyChange: 300, members: 50 },
  { id: 'c-5', name: 'Photography Club', points: 900, weeklyChange: 50, members: 60 },
  { id: 'c-6', name: 'Music Society', points: 700, weeklyChange: 250, members: 45 },
];

const UNDERDOG_THRESHOLD = 1500;
const UNDERDOG_MULTIPLIER = 1.5;

export default function UnderdogMultiplier() {
  const [clubs, setClubs] = useState<Club[]>(INITIAL_CLUBS);
  const [multiplier, setMultiplier] = useState<number>(UNDERDOG_MULTIPLIER);
  const [hasApplied, setHasApplied] = useState<boolean>(false);
  const [appliedClubs, setAppliedClubs] = useState<string[]>([]);

  const getUnderdogStatus = (club: Club) => {
    // A club is an underdog if they are below the threshold but have positive weekly change
    return club.points < UNDERDOG_THRESHOLD && club.weeklyChange > 0;
  };

  const applyMultiplier = () => {
    const boostedClubs = clubs.filter(club => getUnderdogStatus(club));
    const updatedClubs = clubs.map(club => {
      if (getUnderdogStatus(club)) {
        return { ...club, points: Math.round(club.points * multiplier) };
      }
      return club;
    });

    setClubs(updatedClubs);
    setAppliedClubs(boostedClubs.map(club => club.id));
    setHasApplied(true);
  };

  const resetLeaderboard = () => {
    setClubs(INITIAL_CLUBS);
    setHasApplied(false);
    setAppliedClubs([]);
  };

  const sortedClubs = [...clubs].sort((a, b) => b.points - a.points);
  const underdogCount = clubs.filter(club => getUnderdogStatus(club)).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-indigo-900/60 via-violet-900/40 to-slate-900 border border-indigo-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full font-semibold border border-indigo-500/30 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" /> Dynamic Ranking
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" /> {underdogCount} Underdogs Detected
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                Dynamic Club Leaderboard Underdog Multiplier
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Automatically boost clubs that are struggling but showing recent improvement.
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
              <div className="p-3 bg-indigo-500/10 rounded-xl"><Users className="w-6 h-6 text-indigo-400" /></div>
              <div>
                <p className="text-2xl font-bold">{clubs.length}</p>
                <p className="text-slate-400 text-xs">Total Clubs</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-xl"><Star className="w-6 h-6 text-yellow-400" /></div>
              <div>
                <p className="text-2xl font-bold">{underdogCount}</p>
                <p className="text-slate-400 text-xs">Underdogs</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl"><ShieldCheck className="w-6 h-6 text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold">{hasApplied ? 'Applied' : 'Ready'}</p>
                <p className="text-slate-400 text-xs">Multiplier Status</p>
              </div>
            </div>
          </div>
        </div>

        {/* Config */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Zap className="w-5 h-5 text-yellow-400" /> Multiplier Configuration</h2>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-2">Underdog Point Threshold</label>
              <input 
                type="number" 
                value={UNDERDOG_THRESHOLD}
                readOnly
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-2">Multiplier Value (x)</label>
              <input 
                type="number" 
                step="0.1"
                value={multiplier}
                onChange={(e) => setMultiplier(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button 
              onClick={applyMultiplier}
              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <TrendingUp className="w-4 h-4" /> Apply Multiplier
            </button>
          </div>

          <div className="mt-4 flex items-start gap-3 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              The Underdog Multiplier automatically boosts clubs with points below the threshold that have shown positive weekly growth.
            </p>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-slate-900/80 border border-indigo-500/20 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-indigo-400" /> Club Leaderboard</h2>
            <span className="text-xs text-slate-400">{sortedClubs.length} Clubs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Rank</th>
                  <th className="py-4 px-6">Club</th>
                  <th className="py-4 px-6">Points</th>
                  <th className="py-4 px-6">Weekly Change</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedClubs.map((club, index) => {
                  const isUnderdog = getUnderdogStatus(club);
                  const hasBeenBoosted = appliedClubs.includes(club.id);
                  return (
                    <tr key={club.id} className={`border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 transition ${hasBeenBoosted ? 'bg-indigo-500/5' : ''}`}>
                      <td className="py-4 px-6">
                        <span className={`font-bold text-lg ${index === 0 ? 'text-yellow-400' : 'text-slate-400'}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-lg">
                            {club.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{club.name}</p>
                            <p className="text-xs text-slate-500">{club.members} Members</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`font-bold text-lg ${hasBeenBoosted ? 'text-emerald-400' : 'text-white'}`}>
                          {club.points.toLocaleString()}
                        </span>
                        {hasBeenBoosted && (
                          <span className="ml-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-full">
                            BOOSTED
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`flex items-center gap-1 font-bold ${
                          club.weeklyChange > 0 ? 'text-emerald-400' : club.weeklyChange < 0 ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                          {club.weeklyChange > 0 ? <ArrowUp className="w-4 h-4" /> : null}
                          {club.weeklyChange > 0 ? '+' : ''}{club.weeklyChange}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {isUnderdog && !hasBeenBoosted && (
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
                            🐶 Underdog
                          </span>
                        )}
                        {!isUnderdog && !hasBeenBoosted && (
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-700 bg-slate-800 text-slate-400">
                            Top Tier
                          </span>
                        )}
                        {hasBeenBoosted && (
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                            ⚡ Boosted!
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 rounded-full">
            <Sparkles className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-indigo-300">Underdog Multiplier Applied</h3>
            <p className="text-slate-400 text-sm">This is a standalone algorithm simulation. It does not modify any existing backend data.</p>
          </div>
        </div>

      </div>
    </div>
  );
}