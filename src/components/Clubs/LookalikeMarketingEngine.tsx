import React, { useState } from "react";
import {
  Users,
  Target,
  Send,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Search,
  Filter,
  Layers,
  ChevronRight,
  Lock,
} from "lucide-react";
import {
  ClubMemberProfile,
  CandidateUser,
  LookalikeMatchResult,
  calculateClubCentroid,
  generateLookalikeAudience,
} from "@/lib/lookalikeAudience";
import { cn } from "@/lib/utils";

export interface LookalikeMarketingEngineProps {
  clubId?: string;
  clubName?: string;
  activeMembers?: ClubMemberProfile[];
  candidates?: CandidateUser[];
  onDispatchCampaign?: (targetUserIds: string[], message: string) => void;
  className?: string;
}

export const MOCK_ACTIVE_MEMBERS: ClubMemberProfile[] = [
  { userId: "m1", major: "Computer Science", graduationYear: 2026, interestTags: ["React", "AI", "Hackathon"] },
  { userId: "m2", major: "Computer Science", graduationYear: 2026, interestTags: ["AI", "Python", "Web Development"] },
  { userId: "m3", major: "Computer Science", graduationYear: 2027, interestTags: ["React", "Cloud"] },
  { userId: "m4", major: "Data Science", graduationYear: 2026, interestTags: ["AI", "Machine Learning"] },
];

export const MOCK_CANDIDATE_USERS: CandidateUser[] = [
  {
    userId: "c-1",
    fullName: "Alex Rivera",
    handle: "alex_r",
    major: "Computer Science",
    graduationYear: 2026,
    interestTags: ["React", "AI", "Frontend"],
    optOutTargetedMarketing: false,
  },
  {
    userId: "c-2",
    fullName: "Sam Chen",
    handle: "sam_c",
    major: "Computer Science",
    graduationYear: 2027,
    interestTags: ["Web Development", "Python"],
    optOutTargetedMarketing: false,
  },
  {
    userId: "c-3",
    fullName: "Morgan Bailey",
    handle: "morgan_b",
    major: "Data Science",
    graduationYear: 2026,
    interestTags: ["Machine Learning", "AI"],
    optOutTargetedMarketing: false,
  },
  {
    userId: "c-4",
    fullName: "Taylor Private",
    handle: "taylor_p",
    major: "Computer Science",
    graduationYear: 2026,
    interestTags: ["React", "AI"],
    optOutTargetedMarketing: true, // Opted out of marketing
  },
];

