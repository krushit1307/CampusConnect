// =============================================================================
// File: src/components/events/MissingPhotoChaserTaskCard.tsx
// Task: Automated Missing Photo — Photo Chaser Task Management & RBAC Integration
// Description: Task Management task board card displaying assigned RBAC roles
//              (Media Lead, Marketing Chair, etc.), expiration countdown, photo upload
//              controls, and permission-restricted bounty claiming.
// =============================================================================

import { useState } from "react";
import {
  Gift,
  Image as ImageIcon,
  Zap,
  CheckCircle2,
  ShieldAlert,
  UploadCloud,
  Loader2,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  claimPhotoChaserWithRbacCheck,
  checkUserRbacPermission,
  type PhotoChaserRbacTask,
  type UserRbacRole,
  type RbacClaimResult,
} from "@/services/missingPhotoTaskRbacService";
import { toast } from "sonner";

export interface MissingPhotoChaserTaskCardProps {
  task: PhotoChaserRbacTask;
  userRole?: UserRbacRole;
  userId?: string;
  onTaskClaimed?: (result: RbacClaimResult) => void;
}

export function MissingPhotoChaserTaskCard({
  task,
  userRole = "event_organizer",
  userId = "user-1",
  onTaskClaimed,
}: MissingPhotoChaserTaskCardProps) {
  const [photoUrlInput, setPhotoUrlInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(task.status === "completed");
  const [claimResult, setClaimResult] = useState<RbacClaimResult | null>(null);

  const isAuthorized = checkUserRbacPermission(userRole);

  const samplePhotoPresets = [
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&fit=crop",
    "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&fit=crop",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&fit=crop",
  ];

  const handleClaimBounty = async (selectedUrl?: string) => {
    const targetUrl = selectedUrl || photoUrlInput;
    if (!targetUrl || targetUrl.trim().length === 0) {
      toast.error("Please select or enter a poster photo URL!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await claimPhotoChaserWithRbacCheck(
        task.id,
        task.eventId,
        targetUrl,
        userId,
        userRole
      );

      if (res.success) {
        setIsCompleted(true);
        setClaimResult(res);
        toast.success(res.message);
        if (onTaskClaimed) onTaskClaimed(res);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to claim missing photo task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted && claimResult) {
    return (
      <div
        className="neu-border border-4 border-black bg-emerald-100 p-5 shadow-[4px_4px_0_0_#000] space-y-2"
        data-testid="photo-chaser-task-completed"
      >
        <div className="flex items-center gap-3">
          <div className="border-2 border-black bg-emerald-500 p-2 text-white shadow-[2px_2px_0_0_#000]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="font-mono text-[10px] font-bold uppercase text-emerald-800 tracking-wider">
              Task Completed • Bounty Claimed 📸
            </span>
            <h4 className="font-display text-base font-black uppercase text-black">
              +{claimResult.pointsAwarded} Points & +{claimResult.xpAwarded} XP
            </h4>
            <p className="font-mono text-xs text-emerald-950 font-bold">
              Badge Unlocked: <strong className="text-black">{claimResult.badgeUnlocked}</strong> • Balance: {claimResult.newTotalPoints} pts
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="neu-border border-4 border-black bg-amber-50 p-5 shadow-[6px_6px_0_0_#000] space-y-4"
      data-testid="missing-photo-chaser-task-card"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-4 border-black pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="border-2 border-black bg-black text-white font-mono text-[10px] font-bold uppercase px-2 py-0.5">
              Task System
            </span>
            <span
              className="border-2 border-black bg-purple-300 text-purple-950 font-mono text-[10px] font-bold uppercase px-2 py-0.5"
              data-testid="rbac-assigned-role-badge"
            >
              Assigned Role: {task.assignedRole.replace("_", " ")} 📸
            </span>
          </div>

          <h3 className="font-display text-lg font-black uppercase text-black">
            {task.eventTitle}
          </h3>
        </div>

        <div className="border-2 border-black bg-amber-300 px-3 py-1.5 font-mono text-center shadow-[2px_2px_0_0_#000]">
          <span className="text-[10px] font-bold uppercase text-amber-950 block">Bounty Bribe</span>
          <span className="font-display text-lg font-black text-amber-950 flex items-center justify-center gap-0.5">
            <Zap className="h-4 w-4 fill-amber-950" /> +{task.bountyPoints} pts
          </span>
        </div>
      </div>

      {/* RBAC Permission Check Guard */}
      {!isAuthorized && (
        <div
          className="border-2 border-black bg-rose-100 p-3 flex items-start gap-2 shadow-[2px_2px_0_0_#000]"
          data-testid="rbac-unauthorized-warning"
        >
          <ShieldAlert className="h-5 w-5 text-rose-700 flex-shrink-0 mt-0.5" />
          <div className="font-mono text-xs text-rose-950 leading-snug">
            <span className="font-bold uppercase block text-rose-900">
              ⚠️ Role-Based Permission Restriction
            </span>
            Your current role ('{userRole}') is not authorized to claim this missing photo bounty. Fulfilling photo chaser tasks requires Media Lead, Marketing Chair, or Event Organizer permissions.
          </div>
        </div>
      )}

      {/* Expiration Timer & Instructions */}
      <div className="flex items-center justify-between font-mono text-xs text-gray-700 bg-white p-2.5 border-2 border-black">
        <span className="flex items-center gap-1.5 font-bold">
          <Clock className="h-4 w-4 text-amber-600" /> Deadline: 48 Hours
        </span>
        <span className="text-[11px] font-semibold text-gray-600">
          Upload poster to trigger instant points deposit
        </span>
      </div>

      {/* Preset Photo Selection */}
      <div className="space-y-2">
        <label className="font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4 text-amber-700" />
          Select Quick Poster Preset or Paste Custom URL:
        </label>
        <div className="grid grid-cols-3 gap-2">
          {samplePhotoPresets.map((presetUrl, idx) => (
            <button
              key={idx}
              type="button"
              disabled={!isAuthorized || isSubmitting}
              onClick={() => handleClaimBounty(presetUrl)}
              className="group border-2 border-black relative overflow-hidden h-20 shadow-[2px_2px_0_0_#000] hover:scale-[1.02] cursor-pointer disabled:opacity-50 transition-all"
              data-testid={`preset-photo-btn-${idx}`}
            >
              <img src={presetUrl} alt="Preset Cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-mono text-[10px] font-bold uppercase gap-1">
                Claim +150 <ArrowRight className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom URL Input & Claim Action */}
      <div className="flex gap-2 pt-1">
        <input
          type="url"
          value={photoUrlInput}
          onChange={(e) => setPhotoUrlInput(e.target.value)}
          placeholder="Paste poster image URL (https://...)"
          disabled={!isAuthorized || isSubmitting}
          className="flex-1 border-2 border-black bg-white px-3 py-2 font-mono text-xs outline-none shadow-[2px_2px_0_0_#000] disabled:bg-gray-100"
          data-testid="photo-url-input"
        />
        <button
          type="button"
          onClick={() => handleClaimBounty()}
          disabled={!isAuthorized || isSubmitting || !photoUrlInput.trim()}
          className="border-2 border-black bg-amber-400 hover:bg-amber-500 text-black font-mono text-xs font-black uppercase px-4 py-2 cursor-pointer shadow-[2px_2px_0_0_#000] active:translate-y-[1px] disabled:opacity-50 flex items-center gap-1.5"
          data-testid="claim-photo-chaser-btn"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          Claim Bounty
        </button>
      </div>
    </div>
  );
}
