// =============================================================================
// Component: SecureDocumentDownloadButton
// Issue: #3343 - Secure Document Watermarking Pipeline
// Description: Reusable UI button triggering secure PDF download with dynamic
// forensic watermarking (burning user email + timestamp at 20% opacity).
// =============================================================================

import React, { useState } from "react";
import {
  downloadSecureWatermarkedDocument,
  WatermarkDownloadResult,
} from "../../services/watermarkService";

interface SecureDocumentDownloadButtonProps {
  fileId: string;
  fileName: string;
  userEmail?: string;
  className?: string;
}

export const SecureDocumentDownloadButton: React.FC<SecureDocumentDownloadButtonProps> = ({
  fileId,
  fileName,
  userEmail = "alex.student@campus.edu",
  className = "",
}) => {
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<WatermarkDownloadResult | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setResult(null);

    const res = await downloadSecureWatermarkedDocument(fileId, fileName, userEmail);

    setDownloading(false);
    setResult(res);

    setTimeout(() => setResult(null), 5000);
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 text-xs border border-emerald-400/30 disabled:opacity-50 ${className}`}
      >
        {downloading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Burning Forensic Watermark...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4 text-emerald-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Secure Download (Watermarked)
          </>
        )}
      </button>

      {/* Security badge note */}
      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Watermarks {userEmail} @ 20% opacity
      </span>

      {result?.success && (
        <div className="mt-1 p-2 bg-emerald-950/80 border border-emerald-500/40 rounded-lg text-[11px] font-mono text-emerald-300">
          ✓ Downloaded {result.fileName} (Audit ID: {result.logId?.slice(0, 8)})
        </div>
      )}
    </div>
  );
};
