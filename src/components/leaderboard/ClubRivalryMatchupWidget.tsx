import React, { useState, useEffect } from 'react';
import {
  Swords,
  Trophy,
  Flame,
  Zap,
  Users,
  TrendingUp,
  Clock,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
  ChevronRight,
  Target,
  BarChart2
} from 'lucide-react';
import {
  ClubRivalryMatchupService,
  ClubRivalryMatchup,
  ClubRivalryStats,
  RivalryMatchupAnalysis,
  RivalryMatchupState
} from '@/services/clubRivalryMatchupService';

export const ClubRivalryMatchupWidget: React.FC = () => {
  // Rivalry Data State
  const [matchups, setMatchups] = useState<ClubRivalryMatchup[]>([]);
  const [selectedMatchupId, setSelectedMatchupId] = useState<string>('rivalry-eng-101');
  const [selectedMatchup, setSelectedMatchup] = useState<ClubRivalryMatchup | null>(null);

  // Simulation Sliders State
  const [clubARawPoints, setClubARawPoints] = useState<number>(1250);
  const [clubBRawPoints, setClubBRawPoints] = useState<number>(1180);
  const [clubAMult, setClubAMult] = useState<number>(1.15);
  const [clubBMult, setClubBMult] = useState<number>(1.35);
  const [jointBonus, setJointBonus] = useState<number>(150);

  // Calculated Analysis
  const [analysis, setAnalysis] = useState<RivalryMatchupAnalysis | null>(null);

  // Load Matchups
  useEffect(() => {
    const fetchMatchups = async () => {
      const data = await ClubRivalryMatchupService.getActiveRivalryMatchups();
      setMatchups(data);
      if (data.length > 0) {
        const found = data.find((m) => m.id === selectedMatchupId) || data[0];
        setSelectedMatchup(found);
        setClubARawPoints(found.club_a.raw_event_points);
        setClubBRawPoints(found.club_b.raw_event_points);
        setClubAMult(found.club_a.underdog_multiplier);
        setClubBMult(found.club_b.underdog_multiplier);
        setJointBonus(found.club_a.joint_collaboration_bonus);
      }
    };
    fetchMatchups();
  }, [selectedMatchupId]);

  // Recalculate analysis when parameters or sliders change
  useEffect(() => {
    if (!selectedMatchup) return;

    const simClubA: ClubRivalryStats = {
      ...selectedMatchup.club_a,
      raw_event_points: clubARawPoints,
      underdog_multiplier: clubAMult,
      joint_collaboration_bonus: jointBonus
    };

    const simClubB: ClubRivalryStats = {
      ...selectedMatchup.club_b,
      raw_event_points: clubBRawPoints,
      underdog_multiplier: clubBMult,
      joint_collaboration_bonus: jointBonus
    };

    const res = ClubRivalryMatchupService.calculateRivalryAnalysis(
      simClubA,
      simClubB,
      selectedMatchup.days_remaining
    );
    setAnalysis(res);
  }, [selectedMatchup, clubARawPoints, clubBRawPoints, clubAMult, clubBMult, jointBonus]);

  // Handle Switch Matchup
  const handleSelectMatchup = (mId: string) => {
    setSelectedMatchupId(mId);
    const found = matchups.find((m) => m.id === mId);
    if (found) {
      setSelectedMatchup(found);
      setClubARawPoints(found.club_a.raw_event_points);
      setClubBRawPoints(found.club_b.raw_event_points);
      setClubAMult(found.club_a.underdog_multiplier);
      setClubBMult(found.club_b.underdog_multiplier);
      setJointBonus(found.club_a.joint_collaboration_bonus);
    }
  };

  if (!selectedMatchup || !analysis) return null;

  const { club_a, club_b } = selectedMatchup;

  // State Badge formatting
  const getStateBadge = (st: RivalryMatchupState) => {
    switch (st) {
      case 'DOWN_TO_THE_WIRE':
        return {
          label: 'DOWN TO THE WIRE 🔥',
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
        };
      case 'DOMINANT_BLOWOUT':
        return {
          label: 'DOMINANT BLOWOUT ⚡',
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        };
      case 'CLUB_A_LEADING':
        return {
          label: `${club_a.club_name} LEADING`,
          bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
        };
      case 'CLUB_B_LEADING':
        return {
          label: `${club_b.club_name} LEADING`,
          bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
        };
      default:
        return {
          label: 'DEAD HEAT TIED ⚖️',
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        };
    }
  };

  const stateBadge = getStateBadge(analysis.matchup_state);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-slate-100 p-4 font-sans">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 border border-indigo-500/30 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Swords className="w-3.5 h-3.5" /> Club Leaderboard Rivalry Arena
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {selectedMatchup.season_name}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {selectedMatchup.matchup_title}
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Category: <strong className="text-indigo-200">{selectedMatchup.category}</strong>
            </p>
          </div>

          {/* Matchup Selector Dropdown */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-xs text-slate-400 uppercase font-mono">Select Arena Matchup:</span>
            <select
              value={selectedMatchupId}
              onChange={(e) => handleSelectMatchup(e.target.value)}
              className="bg-slate-950 border border-indigo-500/40 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-400 transition"
            >
              {matchups.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.matchup_title}
                </option>
              ))}
            </select>
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-amber-400" /> {selectedMatchup.days_remaining} Days Remaining in Season
            </span>
          </div>
        </div>
      </div>

      {/* Tug-of-War Momentum Meter Bar */}
      <div className="rounded-3xl bg-slate-900/90 backdrop-blur border border-slate-800 p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          {/* Club A Brief */}
          <div className="flex items-center gap-3">
            <img
              src={club_a.logo_url}
              alt={club_a.club_name}
              className="w-12 h-12 rounded-xl border border-indigo-500/30 shadow-md bg-slate-950 p-1"
            />
            <div>
              <h3 className="font-extrabold text-white text-base">{club_a.club_name}</h3>
              <div className="text-2xl font-black text-indigo-400 font-mono">
                {analysis.club_a_total_score} <span className="text-xs text-slate-400 font-normal">pts</span>
              </div>
            </div>
          </div>

          {/* Center Matchup Status Badge */}
          <div className="text-center">
            <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold border ${stateBadge.bg}`}>
              {stateBadge.label}
            </span>
            <div className="text-xs font-mono text-slate-400 mt-1">
              Lead Margin: <strong className="text-white">+{analysis.lead_margin} pts</strong>
            </div>
          </div>

          {/* Club B Brief */}
          <div className="flex items-center gap-3 text-right">
            <div>
              <h3 className="font-extrabold text-white text-base">{club_b.club_name}</h3>
              <div className="text-2xl font-black text-purple-400 font-mono">
                {analysis.club_b_total_score} <span className="text-xs text-slate-400 font-normal">pts</span>
              </div>
            </div>
            <img
              src={club_b.logo_url}
              alt={club_b.club_name}
              className="w-12 h-12 rounded-xl border border-purple-500/30 shadow-md bg-slate-950 p-1"
            />
          </div>
        </div>

        {/* Tug-of-War Balance Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono text-slate-400">
            <span className="text-indigo-400 font-bold">{analysis.momentum_balance_percent.toFixed(1)}% Momentum</span>
            <span className="text-purple-400 font-bold">{(100 - analysis.momentum_balance_percent).toFixed(1)}% Momentum</span>
          </div>

          <div className="relative w-full h-5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-purple-500 rounded-full transition-all duration-500 relative"
              style={{ width: `${analysis.momentum_balance_percent}%` }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white shadow-lg shadow-white/50 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Key Insights List */}
        <div className="space-y-2 pt-2">
          {analysis.key_insights.map((insight, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs text-slate-200"
            >
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Head-to-Head Detailed Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Club A Card */}
        <div className="rounded-3xl bg-slate-900/80 border border-indigo-500/30 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <img src={club_a.logo_url} alt={club_a.club_name} className="w-8 h-8 rounded-lg bg-slate-950" />
              <h3 className="font-bold text-white text-sm">{club_a.club_name}</h3>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              Score: {analysis.club_a_total_score} pts
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Raw Event Points</span>
              <span className="font-bold font-mono text-white">{clubARawPoints} pts</span>
            </div>

            <div className="flex justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Underdog Multiplier</span>
              <span className="font-bold font-mono text-emerald-400">{clubAMult}x</span>
            </div>

            <div className="flex justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Per-Capita Engagement</span>
              <span className="font-bold font-mono text-indigo-300">{club_a.per_capita_points} pts/member</span>
            </div>

            <div className="flex justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Joint Event Bonus</span>
              <span className="font-bold font-mono text-amber-400">+{jointBonus} pts</span>
            </div>
          </div>
        </div>

        {/* Club B Card */}
        <div className="rounded-3xl bg-slate-900/80 border border-purple-500/30 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <img src={club_b.logo_url} alt={club_b.club_name} className="w-8 h-8 rounded-lg bg-slate-950" />
              <h3 className="font-bold text-white text-sm">{club_b.club_name}</h3>
            </div>
            <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
              Score: {analysis.club_b_total_score} pts
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Raw Event Points</span>
              <span className="font-bold font-mono text-white">{clubBRawPoints} pts</span>
            </div>

            <div className="flex justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Underdog Multiplier</span>
              <span className="font-bold font-mono text-emerald-400">{clubBMult}x</span>
            </div>

            <div className="flex justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Per-Capita Engagement</span>
              <span className="font-bold font-mono text-purple-300">{club_b.per_capita_points} pts/member</span>
            </div>

            <div className="flex justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Joint Event Bonus</span>
              <span className="font-bold font-mono text-amber-400">+{jointBonus} pts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Matchup Simulator */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 md:p-8 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Interactive Rivalry Matchup Simulator
            </h3>
          </div>
          <button
            onClick={() => {
              setClubARawPoints(selectedMatchup.club_a.raw_event_points);
              setClubBRawPoints(selectedMatchup.club_b.raw_event_points);
              setClubAMult(selectedMatchup.club_a.underdog_multiplier);
              setClubBMult(selectedMatchup.club_b.underdog_multiplier);
              setJointBonus(selectedMatchup.club_a.joint_collaboration_bonus);
            }}
            className="flex items-center gap-1 text-xs text-indigo-300 hover:text-white transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Matchup Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
          {/* Club A Points Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-indigo-300">{club_a.club_name} Points</span>
              <span className="font-mono font-bold text-indigo-400">{clubARawPoints} pts</span>
            </div>
            <input
              type="range"
              min="500"
              max="2500"
              step="25"
              value={clubARawPoints}
              onChange={(e) => setClubARawPoints(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Club B Points Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-purple-300">{club_b.club_name} Points</span>
              <span className="font-mono font-bold text-purple-400">{clubBRawPoints} pts</span>
            </div>
            <input
              type="range"
              min="500"
              max="2500"
              step="25"
              value={clubBRawPoints}
              onChange={(e) => setClubBRawPoints(parseInt(e.target.value, 10))}
              className="w-full accent-purple-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Club B Underdog Multiplier Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">{club_b.club_name} Multiplier</span>
              <span className="font-mono font-bold text-emerald-400">{clubBMult}x</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="2.0"
              step="0.05"
              value={clubBMult}
              onChange={(e) => setClubBMult(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Joint Event Bonus Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">Joint Event Bonus</span>
              <span className="font-mono font-bold text-amber-400">+{jointBonus} pts</span>
            </div>
            <input
              type="range"
              min="0"
              max="400"
              step="50"
              value={jointBonus}
              onChange={(e) => setJointBonus(parseInt(e.target.value, 10))}
              className="w-full accent-amber-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClubRivalryMatchupWidget;
