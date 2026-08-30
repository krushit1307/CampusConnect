import React, { useState } from "react";

export const NonCashDonationForm = () => {
  const [description, setDescription] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [marketValue, setMarketValue] = useState("");
  const [appraisalFile, setAppraisalFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const numericValue = parseFloat(marketValue.replace(/,/g, "")) || 0;
  const requiresAppraisal = numericValue > 5000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresAppraisal && !appraisalFile) {
      alert("A Qualified Written Appraisal PDF is required for donations over $5,000.");
      return;
    }

    setIsSubmitting(true);

    try {
      // In a real app, you would upload the appraisalFile to Supabase Storage first and pass the URL
      const payload = {
        description,
        acquisitionDate,
        marketValue: numericValue,
        donorName: "Current User", // Mocked for PR
        appraisalAttached: requiresAppraisal,
      };

      const response = await fetch("http://localhost:54321/functions/v1/generate-irs-8283", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to generate tax forms.");
      setSuccess(true);
    } catch (error) {
      console.error("Submission failed:", error);
      alert("Failed to process donation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-8 mt-10 bg-green-50 rounded-xl shadow-md border border-green-200 text-center">
        <h2 className="text-2xl font-bold text-green-700 mb-4">Donation Submitted! 🎉</h2>
        <p className="text-gray-700 mb-6">
          Your IRS Form 8283 has been generated and routed to the University Financial Office for
          counter-signature. You will receive the executed PDF via email for your tax records
          shortly.
        </p>
        <button
          onClick={() => {
            setSuccess(false);
            setDescription("");
            setMarketValue("");
          }}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded"
        >
          Submit Another Asset
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 mt-10 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Non-Cash Asset Donation</h2>
      <p className="text-gray-600 mb-6 border-b pb-4">
        Donate physical assets (e.g., equipment, vehicles) to the University. We will automatically
        generate your IRS Form 8283 for tax-exemption purposes.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Asset Description
          </label>
          <input
            type="text"
            required
            placeholder="e.g., Used HAAS VF-2 CNC Machine"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Date of Acquisition
            </label>
            <input
              type="date"
              required
              value={acquisitionDate}
              onChange={(e) => setAcquisitionDate(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Fair Market Value (USD)
            </label>
            <input
              type="number"
              required
              min="1"
              placeholder="e.g., 2500"
              value={marketValue}
              onChange={(e) => setMarketValue(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {requiresAppraisal && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded text-amber-900 text-sm">
            <strong>IRS Compliance Requirement:</strong> Because the claimed value exceeds $5,000,
            you must upload a Qualified Written Appraisal.
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setAppraisalFile(e.target.files?.[0] || null)}
              className="mt-3 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded transition-colors disabled:opacity-50 mt-4"
        >
          {isSubmitting ? "Generating Tax Forms..." : "Generate IRS Form 8283 & Route to Finance"}
        </button>
      </form>
    </div>
  );
};
