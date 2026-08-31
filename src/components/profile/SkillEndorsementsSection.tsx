import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BadgeCheck, Check, Copy, Loader2, ShieldCheck } from "lucide-react";
import {
  aggregateSkillEndorsements,
  buildRecruiterProfileLink,
  buildRecruiterSummaryText,
  endorsementStrength,
  endorsementStrengthLabel,
  formatWeightedScore,
  verifyProofDigests,
  type SkillEndorsementRecord,
} from "@/lib/skillEndorsements";

// =============================================================================
// SkillEndorsementsSection — Issue #3677: Dynamic "Skill Endorsement" System
//
// Public, recruiter-facing display of a student's verified endorsements on
// their profile. Each skill shows its trust-weighted score (an endorsement
// from a club president counts for 1.00, a peer's for 0.60), the endorsers
// behind it, and the event it was earned at. Every row's cryptographic proof
// digest is re-verified in the browser; passing rows carry a shield badge.
// On the student's own profile, a "Copy Profile Link" button (plus a
// copy-as-text summary) is tailored for sharing with recruiters.
// =============================================================================

export interface SkillEndorsementsSectionProps {
  profileId: string;
  profileHandle: string;
  profileName: string;
  isOwnProfile?: boolean;
}

const STRENGTH_STYLES: Record<string, string> = {
  highly_verified: "bg-lime text-black",
  verified: "bg-peach text-black",
  emerging: "bg-gray-100 text-gray-700",
};