export const LookalikeMarketingEngine: React.FC<LookalikeMarketingEngineProps> = ({
  clubId = "club-cs-1",
  clubName = "Computer Science Society",
  activeMembers = MOCK_ACTIVE_MEMBERS,
  candidates = MOCK_CANDIDATE_USERS,
  onDispatchCampaign,
  className,
}) => {
  const [selectedLimit, setSelectedLimit] = useState<number>(10);
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(false);
  const [campaignMessage, setCampaignMessage] = useState<string>(
    `Hi! Based on your interest in technology and software, we'd love to invite you to join the ${clubName}!`
  );
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  const centroid = calculateClubCentroid(activeMembers);
  const { matches, optOutCount } = generateLookalikeAudience(
    activeMembers,
    candidates,
    new Set(activeMembers.map((m) => m.userId)),
    selectedLimit
  );

  const handleSendCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (matches.length === 0 || !campaignMessage.trim()) return;

    const targetUserIds = matches.map((m) => m.userId);
    if (onDispatchCampaign) onDispatchCampaign(targetUserIds, campaignMessage.trim());

    setDispatchSuccess(`Targeted campaign dispatched to ${matches.length} lookalike students!`);
    setShowDispatchModal(false);
    setTimeout(() => setDispatchSuccess(null), 5000);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-sky-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-sky-950">
            <Target className="w-5 h-5 text-sky-700" />
            <span>Automated "Lookalike" Audience Marketing Engine — {clubName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Algorithmic demographic targeting. Analyzes active member traits to find non-member students with high affinity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowDispatchModal(true)}
          className="px-4 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
        >
          <Send className="w-4 h-4 text-emerald-400" />
          Dispatch Targeted Invite ({matches.length})
        </button>
      </div>

      {/* Campaign Success Confirmation Banner */}
      {dispatchSuccess && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{dispatchSuccess}</span>
        </div>
      )}

      {/* Main Grid: Club Demographic Centroid & Lookalike Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Active Member Demographic Centroid Profile Card */}
        <div className="lg:col-span-1 p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4 bg-slate-50">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-sky-600" />
              Club Centroid Profile
            </h4>
            <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
              {centroid.activeMemberCount} Active Members
            </span>
          </div>

          {/* Top Majors */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-gray-600 uppercase block">Top Member Majors:</span>
            <div className="space-y-1.5">
              {centroid.topMajors.slice(0, 3).map((m) => (
                <div key={m.major} className="p-2 border border-black rounded bg-white text-xs flex justify-between font-sans">
                  <span className="font-bold text-gray-900">{m.major}</span>
                  <span className="font-mono text-sky-700 font-bold">{m.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Interest Tags */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-gray-600 uppercase block">Top Interest Tags:</span>
            <div className="flex flex-wrap gap-1.5">
              {centroid.topInterestTags.slice(0, 6).map((t) => (
                <span
                  key={t.tag}
                  className="text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300 px-2 py-0.5 rounded"
                >
                  #{t.tag}
                </span>
              ))}
            </div>
          </div>

          {/* Privacy Guard Indicator (#3585) */}
          <div className="p-3 bg-purple-50 border border-purple-300 rounded-lg text-xs font-sans text-purple-950 space-y-1">
            <div className="flex items-center gap-1.5 font-bold font-mono text-[11px] text-purple-900">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              Privacy Guard Active
            </div>
            <p className="text-[11px] leading-relaxed">
              {optOutCount} student profiles were automatically excluded from marketing targeting per their privacy settings.
            </p>
          </div>
        </div>

        {/* Lookalike Recommendations Table */}
        <div className="lg:col-span-2 p-5 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              Ranked Lookalike Audience ({matches.length})
            </h4>
            <span className="text-[11px] font-sans text-gray-500">Sorted by similarity score</span>
          </div>

          {matches.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-xl text-xs text-gray-500">
              No matching lookalike candidates found.
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((cand) => (
                <div
                  key={cand.userId}
                  className="p-3.5 border-2 border-black rounded-lg bg-white space-y-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:border-sky-600 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-xs text-black">{cand.fullName}</h5>
                        <span className="text-xs font-sans text-gray-500">@{cand.handle}</span>
                      </div>
                      <span className="text-xs font-sans text-gray-700">
                        {cand.major} {cand.graduationYear ? `(' ${cand.graduationYear})` : ""}
                      </span>
                    </div>

                    <div className="text-left sm:text-right">
                      <span
                        className={cn(
                          "px-2.5 py-1 text-xs font-black rounded-full border",
                          cand.similarityScore >= 80
                            ? "bg-emerald-100 text-emerald-950 border-emerald-400"
                            : "bg-sky-100 text-sky-950 border-sky-400"
                        )}
                      >
                        🎯 {cand.similarityScore}% Match
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-100">
                    {cand.matchingReasons.map((reason, rIdx) => (
                      <span
                        key={rIdx}
                        className="text-[10px] font-bold bg-slate-100 border border-slate-300 text-slate-800 px-2 py-0.5 rounded"
                      >
                        ✓ {reason}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dispatch Targeted Campaign Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSendCampaign}
            className="bg-white border-2 border-black rounded-xl max-w-lg w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[85vh] overflow-auto font-mono"
          >
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-bold text-base uppercase flex items-center gap-2">
                <Send className="w-5 h-5 text-sky-600" />
                Dispatch Targeted Invite Campaign
              </h3>
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="px-3 py-1 border border-black bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
              >
                Close
              </button>
            </div>

            <div className="p-3 bg-sky-50 border border-sky-300 rounded text-xs font-sans text-sky-900 space-y-0.5">
              <span className="font-bold font-mono">Target Audience Size:</span>
              <p>{matches.length} highly matched lookalike students will receive a targeted push notification.</p>
            </div>

            <div>
              <label htmlFor="campaign-msg-input" className="text-xs font-bold uppercase block mb-1">
                Personalized Push Notification Message *
              </label>
              <textarea
                id="campaign-msg-input"
                required
                rows={4}
                value={campaignMessage}
                onChange={(e) => setCampaignMessage(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t-2 border-black/10">
              <button
                type="submit"
                className="px-4 py-2 border-2 border-black bg-emerald-600 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Send Targeted Push Notifications
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
