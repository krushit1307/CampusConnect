import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

interface OnboardingWizardProps {
  userId: string;
  onComplete: () => void;
}

export function OnboardingWizard({ userId, onComplete }: OnboardingWizardProps) {
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [major, setMajor] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: name,
          major: major,
          bio: bio,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save profile details";
      setErrorMsg(message);
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <motion.div
          key="onboarding-panel"
          className="neu-border w-full max-w-lg bg-white p-8 shadow-[8px_8px_0_0_#000]"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 6 }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 28,
            mass: 0.8,
          }}
        >
          <div className="mb-6 flex items-center justify-between border-b-2 border-black pb-4">
            <h2 className="font-mono text-lg font-black uppercase text-black">
              Welcome! Complete Your Profile ({step}/3)
            </h2>
            <span className="font-mono text-xs font-bold text-gray-500">Step {step} of 3</span>
          </div>

          {errorMsg && (
            <div className="mb-4 neu-border bg-peach p-3 font-mono text-xs text-black">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleNext} className="space-y-4">
            {step === 1 && (
              <div>
                <label className="block font-mono text-xs font-bold uppercase text-black mb-2">
                  What is your full name?
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="neu-border w-full p-3 font-mono text-sm focus:outline-none"
                />
              </div>
            )}

            {step === 2 && (
              <div>
                <label className="block font-mono text-xs font-bold uppercase text-black mb-2">
                  What is your Major / College?
                </label>
                <input
                  type="text"
                  required
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"
                  className="neu-border w-full p-3 font-mono text-sm focus:outline-none"
                />
              </div>
            )}

            {step === 3 && (
              <div>
                <label className="block font-mono text-xs font-bold uppercase text-black mb-2">
                  Write a short bio about yourself
                </label>
                <textarea
                  required
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us what you are working on or interested in..."
                  className="neu-border w-full p-3 font-mono text-sm focus:outline-none"
                />
              </div>
            )}

            <div className="flex justify-between pt-4">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="neu-border bg-white px-5 py-2.5 font-mono text-xs font-bold uppercase hover:bg-gray-100 cursor-pointer"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              <button
                type="submit"
                disabled={loading}
                className="neu-border neu-press bg-black px-6 py-2.5 font-mono text-xs font-bold uppercase text-cream hover:bg-cream hover:text-black transition-colors cursor-pointer"
              >
                {loading ? "Saving..." : step === 3 ? "Finish" : "Next"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
