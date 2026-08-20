import React, { useState } from "react";
import { Flame, Lock, Eye, EyeOff, ShieldCheck, Tag, BarChart2, Sparkles } from "lucide-react";
import {
  UserInterestHeatmapResult,
  calculateInterestDistribution,
} from "@/lib/userInterestHeatmap";
import { cn } from "@/lib/utils";

export interface ProfileInterestHeatmapProps {
  userId?: string;
  userName?: string;
  isOwner?: boolean;
  initialTags?: string[];
  initialIsPrivate?: boolean;
  totalAttendedEvents?: number;
  onTogglePrivacy?: (isPrivate: boolean) => void;
  className?: string;
}

export const MOCK_ATTENDED_TAGS = [
  "React",
  "AI & ML",
  "React",
  "Hackathon",
  "Art & Design",
  "Music Concert",
  "Art & Design",
  "Intramural Soccer",
  "Fitness Running",
  "Crypto & Fintech",
];

export const ProfileInterestHeatmap: React.FC<ProfileInterestHeatmapProps> = ({
  userId = "user-1",
  userName = "Alex Rivera",
  isOwner = true,
  initialTags = MOCK_ATTENDED_TAGS,
  initialIsPrivate = false,
  totalAttendedEvents = 8,
  onTogglePrivacy,
  className,
}) => {
  const [isPrivate, setIsPrivate] = useState<boolean>(initialIsPrivate);
  const data: UserInterestHeatmapResult = calculateInterestDistribution(
    initialTags,
    !isOwner && isPrivate,
    totalAttendedEvents
  );

  const handlePrivacyToggle = () => {
    const nextState = !isPrivate;
    setIsPrivate(nextState);
    if (onTogglePrivacy) onTogglePrivacy(nextState);
  };

  if (!isOwner && isPrivate) {
    return (
      <div
        className={cn(
          "border-2 border-black rounded-xl p-6 bg-slate-50 font-mono text-center space-y-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
          className
        )}
      >
        <Lock className="w-6 h-6 text-gray-500 mx-auto" />
        <h4 className="font-bold text-sm text-gray-800 uppercase">Attendance Analytics Hidden</h4>
        <p className="text-xs font-sans text-gray-600">
          {userName} has chosen to keep their event attendance heatmap and networking interests private.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-amber-50 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-amber-950">
            <Flame className="w-5 h-5 text-amber-600 fill-amber-500" />
            <span>Networking Interest Heatmap — {userName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Dynamic distribution calculated from {totalAttendedEvents} verified attended campus events.
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2 bg-white border-2 border-black px-3 py-1.5 rounded-md text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <button
              type="button"
              onClick={handlePrivacyToggle}
              className="flex items-center gap-1.5 hover:text-purple-700 transition-colors"
            >
              {isPrivate ? <EyeOff className="w-3.5 h-3.5 text-rose-600" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{isPrivate ? "Analytics Hidden (Private)" : "Public Analytics"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Dynamic Tag Cloud & Category Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Dynamic Tag Cloud (#3546) */}
        <div className="p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Dynamic Interest Tag Cloud
            </h4>
            <span className="text-[11px] text-gray-500 font-sans">Word size correlates to attendance</span>
          </div>

          <div
            data-testid="interest-tag-cloud"
            className="p-4 border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 min-h-[160px] flex flex-wrap items-center justify-center gap-2.5"
          >
            {data.distribution.map((item) => (
              <span
                key={item.tag}
                className={cn(
                  "border-2 border-black rounded-lg px-2.5 py-1 transition-all duration-300 transform hover:scale-105 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                  item.bgClass,
                  item.fontSizeClass
                )}
                title={`${item.count} attended events (${item.percentage}%)`}
              >
                #{item.tag}
              </span>
            ))}
          </div>
        </div>

        {/* Category Breakdown Progress Bars (#3546) */}
        <div className="p-5 bg-white space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-indigo-600" />
              Interest Distribution Breakdown
            </h4>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
              {data.totalAttendedEvents} Events Verified
            </span>
          </div>

          <div className="space-y-3">
            {data.topCategories.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-gray-800">{cat.category}</span>
                  <span className="text-purple-900">{cat.percentage}%</span>
                </div>
                <div className="h-3 w-full bg-gray-100 border border-black rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-amber-400 via-yellow-400 to-indigo-500"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
