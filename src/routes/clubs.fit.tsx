import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Users from "lucide-react/dist/esm/icons/users";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Check from "lucide-react/dist/esm/icons/check";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";

interface RecommendedClub {
  club_id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  match_percentage: number;
}

const QUESTIONS = [
  {
    id: "interests",
    question: "What are your primary interests?",
    description: "Select all that apply to help us map your passions.",
    type: "multiple",
    options: [
      { value: "coding", label: "💻 Coding & Tech" },
      { value: "sports", label: "⚽ Sports & Fitness" },
      { value: "gaming", label: "🎮 Gaming & Esports" },
      { value: "music", label: "🎵 Music & Performance" },
      { value: "art", label: "🎨 Art & Design" },
      { value: "debate", label: "🗣️ Debate & Politics" },
      { value: "robotics", label: "🤖 Robotics & Hardware" },
      { value: "photography", label: "📷 Photography & Film" },
      { value: "outdoor", label: "🌲 Outdoors & Hiking" },
      { value: "casual", label: "🍕 Casual & Social" },
    ],
  },
  {
    id: "major",
    question: "What is your academic major or department?",
    description: "Connect with peers in your field of study.",
    type: "single",
    options: [
      { value: "Computer Science", label: "Computer Science" },
      { value: "Engineering", label: "Engineering" },
      { value: "Business", label: "Business & Economics" },
      { value: "Arts & Humanities", label: "Arts & Humanities" },
      { value: "Sciences", label: "Physical/Life Sciences" },
    ],
  },
  {
    id: "time_commitment",
    question: "How much time can you commit to club activities?",
    description: "This filters for low, medium, or high commitment levels.",
    type: "single",
    options: [
      { value: "low_commitment", label: "⏱️ Low (1-2 hours / week)" },
      { value: "medium_commitment", label: "⏱️ Medium (3-5 hours / week)" },
      { value: "high_commitment", label: "⏱️ High (6+ hours / week)" },
    ],
  },
  {
    id: "indoor_outdoor",
    question: "Do you prefer indoor or outdoor activities?",
    description: "Helps tailor the environment to your liking.",
    type: "single",
    options: [
      { value: "indoor", label: "🏠 Indoor activities" },
      { value: "outdoor", label: "🌳 Outdoor activities" },
      { value: "both", label: "🔄 No preference (Both)" },
    ],
  },
  {
    id: "focus",
    question: "Are you looking for career networking or casual fun?",
    description: "Balance professional growth with recreation.",
    type: "single",
    options: [
      { value: "career", label: "👔 Career & Networking" },
      { value: "casual", label: "🎉 Casual & Fun" },
      { value: "both", label: "🔄 A mix of both" },
    ],
  },
];

