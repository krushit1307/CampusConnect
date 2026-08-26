import React, { useState } from "react";
import { m } from "framer-motion";
import {
  LeadScoreResult,
  LeadTier,
  ScannedSponsorLead,
} from "@/types/sponsorLeadScoring";
import { sponsorLeadScoringService } from "@/services/sponsorLeadScoringService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Flame,
  Sun,
  CloudSun,
  CloudRain,
  GraduationCap,
  Award,
  Sparkles,
  Star,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MessageSquare,
} from "lucide-react";

interface DynamicLeadScoreCardProps {
  lead: ScannedSponsorLead;
  scoreResult: LeadScoreResult;
  onUpdate?: () => void;
}

const TIER_CONFIG: Record<
  LeadTier,
  { label: string; badgeBg: string; textColor: string; icon: React.ElementType }
> = {
  hot: {
    label: "Hot Lead 🔥",
    badgeBg: "bg-red-500/20 text-red-400 border-red-500/40 shadow-red-500/20",
    textColor: "text-red-400",
    icon: Flame,
  },
  warm: {
    label: "Warm Lead ☀️",
    badgeBg: "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-amber-500/20",
    textColor: "text-amber-400",
    icon: Sun,
  },
  cool: {
    label: "Cool Lead 🌤️",
    badgeBg: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    textColor: "text-blue-400",
    icon: CloudSun,
  },
  low_match: {
    label: "Low Match 🌧️",
    badgeBg: "bg-slate-800 text-slate-400 border-slate-700",
    textColor: "text-slate-400",
    icon: CloudRain,
  },
};

export const DynamicLeadScoreCard: React.FC<DynamicLeadScoreCardProps> = ({
  lead,
  scoreResult,
  onUpdate,
}) => {
  const [rating, setRating] = useState<number>(
    lead.interaction.recruiterRatingOverride || 0,
  );
  const [notes, setNotes] = useState<string>(
    lead.interaction.recruiterNotes || "",
  );
  const [saved, setSaved] = useState(false);

  const tierConfig = TIER_CONFIG[scoreResult.tier];
  const TierIcon = tierConfig.icon;

  const handleSaveNotes = () => {
    sponsorLeadScoringService.updateRecruiterNotes(
      lead.leadId,
      rating,
      notes,
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (onUpdate) onUpdate();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md space-y-4">
      {/* Background Ambient Glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-15 blur-3xl"
        style={{
          backgroundColor:
            scoreResult.tier === "hot"
              ? "#EF4444"
              : scoreResult.tier === "warm"
              ? "#F59E0B"
              : "#3B82F6",
        }}
      />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <img
            src={lead.candidate.avatar}
            alt={lead.candidate.name}
            className="h-12 w-12 rounded-full object-cover border-2 border-slate-700 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                {lead.candidate.name}
              </h3>
              <Badge className={`${tierConfig.badgeBg} font-bold text-xs`}>
                {tierConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
              <span>
                {lead.candidate.degreeLevel} in {lead.candidate.major} (Class of {lead.candidate.graduationYear})
              </span>
              <span className="text-slate-500">• GPA {lead.candidate.gpa}</span>
            </p>
          </div>
        </div>

        {/* Overall Score Circle Badge */}
        <div className="flex items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800 self-start sm:self-auto">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 shadow-inner">
            <span className={`text-xl font-black ${tierConfig.textColor}`}>
              {scoreResult.overallScore}
            </span>
          </div>
          <div className="text-xs">
            <div className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
              Dynamic Match Score
            </div>
            <div className="text-slate-500 text-[11px]">Out of 100 PTS</div>
          </div>
        </div>
      </div>

      {/* 4 Vector Score Breakdown Progress Bars */}
      <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-400">
            <span>Academic Fit</span>
            <span className="text-white font-mono">{scoreResult.vectors.academicFitScore}/100</span>
          </div>
          <div className="mt-1 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${scoreResult.vectors.academicFitScore}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-400">
            <span>Engagement Depth</span>
            <span className="text-white font-mono">{scoreResult.vectors.engagementDepthScore}/100</span>
          </div>
          <div className="mt-1 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full"
              style={{ width: `${scoreResult.vectors.engagementDepthScore}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-400">
            <span>Skill Match</span>
            <span className="text-white font-mono">{scoreResult.vectors.skillMatchScore}/100</span>
          </div>
          <div className="mt-1 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${scoreResult.vectors.skillMatchScore}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-400">
            <span>Recruitment Intent</span>
            <span className="text-white font-mono">{scoreResult.vectors.recruitmentIntentScore}/100</span>
          </div>
          <div className="mt-1 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${scoreResult.vectors.recruitmentIntentScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Matched Skills Tags */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Matched Requirements ({scoreResult.matchedSkills.length} Verified)
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {scoreResult.matchedSkills.map((skill) => (
            <span
              key={skill}
              className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              {skill}
            </span>
          ))}
          {scoreResult.missingSkills.map((skill) => (
            <span
              key={skill}
              className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-xs font-medium flex items-center gap-1 opacity-70"
            >
              <XCircle className="h-3 w-3 text-slate-500" />
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Recommendation Reason Box */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-200 font-medium flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <span>{scoreResult.recommendationReason}</span>
      </div>

      {/* Recruiter Notes & Manual Rating Controls */}
      <div className="pt-2 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5 text-slate-400" /> Recruiter Rating & Notes
          </span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="text-amber-400 hover:scale-110 transition-transform"
              >
                <Star
                  className={`h-4 w-4 ${
                    star <= rating ? "fill-amber-400" : "text-slate-700"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Textarea
            rows={1}
            placeholder="Add recruiter interview notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-slate-950 border-slate-800 text-xs text-white resize-none"
          />
          <Button
            size="sm"
            onClick={handleSaveNotes}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0"
          >
            {saved ? "Saved ✓" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
};
