// src/components/AutoTaggingSettings.tsx
import React, { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import Camera from "lucide-react/dist/esm/icons/camera";
import Check from "lucide-react/dist/esm/icons/check";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Upload from "lucide-react/dist/esm/icons/upload";
import Lock from "lucide-react/dist/esm/icons/lock";
import { FaceAutoTaggingService } from "@/services/faceAutoTaggingService";
import { UserFaceOptIn } from "@/types/faceAutoTagging";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface AutoTaggingSettingsProps {
  user: User | null;
}

export function AutoTaggingSettings({ user }: AutoTaggingSettingsProps) {
  const [optInStatus, setOptInStatus] = useState<UserFaceOptIn | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<(File | null)[]>([null, null, null]);
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null]);
  const [confirmOptOutOpen, setConfirmOptOutOpen] = useState(false);

  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    async function loadStatus() {
      try {
        const status = await FaceAutoTaggingService.getOptInStatus(user!.id);
        setOptInStatus(status);
        if (status?.facePhotos && status.facePhotos.length >= 3) {
          setPreviews([status.facePhotos[0], status.facePhotos[1], status.facePhotos[2]]);
        }
      } catch (err) {
        console.error("Failed to load auto-tagging status:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStatus();
  }, [user]);

  const handleFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }

    const updatedFiles = [...selectedFiles];
    updatedFiles[index] = file;
    setSelectedFiles(updatedFiles);

    const updatedPreviews = [...previews];
    updatedPreviews[index] = URL.createObjectURL(file);
    setPreviews(updatedPreviews);
  };

  const handleRemovePhoto = (index: number) => {
    const updatedFiles = [...selectedFiles];
    updatedFiles[index] = null;
    setSelectedFiles(updatedFiles);

    const updatedPreviews = [...previews];
    updatedPreviews[index] = null;
    setPreviews(updatedPreviews);

    if (fileInputRefs[index].current) {
      fileInputRefs[index].current!.value = "";
    }
  };

  const handleOptIn = async () => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const validFiles = selectedFiles.filter((f): f is File => f !== null);
    if (validFiles.length < 3) {
      toast.error("Please upload all 3 reference photos of your face to enable auto-tagging.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await FaceAutoTaggingService.optInUser(user.id, validFiles);
      toast.success(res.message || "Auto-tagging enabled successfully!");
      const updatedStatus = await FaceAutoTaggingService.getOptInStatus(user.id);
      setOptInStatus(updatedStatus);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to enable auto-tagging");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOptOut = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const res = await FaceAutoTaggingService.optOutUser(user.id);
      toast.success(res.message || "Opted out. All face data deleted.");
      setOptInStatus(null);
      setSelectedFiles([null, null, null]);
      setPreviews([null, null, null]);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to opt out");
    } finally {
      setIsSubmitting(false);
      setConfirmOptOutOutOpen(false);
    }
  };

  const setConfirmOptOutOutOpen = (open: boolean) => {
    setConfirmOptOutOpen(open);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-4 font-mono text-sm">
        <Loader2 className="h-5 w-5 animate-spin text-black" />
        <span>Loading facial recognition settings...</span>
      </div>
    );
  }

  const isOptedIn = Boolean(optInStatus?.optedIn);
  const readyToSubmit = selectedFiles.filter(Boolean).length === 3;

  return (
    <div className="space-y-6">
      {/* Header & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h3 className="font-display text-xl font-bold uppercase text-black">
              Automated Photo Auto-Tagging
            </h3>
          </div>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Opt in to automatically get tagged and notified whenever you appear in event photo albums!
          </p>
        </div>

        <div className="shrink-0">
          {isOptedIn ? (
            <span className="neu-border inline-flex items-center gap-1.5 bg-emerald-400 px-3 py-1.5 font-mono text-xs font-bold uppercase text-black">
              <Check className="h-4 w-4" /> Auto-Tagging Active
            </span>
          ) : (
            <span className="neu-border inline-flex items-center gap-1.5 bg-gray-200 px-3 py-1.5 font-mono text-xs font-bold uppercase text-gray-700">
              Disabled
            </span>
          )}
        </div>
      </div>

      {/* Privacy & Consent Banner */}
      <div className="border-2 border-black bg-amber-50 p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] text-black font-mono text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-900 uppercase">
          <Lock className="h-4 w-4 text-amber-700" />
          Strict Privacy & Consent Guarantee
        </div>
        <p className="text-gray-800 leading-relaxed">
          This feature is strictly <strong>opt-in</strong>. Your reference photos are used exclusively to create a facial vector index linked to your account. If you opt out at any time, your facial index data and reference photos are <strong>cryptographically deleted immediately</strong>.
        </p>
      </div>

      {/* Reference Photo Upload Grid */}
      <div className="space-y-3">
        <label className="eyebrow font-bold text-black flex items-center justify-between">
          <span>Baseline Reference Photos (3 Required)</span>
          <span className="font-mono text-xs font-normal text-muted-foreground">
            Upload 3 clear front-facing photos of your face
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((idx) => {
            const previewUrl = previews[idx];
            const hasPhoto = Boolean(previewUrl);

            return (
              <div
                key={idx}
                className={`relative neu-border flex flex-col items-center justify-center p-4 min-h-[160px] text-center transition-all ${
                  hasPhoto ? "bg-emerald-50 border-black" : "bg-gray-50 border-dashed border-gray-400 hover:bg-gray-100"
                }`}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  ref={fileInputRefs[idx]}
                  onChange={(e) => handleFileSelect(idx, e)}
                  disabled={isSubmitting}
                />

                {hasPhoto ? (
                  <div className="relative w-full h-full flex flex-col items-center">
                    <img
                      src={previewUrl!}
                      alt={`Reference face #${idx + 1}`}
                      className="w-24 h-24 object-cover rounded-full border-2 border-black mb-2"
                    />
                    <span className="font-mono text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Photo #{idx + 1} Ready
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      disabled={isSubmitting}
                      className="mt-2 text-xs font-mono font-bold text-red-600 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Remove / Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRefs[idx].current?.click()}
                    disabled={isSubmitting}
                    className="flex flex-col items-center justify-center h-full w-full py-4 text-gray-600 hover:text-black"
                  >
                    <div className="h-10 w-10 rounded-full border-2 border-black bg-white flex items-center justify-center mb-2 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                      <Camera className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs font-bold uppercase">
                      Upload Photo #{idx + 1}
                    </span>
                    <span className="font-mono text-[10px] text-gray-500 mt-1">
                      JPG, PNG, WebP (Max 5MB)
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t-2 border-black">
        {isOptedIn ? (
          <>
            <button
              type="button"
              onClick={handleOptIn}
              disabled={isSubmitting || !readyToSubmit}
              className="neu-border neu-press flex items-center gap-2 bg-[#FFD166] px-4 py-2 font-mono text-xs font-bold uppercase text-black disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Updating Index...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Update Face Reference Photos
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setConfirmOptOutOutOpen(true)}
              disabled={isSubmitting}
              className="neu-border neu-press flex items-center gap-2 bg-red-600 px-4 py-2 font-mono text-xs font-bold uppercase text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" /> Opt-Out & Delete All Face Data
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleOptIn}
            disabled={isSubmitting || !readyToSubmit}
            className="neu-border neu-press flex items-center gap-2 bg-black px-6 py-2.5 font-mono text-xs font-bold uppercase text-cream disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Indexing Face Data...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300" /> Save & Enable Auto-Tagging
              </>
            )}
          </button>
        )}
      </div>

      <ConfirmModal
        open={confirmOptOutOpen}
        title="Opt Out of Facial Recognition Auto-Tagging?"
        description="This will cryptographically delete all your reference face photos, your AI facial index, and all existing photo tag records. This action is immediate and cannot be undone."
        confirmText="Opt Out & Delete Face Data"
        cancelText="Cancel"
        onCancel={() => setConfirmOptOutOutOpen(false)}
        onConfirm={handleOptOut}
      />
    </div>
  );
}