export default function ClubDiscoveryQuiz() {
  const supabase = createClient();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({
    interests: [],
    major: "",
    time_commitment: "",
    indoor_outdoor: "",
    focus: "",
  });

  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<RecommendedClub[]>([]);
  const [joinedClubIds, setJoinedClubIds] = useState<Set<string>>(new Set());
  const [joiningAll, setJoiningAll] = useState(false);
  const [joiningIds, setJoiningIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        // Load user's already joined clubs
        supabase
          .from("club_members")
          .select("club_id")
          .eq("user_id", user.id)
          .then(({ data }) => {
            if (data) {
              setJoinedClubIds(new Set(data.map((row) => row.club_id)));
            }
          });
      }
    });
  }, [supabase]);

  const handleSelectSingle = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectMultiple = (key: string, value: string) => {
    setAnswers((prev) => {
      const current = prev[key] || [];
      const updated = current.includes(value)
        ? current.filter((v: string) => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const handleNext = () => {
    const q = QUESTIONS[currentStep];
    if (q.type === "single" && !answers[q.id]) {
      toast.error("Please select an option to proceed.");
      return;
    }
    if (q.type === "multiple" && answers[q.id].length === 0) {
      toast.error("Please select at least one option.");
      return;
    }

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    setIsSubmitting(true);
    try {
      // Build answers vector/payload
      const payloadInterests = [...answers.interests];
      if (answers.indoor_outdoor !== "both") {
        payloadInterests.push(answers.indoor_outdoor);
      }
      if (answers.focus !== "both") {
        payloadInterests.push(answers.focus);
      }

      const formattedAnswers = {
        interests: payloadInterests,
        time_commitment: answers.time_commitment,
        major: answers.major,
      };

      const { data, error } = await supabase.rpc("get_club_recommendations", {
        user_answers: formattedAnswers,
      });

      if (error) throw error;
      setResults(data || []);
      setCurrentStep(QUESTIONS.length); // Step to show results
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate recommendations. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinClub = async (clubId: string) => {
    if (!userId) {
      toast.error("You must be logged in to join a club.");
      return;
    }
    setJoiningIds((prev) => new Set(prev).add(clubId));
    try {
      const { error } = await supabase
        .from("club_members")
        .insert({ club_id: clubId, user_id: userId, status: "active", role: "member" });
      if (error) throw error;
      setJoinedClubIds((prev) => new Set(prev).add(clubId));
      toast.success("Joined club successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to join club.");
    } finally {
      setJoiningIds((prev) => {
        const next = new Set(prev);
        next.delete(clubId);
        return next;
      });
    }
  };

  const handleJoinAll = async () => {
    if (!userId) {
      toast.error("You must be logged in to join clubs.");
      return;
    }
    setJoiningAll(true);
    const unjoined = results.filter((r) => !joinedClubIds.has(r.club_id));
    if (unjoined.length === 0) {
      toast.info("You have already joined all recommended clubs!");
      setJoiningAll(false);
      return;
    }

    try {
      const inserts = unjoined.map((r) =>
        supabase.from("club_members").insert({
          club_id: r.club_id,
          user_id: userId,
          status: "active",
          role: "member",
        }),
      );
      const resultsJoin = await Promise.all(inserts);
      const hasError = resultsJoin.some((res) => res.error);
      if (hasError) throw new Error("Some inserts failed");

      setJoinedClubIds((prev) => {
        const next = new Set(prev);
        unjoined.forEach((r) => next.add(r.club_id));
        return next;
      });
      toast.success(`Successfully joined all ${unjoined.length} clubs!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to join all clubs. Some might have succeeded.");
    } finally {
      setJoiningAll(false);
    }
  };

  const activeQuestion = QUESTIONS[currentStep];

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-12 md:px-6">
        <AnimatePresence mode="wait">
          {currentStep < QUESTIONS.length ? (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="border-2 border-black bg-white p-8 shadow-[6px_6px_0_0_#000] relative"
            >
              {/* Progress bar */}
              <div className="w-full bg-gray-200 h-2 mb-6 border border-black">
                <div
                  className="bg-sky h-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }}
                />
              </div>

              <div className="mb-6">
                <span className="font-mono text-xs font-bold uppercase text-gray-500">
                  Question {currentStep + 1} of {QUESTIONS.length}
                </span>
                <h2 className="text-2xl font-bold uppercase tracking-wide text-black mt-1">
                  {activeQuestion.question}
                </h2>
                <p className="font-mono text-xs text-gray-600 mt-2">{activeQuestion.description}</p>
              </div>

              {/* Options mapping */}
              <div className="grid grid-cols-1 gap-3 mb-8">
                {activeQuestion.options.map((opt) => {
                  const isSelected =
                    activeQuestion.type === "single"
                      ? answers[activeQuestion.id] === opt.value
                      : answers[activeQuestion.id]?.includes(opt.value);

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        activeQuestion.type === "single"
                          ? handleSelectSingle(activeQuestion.id, opt.value)
                          : handleSelectMultiple(activeQuestion.id, opt.value)
                      }
                      className={`neu-border p-4 text-left font-mono text-sm font-bold uppercase transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-yellow-100 border-black shadow-[2px_2px_0_0_#000] translate-x-[1px] translate-y-[1px]"
                          : "bg-cream border-gray-400 hover:bg-yellow-50"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-black" />}
                    </button>
                  );
                })}
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-black">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 0 || isSubmitting}
                  className="font-mono text-xs font-bold uppercase border-2 border-black flex items-center gap-2 rounded-none bg-white hover:bg-gray-100 text-black"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>

                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="font-mono text-xs font-bold uppercase border-2 border-black flex items-center gap-2 rounded-none bg-black text-white hover:bg-gray-800"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : currentStep === QUESTIONS.length - 1 ? (
                    <>
                      Finish
                      <Sparkles className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          ) : (
            /* Results Screen */
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="border-2 border-black bg-cream p-8 shadow-[8px_8px_0_0_#000]"
            >
              <div className="text-center mb-8">
                <Sparkles className="h-12 w-12 text-yellow-500 mx-auto mb-2 animate-pulse" />
                <h2 className="text-3xl font-bold uppercase tracking-widest text-black">
                  Your Club Matches
                </h2>
                <p className="font-mono text-xs text-gray-500 mt-2">
                  Based on your onboarding quiz, here are the top organizations suited for you.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {results.map((club) => {
                  const isJoined = joinedClubIds.has(club.club_id);
                  const isJoining = joiningIds.has(club.club_id);

                  return (
                    <div
                      key={club.club_id}
                      className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg uppercase tracking-wide text-black">
                            {club.name}
                          </h3>
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 uppercase">
                            {Math.round(club.match_percentage)}% Match
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {club.description || "No description provided."}
                        </p>
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/clubs/${club.slug}`)}
                          className="font-mono text-xs font-bold uppercase border-2 border-black rounded-none flex-1 sm:flex-initial bg-white hover:bg-gray-100 text-black h-9"
                        >
                          View
                        </Button>
                        <Button
                          disabled={isJoined || isJoining}
                          onClick={() => handleJoinClub(club.club_id)}
                          className={`font-mono text-xs font-bold uppercase border-2 border-black rounded-none flex-1 sm:flex-initial h-9 ${
                            isJoined
                              ? "bg-gray-200 text-gray-500 border-gray-300"
                              : "bg-sky text-black hover:bg-sky-400"
                          }`}
                        >
                          {isJoining ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isJoined ? (
                            "Joined"
                          ) : (
                            "Join"
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Join All Options */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleJoinAll}
                  disabled={joiningAll || results.every((r) => joinedClubIds.has(r.club_id))}
                  className="flex-1 font-mono text-sm font-bold uppercase border-2 border-black bg-emerald-400 text-black hover:bg-emerald-500 shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] transition-all h-12 rounded-none flex items-center justify-center gap-2"
                >
                  {joiningAll ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Join All Recommended
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/clubs")}
                  className="font-mono text-sm font-bold uppercase border-2 border-black bg-white hover:bg-gray-100 text-black h-12 rounded-none px-6"
                >
                  Go to Directory
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SiteShell>
  );
}
