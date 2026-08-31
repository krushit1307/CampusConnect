import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  FileText,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  EventLinguisticSentimentDriftAnalysis,
  DriftAlertSeverity,
  DriftDirection,
} from "@/types/eventLinguisticSentimentDrift";
import { eventLinguisticSentimentDriftService } from "@/services/eventLinguisticSentimentDriftService";

interface EventLinguisticSentimentDriftViewProps {
  eventId: string;
  eventTitle?: string;
  initialAnalysis?: EventLinguisticSentimentDriftAnalysis | null;
  onRefresh?: () => void;
}

export function EventLinguisticSentimentDriftView({
  eventId,
  eventTitle = "Event Feedback Analysis",
  initialAnalysis = null,
  onRefresh,
}: EventLinguisticSentimentDriftViewProps) {
  const [analysis, setAnalysis] = useState<EventLinguisticSentimentDriftAnalysis | null>(
    initialAnalysis,
  );
  const [loading, setLoading] = useState<boolean>(!initialAnalysis);
  const [activeTab, setActiveTab] = useState<"overview" | "terms" | "timeline" | "summary">(
    "overview",
  );

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const res = await eventLinguisticSentimentDriftService.evaluateEventLinguisticDrift(
        eventId,
        eventTitle,
      );
      setAnalysis(res);
    } catch (err) {
      console.error("Failed to load linguistic sentiment drift analysis:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialAnalysis) {
      fetchAnalysis();
    }
  }, [eventId, initialAnalysis]);

  const handleRefresh = () => {
    fetchAnalysis();
    if (onRefresh) onRefresh();
  };

  const getSeverityBadge = (severity?: DriftAlertSeverity) => {
    switch (severity) {
      case "CRITICAL":
        return <Badge className="bg-red-600 text-white font-mono uppercase">Critical Alert</Badge>;
      case "HIGH":
        return <Badge className="bg-orange-500 text-white font-mono uppercase">High Alert</Badge>;
      case "MEDIUM":
        return <Badge className="bg-yellow-500 text-slate-900 font-mono uppercase">Medium Alert</Badge>;
      default:
        return <Badge className="bg-emerald-600 text-white font-mono uppercase">Stable</Badge>;
    }
  };

  const getDirectionBadge = (direction?: DriftDirection) => {
    switch (direction) {
      case "IMPROVING":
        return (
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <TrendingUp className="w-4 h-4" /> Improving Momentum
          </span>
        );
      case "DECLINING":
        return (
          <span className="flex items-center gap-1 text-red-400 font-bold">
            <TrendingDown className="w-4 h-4" /> Negative Drift
          </span>
        );
      case "COERCION_SPIKE":
        return (
          <span className="flex items-center gap-1 text-amber-400 font-bold">
            <ShieldAlert className="w-4 h-4" /> Coercion Anomaly
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-blue-400 font-bold">
            <Minus className="w-4 h-4" /> Stable Baseline
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-white animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-slate-800 rounded"></div>
          <div className="h-8 w-24 bg-slate-800 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 bg-slate-800 rounded-xl"></div>
          <div className="h-28 bg-slate-800 rounded-xl"></div>
          <div className="h-28 bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
        <AlertTriangle className="w-10 h-10 mx-auto text-yellow-500 mb-3" />
        <p className="font-mono text-sm">No linguistic sentiment drift analysis available.</p>
        <Button onClick={handleRefresh} variant="outline" className="mt-4">
          Retry Analysis
        </Button>
      </div>
    );
  }

  return (
    <div
      data-testid="sentiment-drift-container"
      className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-indigo-900/40 text-slate-100 shadow-2xl space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-950/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl md:text-2xl font-bold font-display tracking-tight text-white">
              Linguistic Sentiment Drift Tracker
            </h2>
            {getSeverityBadge(analysis.severity)}
          </div>
          <p className="text-xs md:text-sm text-slate-400 font-mono mt-1">
            Real-time tracking of feedback sentiment shifts & vocabulary drift for:{" "}
            <span className="text-indigo-300 font-semibold">{analysis.eventTitle}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            className="border-indigo-800 text-indigo-300 hover:bg-indigo-900/50 hover:text-white transition"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Coercion Spike Warning Banner */}
      {analysis.isCoercionSpikeDetected && (
        <div
          data-testid="coercion-alert-banner"
          className="p-4 rounded-xl bg-amber-950/80 border-2 border-amber-500/60 flex items-start gap-3 text-amber-200 animate-pulse"
        >
          <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-300 text-sm font-display uppercase tracking-wide">
              Coercion Anomaly Detected ({analysis.coercionFlaggedCount} Flagged Submissions)
            </h4>
            <p className="text-xs text-amber-200/90 font-mono mt-1">
              A sudden positive sentiment jump coincides with high keystroke dynamics anomalies.
              Review weight discount applied to prevent score distortion.
            </p>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Baseline Sentiment */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-indigo-500/30 transition">
          <span className="text-xs font-mono uppercase text-slate-400">Baseline Sentiment</span>
          <div className="text-2xl font-extrabold text-white mt-1 font-mono">
            {analysis.baselineSentiment > 0
              ? `+${analysis.baselineSentiment}`
              : analysis.baselineSentiment}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Historical mean score (-1 to +1)</span>
        </div>

        {/* Current Sentiment */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-indigo-500/30 transition">
          <span className="text-xs font-mono uppercase text-slate-400">Current Window Sentiment</span>
          <div className="text-2xl font-extrabold text-indigo-300 mt-1 font-mono">
            {analysis.currentSentiment > 0
              ? `+${analysis.currentSentiment}`
              : analysis.currentSentiment}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Recent window average score</span>
        </div>

        {/* Drift Delta */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-indigo-500/30 transition">
          <span className="text-xs font-mono uppercase text-slate-400">Drift Delta</span>
          <div
            className={`text-2xl font-extrabold mt-1 font-mono flex items-center gap-1 ${
              analysis.driftDelta < 0
                ? "text-red-400"
                : analysis.driftDelta > 0
                ? "text-emerald-400"
                : "text-slate-300"
            }`}
          >
            {analysis.driftDelta > 0 ? `+${analysis.driftDelta}` : analysis.driftDelta}
            <span className="text-xs font-normal text-slate-400 font-sans">
              ({analysis.driftRatePercent}%)
            </span>
          </div>
          <div className="text-xs mt-1 font-mono">{getDirectionBadge(analysis.driftDirection)}</div>
        </div>

        {/* Feedback Count */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-indigo-500/30 transition">
          <span className="text-xs font-mono uppercase text-slate-400">Analyzed Reviews</span>
          <div className="text-2xl font-extrabold text-slate-100 mt-1 font-mono">
            {analysis.totalFeedbackCount}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Flagged Suspicious:{" "}
            <span className="text-amber-400 font-semibold">{analysis.coercionFlaggedCount}</span>
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 text-xs font-mono">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 border-b-2 font-semibold transition ${
            activeTab === "overview"
              ? "border-indigo-500 text-indigo-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Overview & Insights
        </button>
        <button
          onClick={() => setActiveTab("terms")}
          className={`px-4 py-2 border-b-2 font-semibold transition ${
            activeTab === "terms"
              ? "border-indigo-500 text-indigo-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Linguistic Term Shifts ({analysis.termShifts.length})
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`px-4 py-2 border-b-2 font-semibold transition ${
            activeTab === "timeline"
              ? "border-indigo-500 text-indigo-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Feedback Stream ({analysis.timeline.length})
        </button>
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 border-b-2 font-semibold transition ${
            activeTab === "summary"
              ? "border-indigo-500 text-indigo-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Executive Summary
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Recommendations */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-indigo-900/40 space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 font-display font-semibold text-sm">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Automated Organizer Recommendations</span>
            </div>
            <ul className="space-y-2">
              {analysis.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs md:text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Key Term Shifts Preview */}
          <div>
            <h4 className="text-xs font-mono uppercase text-slate-400 mb-3 tracking-wider">
              Emerging Vocabulary Shifts
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {analysis.termShifts.slice(0, 6).map((shift, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-900/70 border border-slate-800/80 flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-sm text-slate-200 capitalize">
                      {shift.term}
                    </span>
                    <span className="block text-[11px] text-slate-500 font-mono">
                      Impact: {shift.impactScore}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs ${
                      shift.changePercentage >= 0
                        ? "border-emerald-500/50 text-emerald-400 bg-emerald-950/30"
                        : "border-red-500/50 text-red-400 bg-red-950/30"
                    }`}
                  >
                    {shift.changePercentage >= 0 ? "+" : ""}
                    {shift.changePercentage}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "terms" && (
        <div className="space-y-3" data-testid="term-shifts-tab">
          <p className="text-xs text-slate-400 font-mono">
            Compares keyword frequency in recent feedback against historical baseline comments.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.termShifts.map((shift, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-base">{shift.term}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-mono ${
                        shift.polarity === "positive"
                          ? "border-emerald-500 text-emerald-400"
                          : shift.polarity === "negative"
                          ? "border-red-500 text-red-400"
                          : "border-slate-500 text-slate-400"
                      }`}
                    >
                      {shift.polarity}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    Baseline: {(shift.baselineFrequency * 100).toFixed(1)}% → Current:{" "}
                    {(shift.currentFrequency * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-base font-extrabold font-mono flex items-center justify-end gap-0.5 ${
                      shift.changePercentage >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {shift.changePercentage >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {Math.abs(shift.changePercentage)}%
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Shift delta</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="space-y-3" data-testid="timeline-tab">
          <div className="space-y-3">
            {analysis.timeline.map((point) => (
              <div
                key={point.id}
                className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 hover:bg-slate-900 transition"
              >
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>{new Date(point.timestamp).toLocaleString()}</span>
                  <div className="flex items-center gap-2">
                    <span>Rating: {point.rating}/5</span>
                    <span
                      className={`font-semibold ${
                        point.sentimentScore > 0
                          ? "text-emerald-400"
                          : point.sentimentScore < 0
                          ? "text-red-400"
                          : "text-slate-400"
                      }`}
                    >
                      Sentiment: {point.sentimentScore.toFixed(2)}
                    </span>
                    {point.coercionAnomalyScore >= 60 && (
                      <Badge className="bg-amber-600 text-white text-[10px] uppercase font-mono">
                        Anomaly ({point.coercionAnomalyScore})
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-200 italic font-sans bg-slate-950/50 p-2.5 rounded border border-slate-800/80">
                  "{point.feedbackText}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "summary" && (
        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xs md:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
          <FileText className="w-5 h-5 text-indigo-400 mb-3" />
          {analysis.executiveSummaryMarkdown}
        </div>
      )}
    </div>
  );
}
