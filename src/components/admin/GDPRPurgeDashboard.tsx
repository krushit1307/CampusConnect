import React, { useState } from "react";

export const GDPRPurgeDashboard = () => {
  const [studentName, setStudentName] = useState("");
  const [filePath, setFilePath] = useState("debate-club/minutes-2026.pdf");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handlePurge = async () => {
    if (!studentName || !filePath) {
      setStatusMessage("Please provide both the student name and the document path.");
      return;
    }

    setIsProcessing(true);
    setStatusMessage("Initiating PDF OCR and Redaction Pipeline...");

    try {
      const response = await fetch("http://localhost:54321/functions/v1/pdf-pii-redaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName, filePath }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Pipeline failed");

      setStatusMessage(`✅ Success: ${data.message}`);
    } catch (error) {
      console.error("Redaction error:", error);
      setStatusMessage("❌ Error: Failed to execute redaction pipeline. Check logs.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 mt-10 bg-slate-50 rounded-xl shadow-md border border-slate-200">
      <div className="border-b border-slate-300 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">GDPR Compliance: Document Redaction</h2>
        <p className="text-slate-600 mt-2">
          Execute a cascading purge to redact embedded PII from static binary documents (PDFs)
          stored in S3. This action is irreversible and overwrites the original source files.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Target Student Name (Exact Match)
          </label>
          <input
            type="text"
            placeholder="e.g. John Smith"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-3 focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            S3 / Storage File Path
          </label>
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-3 font-mono text-sm text-slate-600 bg-white focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>

        <button
          onClick={handlePurge}
          disabled={isProcessing}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-md shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
        >
          {isProcessing
            ? "Executing Redaction Pipeline..."
            : "⚠️ Permanently Redact & Overwrite Document"}
        </button>

        {statusMessage && (
          <div
            className={`p-4 rounded-md mt-4 font-medium ${statusMessage.includes("✅") ? "bg-green-100 text-green-800 border border-green-200" : statusMessage.includes("❌") ? "bg-red-100 text-red-800 border border-red-200" : "bg-blue-100 text-blue-800 border border-blue-200"}`}
          >
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
};
