import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  GraduationCap,
  Sparkles,
  HeartHandshake,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import {
  fetchRecommendedMentors,
  sendMentorshipRequest,
  respondToMentorshipRequest,
  dissolveMentorshipPartnership,
  type RecommendedMentor,
  type MentorshipProfile,
  type MentorshipPair,
} from "../../lib/mentorshipMatching";
import { createClient } from "../../lib/supabase/client";

export function MentorshipMatchingModule() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<MentorshipProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recommendedMentors, setRecommendedMentors] = useState<RecommendedMentor[]>([]);
  const [pairs, setPairs] = useState<MentorshipPair[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Form states for profile setup
  const [role, setRole] = useState<"mentor" | "mentee">("mentee");
  const [major, setMajor] = useState("");
  const [interestsInput, setInterestsInput] = useState("");
  const [bio, setBio] = useState("");
  const [capacity, setCapacity] = useState(2);

  // Request modal state
  const [selectedMentor, setSelectedMentor] = useState<RecommendedMentor | null>(null);
  const [requestMessage, setRequestMessage] = useState("");

  // Dissolution modal state
  const [dissolvingPairId, setDissolvingPairId] = useState<string | null>(null);
  const [dissolutionReason, setDissolutionReason] = useState("");

  const loadUserData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      // 1. Fetch user's mentorship profile
      const { data: profData } = await supabase
        .from("mentorship_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profData) {
        setProfile(profData as MentorshipProfile);
        setRole(profData.role);
        setMajor(profData.major);
        setInterestsInput(profData.interests?.join(", ") || "");
        setBio(profData.bio || "");
        setCapacity(profData.capacity || 2);

        // If mentee, load recommended mentors
        if (profData.role === "mentee") {
          const recRes = await fetchRecommendedMentors(user.id);
          if (recRes.success) {
            setRecommendedMentors(recRes.data);
          }
        }
      }

      // 2. Fetch active and pending pairs
      const { data: pairsData } = await supabase
        .from("mentorship_pairs")
        .select("*")
        .or(`mentor_id.eq.${user.id},mentee_id.eq.${user.id}`);

      if (pairsData) {
        setPairs(pairsData as MentorshipPair[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !major.trim()) return;

    const parsedInterests = interestsInput
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);

    try {
      const supabase = createClient();
      const payload = {
        user_id: currentUserId,
        role,
        major: major.trim(),
        interests: parsedInterests,
        bio: bio.trim(),
        capacity: role === "mentor" ? capacity : 1,
        is_active: true,
      };

      const { error } = await supabase.from("mentorship_profiles").upsert(payload);
      if (error) throw error;

      setFeedback({ type: "success", text: "Mentorship profile saved successfully!" });
      loadUserData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save profile";
      setFeedback({ type: "error", text: msg });
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !selectedMentor) return;

    const res = await sendMentorshipRequest(
      currentUserId,
      selectedMentor.mentor_id,
      requestMessage,
    );
    if (res.success) {
      setFeedback({ type: "success", text: res.message });
      setSelectedMentor(null);
      setRequestMessage("");
      loadUserData();
    } else {
      setFeedback({ type: "error", text: res.message });
    }
  };

  const handlePairResponse = async (pairId: string, status: "active" | "declined") => {
    const res = await respondToMentorshipRequest(pairId, status);
    if (res.success) {
      setFeedback({ type: "success", text: res.message });
      loadUserData();
    } else {
      setFeedback({ type: "error", text: res.message });
    }
  };

  const handleDissolvePair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dissolvingPairId || !dissolutionReason.trim()) return;

    const res = await dissolveMentorshipPartnership(dissolvingPairId, dissolutionReason);
    if (res.success) {
      setFeedback({ type: "success", text: res.message });
      setDissolvingPairId(null);
      setDissolutionReason("");
      loadUserData();
    } else {
      setFeedback({ type: "error", text: res.message });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-sm font-medium text-slate-500">Loading Mentorship Hub...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
          <HeartHandshake className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Peer & Alumni Mentorship Hub
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Connect with upperclassmen and alumni in your field based on major, career goals, and
            shared passions.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          role="alert"
          className={`rounded-xl p-4 text-sm font-medium ${
            feedback.type === "success"
              ? "border border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/50 dark:text-green-300"
              : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Profile Form Setup */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {profile ? "Your Mentorship Profile" : "Set Up Your Mentorship Profile"}
        </h2>
        <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                My Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "mentor" | "mentee")}
                className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="mentee">Mentee (Seeking guidance)</option>
                <option value="mentor">Mentor (Offering guidance)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Academic Major / Discipline
              </label>
              <input
                type="text"
                required
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="e.g. Computer Science, Mechanical Eng..."
                className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Interests & Tech Tags (comma separated)
            </label>
            <input
              type="text"
              value={interestsInput}
              onChange={(e) => setInterestsInput(e.target.value)}
              placeholder="e.g. Artificial Intelligence, Robotics, Web3, UI/UX Design"
              className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {role === "mentor" && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Maximum Mentee Capacity
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 2)}
                className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Bio & Focus Area
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Briefly describe your goals or what you'd like to share..."
              className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500"
          >
            Save Profile
          </button>
        </form>
      </div>

      {/* Active Partnerships Section */}
      {pairs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Your Mentorship Partnerships
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {pairs.map((pair) => (
              <div
                key={pair.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      pair.status === "active"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        : pair.status === "pending"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {pair.status.toUpperCase()}
                  </span>
                  {pair.status === "active" && (
                    <button
                      type="button"
                      onClick={() => setDissolvingPairId(pair.id)}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Dissolve Partnership
                    </button>
                  )}
                </div>

                {pair.request_message && (
                  <p className="mt-3 text-sm italic text-slate-600 dark:text-slate-300">
                    "{pair.request_message}"
                  </p>
                )}

                {pair.status === "pending" && pair.mentor_id === currentUserId && (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handlePairResponse(pair.id, "active")}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Accept Request
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePairResponse(pair.id, "declined")}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Mentors (For Mentees) */}
      {profile?.role === "mentee" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Recommended Mentors
            </h2>
            <span className="text-xs text-slate-500">Sorted by algorithm compatibility</span>
          </div>

          {recommendedMentors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <Users className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm text-slate-500">
                No mentors found matching your major or interests yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {recommendedMentors.map((mentor) => {
                const isFull = mentor.active_mentees >= mentor.capacity;
                return (
                  <div
                    key={mentor.mentor_id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {mentor.full_name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <GraduationCap className="h-3.5 w-3.5" />
                            {mentor.major}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                          {mentor.compatibility_score} pts Match
                        </div>
                      </div>

                      {mentor.bio && (
                        <p className="mt-3 text-xs text-slate-600 line-clamp-2 dark:text-slate-300">
                          {mentor.bio}
                        </p>
                      )}

                      {/* Interest pills */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {mentor.interests.map((interest, idx) => (
                          <span
                            key={idx}
                            className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                      <span
                        className={`text-xs font-medium ${
                          isFull ? "text-amber-600 dark:text-amber-400" : "text-slate-500"
                        }`}
                      >
                        {isFull
                          ? `At Capacity (${mentor.active_mentees}/${mentor.capacity})`
                          : `Accepting (${mentor.active_mentees}/${mentor.capacity})`}
                      </span>

                      <button
                        type="button"
                        disabled={isFull}
                        onClick={() => setSelectedMentor(mentor)}
                        className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40"
                      >
                        <Send className="h-3 w-3" />
                        Request Mentorship
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Send Request Modal */}
      {selectedMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Request Mentorship from {selectedMentor.full_name}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Introduce yourself and mention what advice or guidance you are seeking.
            </p>

            <form onSubmit={handleSendRequest} className="mt-4 space-y-4">
              <textarea
                required
                rows={4}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Hi! I'm a freshman studying CS interested in your journey with machine learning..."
                className="w-full rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMentor(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dissolution Modal */}
      {dissolvingPairId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-lg font-bold">Dissolve Mentorship Partnership</h3>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Please share a private reason for concluding this partnership. This feedback helps
              improve future pairings.
            </p>

            <form onSubmit={handleDissolvePair} className="mt-4 space-y-4">
              <textarea
                required
                rows={3}
                value={dissolutionReason}
                onChange={(e) => setDissolutionReason(e.target.value)}
                placeholder="Reason for conclusion (e.g. Schedule conflicts, goals met, switched majors...)"
                className="w-full rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDissolvingPairId(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Confirm Dissolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
