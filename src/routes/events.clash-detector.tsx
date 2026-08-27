/**
 * Event Clash Dependency Graph & Schedule Collision Detector Page
 * Route: /events/clash-detector
 * Issue #4140
 */

import React, { useState, useEffect } from 'react';
import {
  EventClashInput,
  EventClashAnalysisResult,
  RescheduleAlternativeSlot,
} from '../types/eventClashGraph';
import { eventClashGraphService } from '../services/eventClashGraphService';
import { EventClashDependencyGraph } from '../components/events/EventClashDependencyGraph';
import { EventClashConflictCard } from '../components/events/EventClashConflictCard';
import {
  Network,
  Calendar,
  Tag,
  Clock,
  RefreshCw,
  Sparkles,
  Building,
  CheckCircle2,
} from 'lucide-react';

export default function EventClashDetectorPage() {
  const [title, setTitle] = useState('Women in Tech Spring Networking Night');
  const [clubName, setClubName] = useState('Women in Technology Club');
  const [clubId, setClubId] = useState('club-wit');
  const [startTime, setStartTime] = useState('2026-08-27T18:00');
  const [endTime, setEndTime] = useState('2026-08-27T20:30');
  const [tagsInput, setTagsInput] = useState('tech, networking, coding, career, internships');
  const [expectedAttendance, setExpectedAttendance] = useState(150);

  const [analysis, setAnalysis] = useState<EventClashAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [appliedSlotNotice, setAppliedSlotNotice] = useState<string | null>(null);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const input: EventClashInput = {
        title,
        club_id: clubId,
        club_name: clubName,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        tags,
        expected_attendance: Number(expectedAttendance),
      };

      const result = await eventClashGraphService.evaluateEventClashes(input);
      setAnalysis(result);
      await eventClashGraphService.logClashAnalysis(result);
    } catch (err) {
      console.error('Failed to run clash analysis:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, []);

  const handleApplyReschedule = (slot: RescheduleAlternativeSlot) => {
    const s = new Date(slot.start_time).toISOString().slice(0, 16);
    const e = new Date(slot.end_time).toISOString().slice(0, 16);
    setStartTime(s);
    setEndTime(e);
    setAppliedSlotNotice(
      `Applied alternative slot: ${new Date(slot.start_time).toLocaleString()}`
    );

    setTimeout(() => {
      setAppliedSlotNotice(null);
      runAnalysis();
    }, 300);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Dynamic Event Clash Dependency Graph
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              Detect concurrent audience cannibalization and target demographic
              overlap in real-time.
            </p>
          </div>
        </div>

        <button
          onClick={runAnalysis}
          disabled={isAnalyzing}
          className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          <span>{isAnalyzing ? 'Evaluating Overlaps...' : 'Recalculate Graph'}</span>
        </button>
      </div>

      {appliedSlotNotice && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{appliedSlotNotice}</span>
        </div>
      )}

      {/* Main Grid: Inputs Form & Dependency Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Event Details Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl text-xs">
          <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>Proposed Event Parameter Matrix</span>
          </h3>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Event Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Host Organization</label>
            <input
              type="text"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">End Time</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">
              Target Audience Tags (Comma-separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tech, networking, coding"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Expected Capacity</label>
            <input
              type="number"
              value={expectedAttendance}
              onChange={(e) => setExpectedAttendance(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={runAnalysis}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-xl transition"
            >
              Analyze Demographic Intersections
            </button>
          </div>
        </div>

        {/* Center & Right Col: Interactive Visual Graph & AI Conflict Card */}
        <div className="lg:col-span-2 space-y-6">
          {analysis && (
            <>
              <EventClashDependencyGraph
                analysis={analysis}
                onApplyReschedule={(s, e) => {
                  setStartTime(s.slice(0, 16));
                  setEndTime(e.slice(0, 16));
                  runAnalysis();
                }}
              />

              <EventClashConflictCard
                analysis={analysis}
                onApplySlot={handleApplyReschedule}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
