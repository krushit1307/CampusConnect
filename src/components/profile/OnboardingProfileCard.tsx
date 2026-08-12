import React, { useState } from "react";
import {
  ProgressRing,
  calculateProfileCompleteness,
  ProfileCompletenessData,
} from "./ProgressRing";
import { User, Check, Camera, FileText, GraduationCap, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface OnboardingProfileCardProps {
  initialData?: Partial<ProfileCompletenessData>;
  userName?: string;
  avatarUrl?: string;
}

export const OnboardingProfileCard: React.FC<OnboardingProfileCardProps> = ({
  initialData = { hasAvatar: true, hasBio: true, hasMajor: false, hasInterests: false },
  userName = "Alex Student",
  avatarUrl,
}) => {
  const [profileState, setProfileState] = useState<ProfileCompletenessData>({
    hasAvatar: initialData.hasAvatar ?? false,
    hasBio: initialData.hasBio ?? false,
    hasMajor: initialData.hasMajor ?? false,
    hasInterests: initialData.hasInterests ?? false,
  });

  const percentage = calculateProfileCompleteness(profileState);

  const toggleMetric = (key: keyof ProfileCompletenessData) => {
    setProfileState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-black bg-cream p-6 shadow-md dark:border-cream dark:bg-black dark:text-cream max-w-md mx-auto">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* Animated Progress Ring around Avatar */}
        <ProgressRing profileData={profileState} size={110} strokeWidth={6}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-amber-200 font-mono text-xl font-bold text-black">
              {userName[0]}
            </div>
          )}
        </ProgressRing>

        <div>
          <h3 className="font-display text-lg font-bold">{userName}</h3>
          <p className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
            Profile Completeness:{" "}
            <span className="font-bold text-black dark:text-white">{percentage}%</span>
          </p>
        </div>
      </div>

      {/* Completion Checklist */}
      <div className="w-full space-y-2.5 border-t border-neutral-300 dark:border-neutral-800 pt-4 font-mono text-xs">
        <div className="font-bold uppercase tracking-wider text-neutral-500 mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Onboarding Checklist
        </div>

        <button
          type="button"
          onClick={() => toggleMetric("hasAvatar")}
          className={`flex w-full items-center justify-between rounded-lg border border-black p-2.5 transition-all dark:border-cream ${
            profileState.hasAvatar
              ? "bg-lime text-black font-semibold"
              : "bg-white dark:bg-neutral-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <span>Upload Profile Picture (25%)</span>
          </div>
          {profileState.hasAvatar && <Check className="h-4 w-4 text-black" />}
        </button>

        <button
          type="button"
          onClick={() => toggleMetric("hasBio")}
          className={`flex w-full items-center justify-between rounded-lg border border-black p-2.5 transition-all dark:border-cream ${
            profileState.hasBio
              ? "bg-lime text-black font-semibold"
              : "bg-white dark:bg-neutral-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Add Personal Bio (25%)</span>
          </div>
          {profileState.hasBio && <Check className="h-4 w-4 text-black" />}
        </button>

        <button
          type="button"
          onClick={() => toggleMetric("hasMajor")}
          className={`flex w-full items-center justify-between rounded-lg border border-black p-2.5 transition-all dark:border-cream ${
            profileState.hasMajor
              ? "bg-lime text-black font-semibold"
              : "bg-white dark:bg-neutral-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span>Select Academic Major (25%)</span>
          </div>
          {profileState.hasMajor && <Check className="h-4 w-4 text-black" />}
        </button>

        <button
          type="button"
          onClick={() => toggleMetric("hasInterests")}
          className={`flex w-full items-center justify-between rounded-lg border border-black p-2.5 transition-all dark:border-cream ${
            profileState.hasInterests
              ? "bg-lime text-black font-semibold"
              : "bg-white dark:bg-neutral-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            <span>Add Club Interests (25%)</span>
          </div>
          {profileState.hasInterests && <Check className="h-4 w-4 text-black" />}
        </button>
      </div>
    </div>
  );
};
