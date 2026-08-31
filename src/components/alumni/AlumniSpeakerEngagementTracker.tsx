import React, { useState, useEffect } from "react";
import {
  Award,
  Star,
  Users,
  MessageSquare,
  TrendingUp,
  Search,
  Filter,
  BarChart3,
  Calendar,
  Sparkles,
  ChevronRight,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Coffee,
  X,
  Zap,
  Building,
  GraduationCap,
} from "lucide-react";
import {
  AlumniSpeakerEngagementService,
  AlumniSpeakerLeaderboardItem,
  LeaderboardFilterOptions,
  SpeakerTierGrade,
  SpeakerEngagementMetrics,
  AlumniSpeakerEngagementScore,
} from "@/services/alumniSpeakerEngagementService";
import { AlumniSpeakerEngagementMeter } from "@/components/events/AlumniSpeakerEngagementMeter";
import { AlumniSpeakerPresenterOverlay } from "@/components/events/AlumniSpeakerPresenterOverlay";

export const AlumniSpeakerEngagementTracker: React.FC = () => {
  // Leaderboard data state
  const [leaderboardItems, setLeaderboardItems] = useState<AlumniSpeakerLeaderboardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("ALL");
  const [selectedTier, setSelectedTier] = useState<SpeakerTierGrade | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"score" | "events" | "impact" | "rating">("score");

  // Selected Speaker Modal state
  const [selectedItem, setSelectedItem] = useState<AlumniSpeakerLeaderboardItem | null>(null);

  // Live Simulator state
  const [simulatedMetrics, setSimulatedMetrics] = useState<SpeakerEngagementMetrics | null>(null);
  const [simulatedScore, setSimulatedScore] = useState<AlumniSpeakerEngagementScore | null>(null);

  // Issue #5128 Live Sentiment Overlay toggle state
  const [showLiveOverlay, setShowLiveOverlay] = useState<boolean>(true);

  // Load Leaderboard Data
  const loadLeaderboard = async () => {
    setLoading(true);
    const filterOpts: LeaderboardFilterOptions = {
      searchQuery,
      industry: selectedIndustry,
      tierGrade: selectedTier === "ALL" ? undefined : selectedTier,
      sortBy,
    };
    const data = await AlumniSpeakerEngagementService.getAlumniSpeakerLeaderboard(filterOpts);
    setLeaderboardItems(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLeaderboard();
  }, [searchQuery, selectedIndustry, selectedTier, sortBy]);

  // When a speaker is opened in simulator modal, initialize simulator state
  const handleOpenSpeakerModal = (item: AlumniSpeakerLeaderboardItem) => {
    setSelectedItem(item);
    setSimulatedMetrics({ ...item.metrics });
    const score = AlumniSpeakerEngagementService.calculateEngagementScore(
      item.speaker.id,
      item.metrics,
    );
    setSimulatedScore(score);
  };

  // Recalculate simulator score whenever metrics sliders change
  const handleSimulatorMetricChange = (key: keyof SpeakerEngagementMetrics, value: number) => {
    if (!simulatedMetrics || !selectedItem) return;
    const updated = { ...simulatedMetrics, [key]: value };
    setSimulatedMetrics(updated);
    const newScore = AlumniSpeakerEngagementService.calculateEngagementScore(
      selectedItem.speaker.id,
      updated,
    );
    setSimulatedScore(newScore);
  };

  // Helper for Tier Badge styles
  const getTierBadgeStyle = (tier: SpeakerTierGrade) => {
    switch (tier) {
      case "S":
        return "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/20 border border-amber-300";
      case "A":
        return "bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20 border border-indigo-400/30";
      case "B":
        return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold border border-blue-400/30";
      case "C":
        return "bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold border border-emerald-400/30";
      default:
        return "bg-slate-700 text-slate-300 border border-slate-600";
    }
  };

  // Aggregate stats across current dataset
  const totalImpacted = leaderboardItems.reduce(
    (acc, curr) => acc + curr.speaker.total_students_impacted,
    0,
  );
  const avgScore =
    leaderboardItems.length > 0
      ? Math.round(
          (leaderboardItems.reduce((acc, curr) => acc + curr.score.overall_score, 0) /
            leaderboardItems.length) *
            10,
        ) / 10
      : 0;
  const topSpeaker = leaderboardItems[0];
  const avgMentorshipRate =
    leaderboardItems.length > 0
      ? Math.round(
          leaderboardItems.reduce(
            (acc, curr) => acc + curr.metrics.mentorship_followup_conversion_rate,
            0,
          ) / leaderboardItems.length,
        )
      : 0;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 text-slate-100 p-4 font-sans">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950/40 p-6 md:p-8 border border-amber-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Award className="w-3.5 h-3.5" /> Alumni Engagement Analytics
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Dynamic Score Engine v3.1
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-amber-400" />
              Dynamic Alumni Speaker Engagement Tracker
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl">
              Track, score, and rank alumni guest speakers based on live event attendance, student
              sentiment ratings, Q&A interactivity, and post-talk mentorship conversions.
            </p>
          </div>

          <div className="shrink-0">
            <button
              onClick={() => setShowLiveOverlay(!showLiveOverlay)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/30"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>
                {showLiveOverlay ? "Hide Live Sentiment Overlay" : "Launch Live Sentiment Overlay"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Audience Sentiment Overlay Section (Issue #5128) */}
      {showLiveOverlay && (
        <div className="space-y-4 rounded-3xl bg-slate-900/90 border border-indigo-500/30 p-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold font-mono px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                ISSUE #5128 REALTIME OVERLAY
              </span>
              <h2 className="text-base font-bold text-white">
                Live Event Session Sentiment Telemetry
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              Event Session ID: demo-event-5128
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendee Sentiment Meter Slider */}
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                1. Attendee Perspective — Engagement Meter Slider
              </div>
              <AlumniSpeakerEngagementMeter
                eventId="demo-event-5128"
                attendeeId="student-user-77"
              />
            </div>

            {/* Presenter Teleprompter Overlay */}
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                2. Speaker Perspective — Teleprompter / Presenter Overlay
              </div>
              <AlumniSpeakerPresenterOverlay
                eventId="demo-event-5128"
                speakerName="Elena Rostova (VP of Eng)"
              />
            </div>
          </div>
        </div>
      )}

      {/* Aggregate Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Network Avg Score
            </div>
            <div className="text-3xl font-extrabold text-white mt-1">{avgScore}</div>
            <div className="text-xs text-amber-400 font-medium mt-0.5">
              Top 5% across universities
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Top Alumni Speaker
            </div>
            <div className="text-lg font-bold text-indigo-200 truncate max-w-[150px] mt-1">
              {topSpeaker ? topSpeaker.speaker.name : "N/A"}
            </div>
            <div className="text-xs text-emerald-400 font-mono mt-0.5">
              Score: {topSpeaker ? topSpeaker.score.overall_score : 0} (Tier{" "}
              {topSpeaker ? topSpeaker.score.tier_grade : "S"})
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Star className="w-6 h-6 fill-indigo-400/20" />
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Students Impacted
            </div>
            <div className="text-3xl font-extrabold text-white mt-1">
              {totalImpacted.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Across keynotes & workshops</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Mentorship Conversion
            </div>
            <div className="text-3xl font-extrabold text-white mt-1">{avgMentorshipRate}%</div>
            <div className="text-xs text-indigo-300 mt-0.5">Post-talk coffee chats booked</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Coffee className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Leaderboard Controls & Filters */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search alumni speaker name, company, title, or industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Industry Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="ALL">All Industries</option>
              <option value="Technology">Technology</option>
              <option value="Finance & Banking">Finance & Banking</option>
              <option value="Healthcare & Biotech">Healthcare & Biotech</option>
              <option value="Design & Media">Design & Media</option>
              <option value="Legal & Public Policy">Legal & Public Policy</option>
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="score">Sort by Overall Score</option>
              <option value="impact">Sort by Student Impact</option>
              <option value="events">Sort by Events Hosted</option>
              <option value="rating">Sort by Rating</option>
            </select>
          </div>
        </div>

        {/* Tier Filter Pills */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800 overflow-x-auto pb-1">
          <span className="text-xs text-slate-400 font-semibold uppercase mr-2">Filter Tier:</span>
          {(["ALL", "S", "A", "B", "C", "D"] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-3 py-1 rounded-full text-xs font-extrabold transition ${
                selectedTier === tier
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              }`}
            >
              {tier === "ALL" ? "All Tiers" : `Tier ${tier}`}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono animate-pulse">
            Loading alumni speaker engagement rankings...
          </div>
        ) : leaderboardItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
            No alumni speakers found matching the selected filters.
          </div>
        ) : (
          leaderboardItems.map((item, idx) => {
            const { speaker, score, metrics } = item;
            const tierStyle = getTierBadgeStyle(score.tier_grade);

            return (
              <div
                key={speaker.id}
                className="rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/40 p-5 shadow-xl transition-all duration-300 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                {/* Left Info Section */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="relative">
                    <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <img
                      src={speaker.avatar_url}
                      alt={speaker.name}
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-700 shadow-md"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-white">{speaker.name}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-mono uppercase ${tierStyle}`}
                      >
                        Tier {score.tier_grade}
                      </span>
                      <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[11px] px-2 py-0.5 rounded font-mono">
                        Class of '{speaker.graduation_year}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-semibold text-slate-200">
                        {speaker.job_title}
                      </span> at <span className="text-indigo-300">{speaker.company}</span>
                    </p>

                    <p className="text-xs text-slate-400 flex items-center gap-3 font-mono">
                      <span className="flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-500" /> {speaker.degree}
                      </span>
                      <span>•</span>
                      <span className="text-amber-400 font-semibold">{speaker.industry}</span>
                    </p>
                  </div>
                </div>

                {/* Center Quick Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div className="text-center">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Rating</div>
                    <div className="text-sm font-bold text-amber-400 flex items-center justify-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />{" "}
                      {metrics.avg_student_rating.toFixed(2)}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">
                      Turnout
                    </div>
                    <div className="text-sm font-bold text-emerald-400 font-mono">
                      {metrics.attendance_rate}%
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">
                      Q&A Answered
                    </div>
                    <div className="text-sm font-bold text-indigo-300 font-mono">
                      {metrics.qa_questions_answered}
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">
                      Mentorship
                    </div>
                    <div className="text-sm font-bold text-purple-400 font-mono">
                      {metrics.mentorship_followup_conversion_rate}%
                    </div>
                  </div>
                </div>

                {/* Right Overall Score Dial & Action */}
                <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      Engagement Score
                    </div>
                    <div className="text-2xl font-black text-white tracking-tight">
                      {score.overall_score}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {speaker.total_events_hosted} events hosted
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenSpeakerModal(item)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/20 active:scale-95"
                  >
                    <span>View Analytics & Simulator</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Speaker Detailed Analytics & Live Simulator Modal */}
      {selectedItem && simulatedMetrics && simulatedScore && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 relative my-8">
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Speaker Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div className="flex items-center gap-4">
                <img
                  src={selectedItem.speaker.avatar_url}
                  alt={selectedItem.speaker.name}
                  className="w-16 h-16 rounded-2xl object-cover border border-indigo-500/30 shadow-lg"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-white">
                      {selectedItem.speaker.name}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-mono ${getTierBadgeStyle(
                        simulatedScore.tier_grade,
                      )}`}
                    >
                      Tier {simulatedScore.tier_grade}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {selectedItem.speaker.job_title} at {selectedItem.speaker.company}
                  </p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Class of '{selectedItem.speaker.graduation_year} • {selectedItem.speaker.degree}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end justify-center bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400 uppercase font-semibold">
                  Simulated Overall Score
                </span>
                <span className="text-3xl font-black text-white">
                  {simulatedScore.overall_score}
                </span>
              </div>
            </div>

            {/* 5-Dimension Radar Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" /> Dimension Score Breakdown
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Feedback & Sentiment (30% weight)</span>
                    <span className="font-mono font-bold text-amber-400">
                      {simulatedScore.dimensions.feedback_score}/100
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${simulatedScore.dimensions.feedback_score}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Live Q&A Interactivity (25% weight)</span>
                    <span className="font-mono font-bold text-indigo-400">
                      {simulatedScore.dimensions.interactivity_score}/100
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 transition-all duration-300"
                      style={{ width: `${simulatedScore.dimensions.interactivity_score}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Attendance & Turnout (20% weight)</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {simulatedScore.dimensions.attendance_score}/100
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-300"
                      style={{ width: `${simulatedScore.dimensions.attendance_score}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Mentorship Conversion (15% weight)</span>
                    <span className="font-mono font-bold text-purple-400">
                      {simulatedScore.dimensions.mentorship_score}/100
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-400 transition-all duration-300"
                      style={{ width: `${simulatedScore.dimensions.mentorship_score}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Strengths & Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Key Strengths
                </h4>
                <ul className="space-y-1 text-xs text-slate-300">
                  {simulatedScore.strengths.map((str, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-400">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" /> Enhancement Opportunities
                </h4>
                <ul className="space-y-1 text-xs text-slate-300">
                  {simulatedScore.improvement_recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-indigo-400">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Interactive Live Score Simulator Sliders */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-indigo-500/30 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Interactive Live Event Impact Simulator
                  </h4>
                </div>
                <button
                  onClick={() => {
                    setSimulatedMetrics({ ...selectedItem.metrics });
                    const res = AlumniSpeakerEngagementService.calculateEngagementScore(
                      selectedItem.speaker.id,
                      selectedItem.metrics,
                    );
                    setSimulatedScore(res);
                  }}
                  className="text-[11px] text-indigo-300 hover:text-white transition"
                >
                  Reset Sliders
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Avg Rating (1.0 - 5.0)</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {simulatedMetrics.avg_student_rating.toFixed(2)} ★
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.05"
                    value={simulatedMetrics.avg_student_rating}
                    onChange={(e) =>
                      handleSimulatorMetricChange("avg_student_rating", parseFloat(e.target.value))
                    }
                    className="w-full accent-amber-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Q&A Questions Answered</span>
                    <span className="font-mono text-indigo-300 font-bold">
                      {simulatedMetrics.qa_questions_answered} Qs
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={simulatedMetrics.qa_questions_answered}
                    onChange={(e) =>
                      handleSimulatorMetricChange(
                        "qa_questions_answered",
                        parseInt(e.target.value, 10),
                      )
                    }
                    className="w-full accent-indigo-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Mentorship Conversion</span>
                    <span className="font-mono text-purple-400 font-bold">
                      {simulatedMetrics.mentorship_followup_conversion_rate}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="2"
                    value={simulatedMetrics.mentorship_followup_conversion_rate}
                    onChange={(e) =>
                      handleSimulatorMetricChange(
                        "mentorship_followup_conversion_rate",
                        parseInt(e.target.value, 10),
                      )
                    }
                    className="w-full accent-purple-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlumniSpeakerEngagementTracker;
