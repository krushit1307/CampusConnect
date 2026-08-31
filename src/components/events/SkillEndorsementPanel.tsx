import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BadgeCheck,
  ChevronDown,
  Handshake,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  ENDORSEMENT_WINDOW_DAYS,
  SUGGESTED_SKILL_TAGS,
  eventHasEnded,
  formatWeightedScore,
  isWithinEndorsementWindow,
  isValidComment,
  isValidSkillTag,
  normalizeSkillTag,
  trustWeightForPermissionsLevel,
} from "@/lib/skillEndorsements";

// =============================================================================
// SkillEndorsementPanel — Issue #3677: Dynamic "Skill Endorsement" System
//
// Shown to event organizers on the event page after the event ends. Prompts
// "Would you like to endorse your volunteers?", lets the organizer pick a
// volunteer (only people with verified attendance are listed by the
// backend), pick a skill tag and attach a performance note. Writes go
// through the endorse_volunteer_skill() RPC, which enforces attendance,
// organizer status and the 30-day window server-side.
// =============================================================================

interface EndorseableVolunteer {
  user_id: string;
  full_name: string;
  handle: string;
  avatar_url: string | null;
  attendance_method: string;
  endorsed_skills: string[];
}

interface ExistingEndorsement {
  id: string;
  user_id: string;
  skill_tag: string;
  comment: string | null;
  endorser_weight: number;
}

export interface SkillEndorsementPanelProps {
  eventId: string;
}

function getInitials(name: string) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const DISMISS_KEY = (eventId: string) => `endorsement_prompt_dismissed_${eventId}`;

