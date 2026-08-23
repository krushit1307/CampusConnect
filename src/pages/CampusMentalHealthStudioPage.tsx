import React, { useState } from 'react';
import {
  CampusMentalHealthService,
  MentalHealthMoodLog,
  PeerSupportGroup,
} from '../../backend/src/services/CampusMentalHealthService';

export const CampusMentalHealthStudioPage: React.FC = () => {
  const [moodLogs, setMoodLogs] = useState<MentalHealthMoodLog[]>(
    CampusMentalHealthService.getStudentMoodLogs('STU-999')
  );
  const [supportGroups] = useState<PeerSupportGroup[]>(
    CampusMentalHealthService.getSupportGroups()
  );

  const [moodScore, setMoodScore] = useState<number>(7);
  const [primaryEmotion, setPrimaryEmotion] = useState<
    'ANXIOUS' | 'STRESSED' | 'CALM' | 'OPTIMISTIC' | 'EXHAUSTED'
  >('STRESSED');
  const [notes, setNotes] = useState<string>('Pre-exam preparation feeling');

  const metrics = CampusMentalHealthService.getWellnessMetrics();

  const handleMoodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newLog = CampusMentalHealthService.logStudentMood(
      'STU-999',
      moodScore,
      primaryEmotion,
      notes
    );
    setMoodLogs([newLog, ...moodLogs]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              AI Mental Health & Student Wellness
            </span>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-1 rounded-full font-mono">
              24/7 Crisis Support Operational
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            AI Mental Health & Peer Support Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Confidential mood analysis, automated wellness suggestions, and anonymous peer support group matching.
          </p>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Mood Score</span>
          <div className="text-2xl md:text-3xl font-black text-teal-400 mt-1">
            {metrics.avgMood} / 10
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Based on logged sessions</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Peer Groups</span>
          <div className="text-2xl md:text-3xl font-black text-indigo-400 mt-1">
            {metrics.activeSupportGroups} Groups
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">LCSW Facilitated</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Mood Check-ins</span>
          <div className="text-2xl md:text-3xl font-black text-emerald-400 mt-1">
            {metrics.totalLogs} Logs
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Confidential & Encrypted</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Crisis Helpline</span>
          <div className="text-lg md:text-xl font-black text-rose-400 mt-1">
            {metrics.crisisHelplineStatus}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Immediate Counseling Access</span>
        </div>
      </div>

      {/* Mood Check-In Form & Logs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form
          onSubmit={handleMoodSubmit}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4"
        >
          <h2 className="text-lg font-black text-white">Daily AI Mood Check-In</h2>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Rate Your Mood (1-10)</label>
            <input
              type="range"
              min="1"
              max="10"
              value={moodScore}
              onChange={(e) => setMoodScore(Number(e.target.value))}
              className="w-full text-teal-500accent-teal-500"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>1 (Severely Distressed)</span>
              <span className="font-bold text-teal-400">{moodScore}</span>
              <span>10 (Thriving)</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Primary Emotion</label>
            <select
              value={primaryEmotion}
              onChange={(e) => setPrimaryEmotion(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-500"
            >
              <option value="ANXIOUS">Anxious / Overwhelmed</option>
              <option value="STRESSED">Stressed / Busy</option>
              <option value="CALM">Calm & Focused</option>
              <option value="OPTIMISTIC">Optimistic / Energetic</option>
              <option value="EXHAUSTED">Exhausted / Burnout</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Optional Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-20"
              placeholder="How are you feeling today?"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-all shadow-lg hover:shadow-teal-500/20"
          >
            Submit Mood Log & Generate AI Analysis
          </button>
        </form>

        {/* Peer Support Groups */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-black text-white">Recommended Peer Support Circles</h2>
          <div className="space-y-3">
            {supportGroups.map((grp) => (
              <div key={grp.groupId} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-teal-400">{grp.title}</span>
                  <span className="bg-teal-500/10 text-teal-400 border border-teal-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                    Anonymous Allowed
                  </span>
                </div>
                <p className="text-slate-400">Facilitator: {grp.facilitatorName} • Schedule: {grp.meetingSchedule}</p>
                <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                  <span className="text-slate-500">{grp.activeMembersCount} / {grp.maxCapacity} Members</span>
                  <button className="py-1 px-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs">
                    Join Peer Group
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
