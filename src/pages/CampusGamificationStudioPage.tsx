import React, { useState } from 'react';
import {
  CampusGamificationService,
  StudentGamificationProfile,
  GamifiedBadge,
} from '../../backend/src/services/CampusGamificationService';

export const CampusGamificationStudioPage: React.FC = () => {
  const [profile, setProfile] = useState<StudentGamificationProfile>(
    CampusGamificationService.getProfile('STU-999')
  );
  const [badges] = useState<GamifiedBadge[]>(
    CampusGamificationService.getAvailableBadges()
  );

  const metrics = CampusGamificationService.getMetrics();

  const handleUnlockBadge = (badgeId: string) => {
    const updated = CampusGamificationService.awardBadge('STU-999', badgeId);
    setProfile({ ...updated });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Gamification & ECSoC26 Badges
            </span>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-1 rounded-full font-mono">
              Anti-Abuse Verified
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Student Gamification & Achievement Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Track your level progression, earn official ECSoC26 L1/L2/L3 badges, and view real-time anti-abuse system integrity metrics.
          </p>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Student Level & XP</span>
          <div className="text-2xl md:text-3xl font-black text-amber-400 mt-1">
            Lvl {profile.level} ({profile.currentXp} XP)
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Next Lvl: {profile.nextLevelXpThreshold} XP</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Earned Badges</span>
          <div className="text-2xl md:text-3xl font-black text-emerald-400 mt-1">
            {profile.earnedBadges.length} Badges
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">ECSoC26 & Academic Verified</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Anti-Abuse Score</span>
          <div className="text-2xl md:text-3xl font-black text-blue-400 mt-1">
            {profile.antiAbuseScore} / 100
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Anti-Cheat System Operational</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rank Title</span>
          <div className="text-xl md:text-2xl font-black text-purple-400 mt-1">
            {profile.rankTitle}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Tier Top 1% Developer</span>
        </div>
      </div>

      {/* Available Badges Catalog */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-black text-white">ECSoC26 Program Badges</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {badges.map((b) => {
            const isEarned = profile.earnedBadges.some((eb) => eb.badgeId === b.badgeId);
            return (
              <div
                key={b.badgeId}
                className={`p-5 rounded-2xl border flex flex-col justify-between space-y-3 transition-all ${
                  isEarned
                    ? 'bg-slate-950 border-amber-500/50 shadow-lg'
                    : 'bg-slate-950/40 border-slate-800 opacity-80'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-2xl">{b.iconSymbol}</span>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {b.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-sm">{b.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{b.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-900 flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400">+{b.xpReward} XP</span>
                  <button
                    onClick={() => handleUnlockBadge(b.badgeId)}
                    disabled={isEarned}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      isEarned
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-md'
                    }`}
                  >
                    {isEarned ? 'Unlocked ✅' : 'Claim Badge 🏆'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