export const SkillEndorsementPanel: React.FC<SkillEndorsementPanelProps> = ({ eventId }) => {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const [dismissed, setDismissed] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>("");
  const [skillTag, setSkillTag] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [viewerWeight, setViewerWeight] = useState<number>(0.6);

  // The event itself — endorsements unlock only once it has ended.
  const {
    data: event,
  } = useQuery<{
    end_date: string | null;
    start_date: string | null;
    event_date: string | null;
  } | null>({
    queryKey: ["endorsement-event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("end_date, start_date, event_date")
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const endedAt = event?.end_date || event?.start_date || event?.event_date || null;
  const hasEnded = eventHasEnded(endedAt);
  const windowOpen = isWithinEndorsementWindow(endedAt);

  // Restore the per-event dismissal state.
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY(eventId)) === "true");
    } catch {
      setDismissed(false);
    }
  }, [eventId]);

  // Volunteers the backend has verified as having actually attended.
  const { data: volunteers = [], isLoading: isLoadingVolunteers } = useQuery<
    EndorseableVolunteer[]
  >({
    queryKey: ["endorseable-volunteers", eventId],
    enabled: hasEnded,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_endorseable_volunteers", {
        p_event_id: eventId,
      });
      if (error) throw error;
      return (data ?? []) as EndorseableVolunteer[];
    },
  });

  // Endorsements already written for this event (any endorser).
  const { data: existing = [] } = useQuery<ExistingEndorsement[]>({
    queryKey: ["event-skill-endorsements", eventId],
    enabled: hasEnded,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_endorsements")
        .select("id, user_id, skill_tag, comment, endorser_weight")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data ?? []) as ExistingEndorsement[];
    },
  });

  // The viewer's own trust weight, for the live preview badge.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("events")
        .select("club_id, clubs (id)")
        .eq("id", eventId)
        .maybeSingle();
      const clubId = (data as { club_id: string | null } | null)?.club_id ?? null;
      if (!clubId) {
        setViewerWeight(0.5);
        return;
      }
      const { data: membership } = await supabase
        .from("club_members")
        .select("role_id, club_roles (permissions_level)")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .maybeSingle();
      const roles = (
        membership as {
          club_roles: { permissions_level: number } | { permissions_level: number }[] | null;
        } | null
      )?.club_roles;
      const level = Array.isArray(roles) ? roles[0]?.permissions_level : roles?.permissions_level;
      setViewerWeight(trustWeightForPermissionsLevel(level ?? null));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, eventId]);

  const endorseMutation = useMutation({
    mutationFn: async () => {
      const tag = normalizeSkillTag(skillTag);
      const { data, error } = await supabase.rpc("endorse_volunteer_skill", {
        p_event_id: eventId,
        p_user_id: selectedVolunteer,
        p_skill_tag: tag,
        p_comment: comment.trim() ? comment.trim() : null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      const volunteer = volunteers.find((v) => v.user_id === selectedVolunteer);
      toast.success(
        `Endorsed ${volunteer?.full_name || "volunteer"} for "${normalizeSkillTag(skillTag)}".`,
        {
          icon: "🏅",
        },
      );
      setSkillTag("");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["event-skill-endorsements", eventId] });
      queryClient.invalidateQueries({ queryKey: ["endorseable-volunteers", eventId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not save the endorsement.");
    },
  });

  const volunteerById = useMemo(() => {
    const map = new Map<string, EndorseableVolunteer>();
    for (const volunteer of volunteers) map.set(volunteer.user_id, volunteer);
    return map;
  }, [volunteers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVolunteer) {
      toast.error("Pick a volunteer to endorse.");
      return;
    }
    if (!isValidSkillTag(skillTag)) {
      toast.error("Skill tag must be 2–40 characters (letters, digits, ./&+-).");
      return;
    }
    if (!isValidComment(comment)) {
      toast.error("Comment must be 3–300 characters (or left empty).");
      return;
    }
    endorseMutation.mutate();
  };

  const dismissPrompt = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY(eventId), "true");
    } catch {
      /* localStorage unavailable — dismissal just won't persist */
    }
    setDismissed(true);
  };

  // Endorsements unlock only after the event ends.
  if (!hasEnded) return null;

  // The 30-day window has closed; nothing more to do here.
  if (!windowOpen) return null;

  if (dismissed) {
    return (
      <div className="neu-border flex items-center justify-between gap-4 bg-cream p-4">
        <p className="font-mono text-sm text-gray-600">
          Volunteer skill endorsements are open for this event.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="neu-border neu-press shrink-0 bg-lime px-3 py-1.5 font-mono text-xs font-bold uppercase text-black"
        >
          Endorse volunteers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="skill-endorsement-panel">
      <div className="flex items-center justify-between border-b-2 border-black pb-2">
        <div className="flex items-center gap-2 text-xl font-bold font-display">
          <Handshake size={24} className="text-brand-amber-base" />
          <h2>Endorse Your Volunteers</h2>
        </div>
        <button
          type="button"
          onClick={dismissPrompt}
          aria-label="Dismiss endorsement prompt"
          className="flex items-center gap-1 font-mono text-xs font-bold uppercase text-gray-500 hover:text-black"
        >
          <X size={14} /> Later
        </button>
      </div>

      <div className="neu-border space-y-4 bg-white p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="neu-border inline-flex items-center gap-1.5 bg-lime px-2.5 py-1 font-mono text-xs font-bold text-black">
            <Sparkles size={14} />
            The event has ended — would you like to endorse your volunteers?
          </span>
          <span className="neu-border inline-flex items-center gap-1.5 bg-peach px-2.5 py-1 font-mono text-xs font-bold text-black">
            <ShieldCheck size={14} />
            Your endorsement weight: {formatWeightedScore(viewerWeight)}
          </span>
        </div>
        <p className="font-mono text-sm leading-relaxed text-gray-600">
          Only volunteers with verified attendance appear below. Endorsements are linked to this
          event and remain editable for {ENDORSEMENT_WINDOW_DAYS} days.
        </p>

        {isLoadingVolunteers ? (
          <div className="flex items-center gap-2 font-mono text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" /> Loading verified attendees…
          </div>
        ) : volunteers.length === 0 ? (
          <p className="font-mono text-sm text-gray-500 italic">
            No volunteers with verified attendance yet — check-ins unlock endorsement.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Endorse a volunteer">
            {/* 1. Select volunteer */}
            <label className="block space-y-2">
              <span className="font-mono text-xs font-bold uppercase">Volunteer</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {volunteers.map((volunteer) => {
                  const isSelected = selectedVolunteer === volunteer.user_id;
                  return (
                    <button
                      type="button"
                      key={volunteer.user_id}
                      onClick={() => setSelectedVolunteer(volunteer.user_id)}
                      aria-pressed={isSelected}
                      className={`neu-border flex items-center gap-3 p-3 text-left transition-transform hover:-translate-y-0.5 ${
                        isSelected ? "bg-lime" : "bg-white"
                      }`}
                    >
                      <Avatar className="h-9 w-9 border-2 border-black rounded-none bg-white">
                        <AvatarImage
                          src={volunteer.avatar_url || undefined}
                          className="object-cover"
                        />
                        <AvatarFallback className="rounded-none bg-peach font-bold text-black">
                          {getInitials(volunteer.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm font-bold">
                          {volunteer.full_name}
                          <span className="font-normal text-gray-500"> @{volunteer.handle}</span>
                        </span>
                        <span className="block font-mono text-[10px] font-bold uppercase tracking-wide text-gray-600">
                          {volunteer.attendance_method === "shift_attendance"
                            ? "Verified shift attendance"
                            : "Verified check-in"}
                        </span>
                      </span>
                      {volunteer.endorsed_skills.length > 0 && (
                        <BadgeCheck size={16} className="shrink-0 text-gray-500" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </label>

            {/* 2. Select skill tag */}
            <label className="block space-y-2">
              <span className="font-mono text-xs font-bold uppercase">Skill</span>
              <input
                list="suggested-skill-tags"
                value={skillTag}
                onChange={(e) => setSkillTag(e.target.value)}
                placeholder="e.g. Audio Engineering"
                maxLength={60}
                className="neu-border w-full bg-white px-3 py-2 font-mono text-sm"
                aria-describedby="endorsement-skill-legend"
              />
              <datalist id="suggested-skill-tags">
                {SUGGESTED_SKILL_TAGS.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
              <p id="endorsement-skill-legend" className="font-mono text-[10px] text-gray-500">
                Pick a suggestion or type your own (2–40 characters).
              </p>
            </label>

            {/* 3. Add a note */}
            <label className="block space-y-2">
              <span className="font-mono text-xs font-bold uppercase">Note (optional)</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder='e.g. "Alex ran the 32-channel mixer flawlessly."'
                rows={3}
                maxLength={300}
                className="neu-border w-full resize-y bg-white px-3 py-2 font-mono text-sm"
              />
            </label>

            <button
              type="submit"
              disabled={endorseMutation.isPending}
              className="neu-border neu-press inline-flex items-center gap-2 bg-black px-5 py-2.5 font-mono text-xs font-bold uppercase text-cream transition-colors hover:bg-lime hover:text-black disabled:opacity-50"
            >
              {endorseMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <BadgeCheck size={16} />
              )}
              {endorseMutation.isPending ? "Saving…" : "Endorse skill"}
            </button>
          </form>
        )}

        {existing.length > 0 && (
          <div className="space-y-2 border-t-2 border-black pt-4">
            <p className="font-mono text-xs font-bold uppercase">
              <ChevronDown size={14} className="mr-1 inline" />
              Endorsements from this event ({existing.length})
            </p>
            <ul className="divide-y-2 divide-black font-mono text-sm">
              {existing.map((endorsement) => {
                const volunteer = volunteerById.get(endorsement.user_id);
                return (
                  <li
                    key={endorsement.id}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-bold">{volunteer?.full_name ?? "Volunteer"}</span>
                      {" — "}
                      <span className="neu-border bg-cream px-2 py-0.5 text-xs font-bold">
                        {endorsement.skill_tag}
                      </span>
                      {endorsement.comment && (
                        <span className="block truncate text-xs text-gray-600">
                          “{endorsement.comment}”
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-xs font-bold text-gray-600">
                      ×{formatWeightedScore(endorsement.endorser_weight)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
