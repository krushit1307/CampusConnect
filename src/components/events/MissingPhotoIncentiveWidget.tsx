// =============================================================================
// File: src/components/events/MissingPhotoIncentiveWidget.tsx
// Feature: Automated "Missing Photo" Incentive Engine
// Description: Interactive organizer banner and upload widget that bribes
//              organizers with +150 Gamification Points & +100 XP upon uploading
//              a missing event cover poster.
// =============================================================================

import React, { useState } from "react";
import Image from "lucide-react/dist/esm/icons/image";
import Gift from "lucide-react/dist/esm/icons/gift";
import Zap from "lucide-react/dist/esm/icons/zap";
import Award from "lucide-react/dist/esm/icons/award";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import UploadCloud from "lucide-react/dist/esm/icons/upload-cloud";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import type { MissingPhotoTask, IncentiveClaimResult } from "@/types/missingPhotoIncentive";
import { claimMissingPhotoBounty } from "@/services/missingPhotoIncentiveService";

interface MissingPhotoIncentiveWidgetProps {
  eventId: string;
  eventTitle: string;
  organizerId?: string;
  hasPhoto?: boolean;
  onPhotoUploaded?: (photoUrl: string) => void;
}

export const MissingPhotoIncentiveWidget: React.FC<MissingPhotoIncentiveWidgetProps> = ({
  eventId,
  eventTitle,
  organizerId = "org-1",
  hasPhoto = false,
  onPhotoUploaded,
}) => {
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isClaimed, setIsClaimed] = useState(hasPhoto);
  const [claimResult, setClaimResult] = useState<IncentiveClaimResult | null>(null);

  const samplePhotoPresets = [
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&fit=crop",
    "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&fit=crop",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&fit=crop",
  ];

  const handleClaimBounty = async (selectedUrl?: string) => {
    const targetUrl = selectedUrl || photoUrlInput;
    if (!targetUrl || targetUrl.trim().length === 0) {
      alert("Please enter or select a poster photo URL!");
      return;
    }

    setIsUploading(true);
    try {
      const res = await claimMissingPhotoBounty(
        `task-missing-photo-${eventId}`,
        eventId,
        targetUrl,
        organizerId
      );

      if (res.success) {
        setIsClaimed(true);
        setClaimResult(res);
        if (onPhotoUploaded) {
          onPhotoUploaded(targetUrl);
        }
      }
    } catch (err: any) {
      alert(err.message || "Failed to claim bounty.");
    } finally {
      setIsUploading(false);
    }
  };

  if (isClaimed && claimResult) {
    return (
      <div className="neu-border bg-emerald-100 p-6 shadow-[4px_4px_0_0_#000] border-2 border-black dark:bg-emerald-950 dark:text-white dark:border-emerald-700 animate-in fade-in zoom-in-95">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-black shrink-0">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <Sparkles className="h-4 w-4" /> Bribe Claimed! Reward Deposited
              </p>
              <h3 className="font-display font-extrabold text-lg text-black dark:text-white">
                +{claimResult.pointsAwarded} Gamification Points & +{claimResult.xpAwarded} XP
              </h3>
              <p className="font-mono text-xs text-gray-700 dark:text-gray-300">
                Unlocked Badge: <strong className="text-emerald-900 dark:text-emerald-200">{claimResult.badgeUnlocked}</strong> • New Balance: {claimResult.newTotalPoints} pts
              </p>
            </div>
          </div>

          <span className="font-mono text-xs font-bold uppercase bg-white dark:bg-zinc-800 px-3 py-1.5 border border-black neu-border">
            Poster Verified 📸
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="neu-border bg-amber-50 p-6 shadow-[4px_4px_0_0_#000] border-2 border-black dark:bg-zinc-900 dark:border-amber-500/50 space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black/20 pb-4 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black uppercase text-amber-900 bg-amber-200 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-0.5 rounded border border-black flex items-center gap-1">
              <Gift className="h-3.5 w-3.5 text-amber-600 animate-bounce" /> Missing Photo Incentive Bounty
            </span>
            <span className="font-mono text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              URGENT TASK
            </span>
          </div>
          <h2 className="font-display text-xl font-bold text-black dark:text-white">
            Upload Event Poster to Claim <span className="text-amber-600 dark:text-amber-400 font-extrabold">+150 Points & +100 XP!</span>
          </h2>
          <p className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
            Events with cover posters get <strong>4.8x higher attendee RSVPs</strong>. Upload a cover poster for <span className="font-bold">{eventTitle}</span> now to claim your bribe.
          </p>
        </div>

        <div className="p-3 bg-amber-300 border-2 border-black shadow-[2px_2px_0_0_#000] font-mono text-center shrink-0">
          <span className="text-xs font-bold text-amber-950 block uppercase">Reward Bribe</span>
          <span className="text-2xl font-black text-amber-950 flex items-center justify-center gap-0.5">
            <Zap className="h-5 w-5 fill-amber-950" /> +150 <span className="text-xs font-normal">pts</span>
          </span>
        </div>
      </div>

      {/* Preset Quick Selection & Upload Input */}
      <div className="space-y-3">
        <label className="font-mono text-xs font-bold uppercase text-black dark:text-white flex items-center gap-1.5">
          <Image className="h-4 w-4 text-amber-600" />
          Choose Preset Cover Poster or Paste URL:
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {samplePhotoPresets.map((presetUrl, idx) => (
            <div
              key={idx}
              onClick={() => handleClaimBounty(presetUrl)}
              className="group cursor-pointer rounded border-2 border-black overflow-hidden relative shadow-[2px_2px_0_0_#000] hover:scale-105 transition-all"
            >
              <img src={presetUrl} alt="Preset Cover" className="w-full h-24 object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-mono text-xs font-bold gap-1">
                Select & Claim <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          ))}
        </div>

        {/* Custom URL Input */}
        <div className="flex gap-2 pt-2">
          <input
            type="url"
            value={photoUrlInput}
            onChange={(e) => setPhotoUrlInput(e.target.value)}
            placeholder="Or paste image URL (https://...)"
            className="flex-1 border-2 border-black bg-white px-3 py-2 font-mono text-xs outline-none dark:bg-zinc-800 dark:text-white"
          />
          <button
            onClick={() => handleClaimBounty()}
            disabled={isUploading || !photoUrlInput}
            className="neu-border flex items-center gap-2 bg-amber-400 text-black px-4 py-2 font-mono text-xs font-bold uppercase transition-all hover:bg-amber-300 disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            Upload & Claim +150 Pts
          </button>
        </div>
      </div>
    </div>
  );
};
