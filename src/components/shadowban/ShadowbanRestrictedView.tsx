import React, { useState } from "react";

export const ShadowbanRestrictedView = () => {
  const [signature, setSignature] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedApology, setGeneratedApology] = useState("");
  const [isRestored, setIsRestored] = useState(false);

  const handleGenerateApology = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("http://localhost:54321/functions/v1/generate-apology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toxicMessages: [
            "This community is complete garbage and everyone here is an idiot.",
            "I hope your computer crashes, you absolute losers.",
          ],
        }),
      });

      if (!response.ok) throw new Error("Failed to generate apology");
      const data = await response.json();
      setGeneratedApology(data.apology);
    } catch (error) {
      console.error("Error fetching apology:", error);
      alert("Something went wrong drafting the apology. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSignAndSubmit = async () => {
    if (!signature) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("http://localhost:54321/functions/v1/lift-shadowban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: signature,
          generatedApology: generatedApology,
          userId: "dummy-user-id-123", // TODO: Replace with actual logged-in user ID
        }),
      });

      if (!response.ok) throw new Error("Failed to lift ban");

      // Show success screen!
      setIsRestored(true);
    } catch (error) {
      console.error("Error submitting signature:", error);
      alert("Something went wrong. Please try signing again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isRestored) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-50 p-6">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg border border-green-200 p-8 text-center">
          <h1 className="text-3xl font-bold text-green-600 mb-4">Account Restored 🎉</h1>
          <p className="text-gray-700 mb-6">
            Thank you, {signature}. Your apology has been recorded and your account restrictions
            have been instantly lifted.
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-6">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg border border-red-200 p-8">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Account Restricted</h1>
        <p className="text-gray-700 mb-6">
          Your account has been temporarily restricted due to recent activity that violates our
          community guidelines regarding negativity and harassment.
        </p>

        {!generatedApology ? (
          <div className="text-center bg-gray-50 p-6 rounded-lg border border-gray-200">
            <p className="text-gray-600 mb-4">
              To restore your access, you must acknowledge the impact of your actions.
            </p>
            <button
              onClick={handleGenerateApology}
              disabled={isGenerating}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded transition-colors disabled:opacity-50"
            >
              {isGenerating ? "Drafting Apology..." : "Draft Automated Apology"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded text-gray-800 italic">
              "{generatedApology}"
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="signature" className="font-semibold text-gray-700">
                Type your Full Legal Name to sign this apology:
              </label>
              <input
                id="signature"
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="e.g. John Doe"
                className="border border-gray-300 rounded p-2 focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>

            <button
              onClick={handleSignAndSubmit}
              disabled={!signature || isSubmitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Restoring Account..." : "Sign & Restore Account"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