function getInitials(name: string) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const SkillEndorsementsSection: React.FC<SkillEndorsementsSectionProps> = ({
  profileId,
  profileHandle,
  profileName,
  isOwnProfile = false,
}) => {
  const supabase = useMemo(() => createClient(), []);
  const [verifiedMap, setVerifiedMap] = useState<Map<string, boolean>>(new Map());
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "summary" | null>(null);

  const { data: endorsements = [], isLoading } = useQuery<SkillEndorsementRecord[]>({
    queryKey: ["skill-endorsements", profileId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_skill_endorsements", {
        p_user_id: profileId,
      });
      if (error) throw error;
      return (data ?? []) as SkillEndorsementRecord[];
    },
    enabled: Boolean(profileId),
  });

  // Re-verify each row's proof digest in the browser (SHA-256 over the
  // canonical payload) so the shield badge is earned, not decorative.
  useEffect(() => {
    let cancelled = false;
    if (endorsements.length === 0) {
      setVerifiedMap(new Map());
      return;
    }
    verifyProofDigests(endorsements).then((map) => {
      if (!cancelled) setVerifiedMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [endorsements]);

  const summaries = useMemo(() => aggregateSkillEndorsements(endorsements), [endorsements]);

  const verifiedCount = useMemo(() => {
    let count = 0;
    for (const isVerified of verifiedMap.values()) {
      if (isVerified) count += 1;
    }
    return count;
  }, [verifiedMap]);

  const profileLink = buildRecruiterProfileLink(profileHandle);

  const handleCopyLink = async () => {
    const ok = await copyText(profileLink);
    if (ok) {
      setCopied("link");
      toast.success("Profile link copied — ready to share with recruiters.", { icon: "🔗" });
      setTimeout(() => setCopied(null), 2000);
    } else {
      toast.error("Could not copy the link — select it from the address bar instead.");
    }
  };

  const handleCopySummary = async () => {
    const text = buildRecruiterSummaryText(profileName, summaries, profileLink);
    const ok = await copyText(text);
    if (ok) {
      setCopied("summary");
      toast.success("Verified-skills summary copied.", { icon: "📋" });
      setTimeout(() => setCopied(null), 2000);
    } else {
      toast.error("Could not copy the summary.");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 font-mono" data-testid="skill-endorsements-loading">
        <div className="flex items-center gap-2 border-b-2 border-black pb-2 text-xl font-bold font-display">
          <BadgeCheck size={24} className="text-brand-amber-base" />
          <h2>Verified Skills</h2>
        </div>
        <div className="flex items-center gap-2 font-mono text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Loading verified endorsements…
        </div>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="space-y-4 font-mono" data-testid="skill-endorsements-empty">
        <div className="flex items-center gap-2 border-b-2 border-black pb-2 text-xl font-bold font-display">
          <BadgeCheck size={24} className="text-brand-amber-base" />
          <h2>Verified Skills</h2>
        </div>
        <p className="text-sm text-gray-500 italic">
          {isOwnProfile
            ? "No endorsements yet — volunteer at club events and organizers can vouch for your skills here."
            : "No verified endorsements yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono" data-testid="skill-endorsements-section">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-2">
        <div className="flex items-center gap-2 text-xl font-bold font-display">
          <BadgeCheck size={24} className="text-brand-amber-base" />
          <h2>Verified Skills</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="neu-border inline-flex items-center gap-1 bg-white px-2.5 py-0.5 text-xs font-bold text-black">
            <ShieldCheck size={14} aria-hidden />
            {verifiedCount}/{endorsements.length} cryptographically verified
          </span>
          {isOwnProfile && (
            <>
              <button
                type="button"
                onClick={handleCopyLink}
                className="neu-border neu-press inline-flex items-center gap-1.5 bg-black px-3 py-1.5 text-xs font-bold uppercase text-cream transition-colors hover:bg-lime hover:text-black"
                aria-label="Copy profile link for sharing with recruiters"
              >
                {copied === "link" ? <Check size={14} /> : <Copy size={14} />}
                {copied === "link" ? "Copied" : "Copy Profile Link"}
              </button>
              <button
                type="button"
                onClick={handleCopySummary}
                className="neu-border neu-press inline-flex items-center gap-1.5 bg-white px-3 py-1.5 text-xs font-bold uppercase text-black transition-colors hover:bg-cream"
                aria-label="Copy a text summary of verified skills for recruiters"
              >
                {copied === "summary" ? <Check size={14} /> : <Copy size={14} />}
                {copied === "summary" ? "Copied" : "Copy for Recruiters"}
              </button>
            </>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Endorsements are issued by event organizers, weighted by their trust score, and
        cryptographically linked to the event where the skill was demonstrated.
      </p>

      <ul className="space-y-3">
        {summaries.map((summary) => {
          const strength = endorsementStrength(summary.weightedScore);
          const isOpen = openSkill === summary.skillTag;
          return (
            <li key={summary.skillTag} className="neu-border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold capitalize">
                      {summary.skillTag}
                    </span>
                    <span
                      className={`neu-border px-2 py-0.5 text-xs font-bold uppercase ${STRENGTH_STYLES[strength]}`}
                    >
                      {endorsementStrengthLabel(summary.weightedScore)}
                    </span>
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
                    {formatWeightedScore(summary.weightedScore)} weighted score ·{" "}
                    {summary.distinctEndorsers}{" "}
                    {summary.distinctEndorsers === 1 ? "endorser" : "endorsers"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenSkill(isOpen ? null : summary.skillTag)}
                  aria-expanded={isOpen}
                  className="neu-border neu-press shrink-0 bg-cream px-3 py-1.5 text-xs font-bold uppercase"
                >
                  {isOpen ? "Hide" : "Details"}
                </button>
              </div>

              {isOpen && (
                <ul className="mt-4 space-y-3 border-t-2 border-black pt-3">
                  {summary.endorsements.map((endorsement) => {
                    const isVerified = verifiedMap.get(endorsement.id) ?? false;
                    return (
                      <li key={endorsement.id} className="flex items-start gap-3">
                        <Avatar className="h-9 w-9 shrink-0 border-2 border-black rounded-none bg-white">
                          <AvatarImage
                            src={endorsement.endorser_avatar || undefined}
                            className="object-cover"
                          />
                          <AvatarFallback className="rounded-none bg-peach font-bold text-black">
                            {getInitials(
                              endorsement.endorser_name || endorsement.endorser_handle || "?",
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-bold">
                              {endorsement.endorser_name || `@${endorsement.endorser_handle}`}
                            </span>
                            <span
                              className={`neu-border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                endorsement.endorser_weight >= 0.95 ? "bg-lime" : "bg-gray-100"
                              }`}
                            >
                              {endorsement.endorser_weight >= 0.95
                                ? "Club leadership"
                                : endorsement.endorser_weight >= 0.75
                                  ? "Club officer"
                                  : "Organizer"}
                            </span>
                            {isVerified && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-gray-700"
                                title="SHA-256 proof digest verified against the event record"
                              >
                                <ShieldCheck size={12} aria-hidden /> Verified proof
                              </span>
                            )}
                          </div>
                          {endorsement.comment && (
                            <p className="text-xs text-gray-700">“{endorsement.comment}”</p>
                          )}
                          {endorsement.event_id && (
                            <p className="text-[10px] uppercase tracking-wide text-gray-500">
                              {endorsement.club_name ? `${endorsement.club_name} · ` : ""}
                              <Link to={`/events/${endorsement.event_id}`} className="underline">
                                {endorsement.event_title || "View event"}
                              </Link>
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-xs font-bold text-gray-600">
                          ×{formatWeightedScore(endorsement.endorser_weight)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
