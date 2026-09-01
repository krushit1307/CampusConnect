import React, { useMemo } from "react";
import { Smile, Frown, HelpCircle, Meh, Heart, Zap, Sparkles, Users } from "lucide-react";
import {
  aggregateSentiments,
  type EmotionCategory,
  type AggregatedSentiment,
} from "@/services/vibeCheckSentimentService";

interface SpeakerVibeDashboardProps {
  emotions: EmotionCategory[];
  eventTitle?: string;
}

export const SpeakerVibeDashboard: React.FC<SpeakerVibeDashboardProps> = ({
  emotions,
  eventTitle = "Current Presentation",
}) => {
  const stats: AggregatedSentiment = useMemo(() => {
    return aggregateSentiments(emotions);
  }, [emotions]);

  const emotionList: {
    name: EmotionCategory;
    count: number;
    color: string;
    icon: React.ReactNode;
  }[] = [
    {
      name: "Happy",
      count: stats.happy,
      color: "bg-emerald-500",
      icon: <Smile className="h-4 w-4 text-emerald-400" />,
    },
    {
      name: "Engaged",
      count: stats.engaged,
      color: "bg-cyan-500",
      icon: <Zap className="h-4 w-4 text-cyan-400" />,
    },
    {
      name: "Confused",
      count: stats.confused,
      color: "bg-amber-500",
      icon: <HelpCircle className="h-4 w-4 text-amber-400" />,
    },
    {
      name: "Neutral",
      count: stats.neutral,
      color: "bg-slate-500",
      icon: <Meh className="h-4 w-4 text-slate-400" />,
    },
    {
      name: "Surprised",
      count: stats.surprised,
      color: "bg-purple-500",
      icon: <Sparkles className="h-4 w-4 text-purple-400" />,
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-slate-100">Live Sentiment & Vibe Graph</h3>
            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
              LIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time aggregated emotional feedback from opted-in attendees.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
          <Users className="h-4 w-4 text-cyan-400" />
          <span className="font-semibold">{stats.total} Active Signals</span>
        </div>
      </div>

      {/* Dominant Banner */}
      <div
        className={`p-4 rounded-xl border text-sm flex items-center gap-3 transition-colors ${
          stats.confusedPercentage >= 30
            ? "bg-amber-950/40 border-amber-500/50 text-amber-200"
            : "bg-slate-950/70 border-slate-800 text-slate-200"
        }`}
      >
        <Sparkles className="h-5 w-5 text-amber-400 shrink-0" />
        <div className="font-medium leading-relaxed">{stats.summaryText}</div>
      </div>

      {/* Progress Bars */}
      <div className="space-y-3">
        {emotionList.map((item) => {
          const percent = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
          return (
            <div key={item.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2 text-slate-300">
                  {item.icon}
                  <span>{item.name}</span>
                </div>
                <div className="text-slate-400">
                  <span className="text-slate-200 font-bold">{percent}%</span> ({item.count})
                </div>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
