// =============================================================================
// File: src/components/events/CatererExportModal.tsx
// Task: Dynamic Dietary Restriction — Caterer Export Feature
// Description: Specialized Caterer Export modal for event organizers. Aggregates
//              attendee dietary restrictions into safe meal tallies and anonymizes
//              all student PII to generate CSV, JSON, and printable manifests.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  Utensils,
  Download,
  FileSpreadsheet,
  FileCode,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  X,
  Loader2,
} from "lucide-react";
import {
  fetchEventDietaryExportData,
  generateCatererCsvExport,
  generateCatererJsonManifest,
  generatePrintableSummaryText,
  type CatererExportManifest,
} from "@/services/catererExportService";
import { toast } from "sonner";

export interface CatererExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle?: string;
}

export function CatererExportModal({
  isOpen,
  onClose,
  eventId,
  eventTitle: initialTitle,
}: CatererExportModalProps) {
  const [manifest, setManifest] = useState<CatererExportManifest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    try {
      const data = await fetchEventDietaryExportData(eventId);
      if (initialTitle && (!data.eventTitle || data.eventTitle === "Campus Event")) {
        data.eventTitle = initialTitle;
      }
      setManifest(data);
    } catch (err: any) {
      toast.error("Failed to fetch dietary export manifest.");
    } finally {
      setIsLoading(false);
    }
  }, [eventId, initialTitle]);

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleDownloadCsv = () => {
    if (!manifest) return;
    const csvContent = generateCatererCsvExport(manifest);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = manifest.eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    link.href = url;
    link.setAttribute("download", `caterer-manifest-${safeTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Downloaded CSV caterer manifest!");
  };

  const handleDownloadJson = () => {
    if (!manifest) return;
    const jsonContent = generateCatererJsonManifest(manifest);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = manifest.eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    link.href = url;
    link.setAttribute("download", `caterer-manifest-${safeTitle}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Downloaded JSON caterer manifest!");
  };

  const handleCopySummary = async () => {
    if (!manifest) return;
    const text = generatePrintableSummaryText(manifest);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      toast.success("Copied printable kitchen summary to clipboard!");
      setTimeout(() => setCopiedText(false), 2500);
    } catch (err) {
      toast.error("Failed to copy summary to clipboard.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      data-testid="caterer-export-modal-overlay"
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col border-4 border-black bg-white shadow-[8px_8px_0_0_#000] overflow-hidden"
        data-testid="caterer-export-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-black bg-amber-400 p-4">
          <div className="flex items-center gap-3">
            <div className="border-2 border-black bg-black p-2 text-amber-400">
              <Utensils className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-black uppercase tracking-tight text-black">
                Caterer Export Manifest
              </h2>
              <p className="font-mono text-xs font-bold text-black/80">
                {manifest?.eventTitle || initialTitle || "Campus Event"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-black bg-white p-1 hover:bg-black hover:text-white cursor-pointer transition-colors"
            aria-label="Close modal"
            data-testid="caterer-export-close-button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Privacy Guarantee Banner */}
          <div
            className="flex items-start gap-3 border-2 border-black bg-emerald-100 p-3.5 shadow-[2px_2px_0_0_#000]"
            data-testid="caterer-export-privacy-badge"
          >
            <ShieldCheck className="h-5 w-5 text-emerald-800 flex-shrink-0 mt-0.5" />
            <div className="font-mono text-xs text-emerald-950 leading-snug">
              <span className="font-bold uppercase block text-emerald-900 mb-0.5">
                🔒 Strict Privacy Guarantee (GDPR / FERPA Compliant)
              </span>
              This export strictly aggregates meal counts and scrubs all student personal data (names, emails, phone numbers, UUIDs). Kitchen vendors receive exact quantities and anonymized safety tokens without access to student identities.
            </div>
          </div>

          {isLoading ? (
            <div
              className="flex flex-col items-center justify-center py-12 space-y-3"
              data-testid="caterer-export-loading"
            >
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
              <p className="font-mono text-sm font-bold text-gray-700">
                Aggregating dietary requirements & anonymizing PII…
              </p>
            </div>
          ) : manifest ? (
            <>
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border-2 border-black bg-gray-50 p-3 text-center shadow-[2px_2px_0_0_#000]">
                  <span className="font-mono text-[10px] font-bold uppercase text-gray-500">
                    Total RSVPs
                  </span>
                  <p className="font-display text-2xl font-black text-black">
                    {manifest.totalRsvps}
                  </p>
                </div>
                <div className="border-2 border-black bg-orange-50 p-3 text-center shadow-[2px_2px_0_0_#000]">
                  <span className="font-mono text-[10px] font-bold uppercase text-orange-800">
                    Dietary Requirements
                  </span>
                  <p className="font-display text-2xl font-black text-orange-700">
                    {manifest.totalDietaryRequirementsCount}
                  </p>
                </div>
                <div className="border-2 border-black bg-rose-50 p-3 text-center shadow-[2px_2px_0_0_#000]">
                  <span className="font-mono text-[10px] font-bold uppercase text-rose-800">
                    Severe Allergies
                  </span>
                  <p className="font-display text-2xl font-black text-rose-700">
                    {manifest.severeAllergies.length}
                  </p>
                </div>
              </div>

              {/* Severe Allergy Warnings */}
              {manifest.severeAllergies.length > 0 && (
                <div
                  className="border-2 border-black bg-rose-100 p-4 space-y-2.5 shadow-[3px_3px_0_0_#000]"
                  data-testid="caterer-export-severe-allergies"
                >
                  <div className="flex items-center gap-2 border-b-2 border-black pb-1.5">
                    <AlertTriangle className="h-5 w-5 text-rose-700 flex-shrink-0" />
                    <h3 className="font-mono text-xs font-black uppercase text-rose-950 tracking-wider">
                      Critical Severe Allergy Warnings ({manifest.severeAllergies.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {manifest.severeAllergies.map((sa, idx) => (
                      <div
                        key={idx}
                        className="border border-black bg-white p-2.5 flex flex-col gap-1 text-xs font-mono"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="bg-rose-600 text-white px-1.5 py-0.5 text-[10px] uppercase">
                            {sa.attendeeLabel}
                          </span>
                          <span className="text-rose-800 uppercase font-black">
                            {sa.dietaryTag} ({sa.severity})
                          </span>
                        </div>
                        {sa.note && (
                          <p className="text-gray-700 text-[11px]">
                            <strong className="text-black">Kitchen Note:</strong> {sa.note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aggregated Tag Table */}
              <div className="border-2 border-black bg-white overflow-hidden shadow-[3px_3px_0_0_#000]">
                <div className="border-b-2 border-black bg-gray-100 px-3 py-2 flex items-center justify-between">
                  <h3 className="font-mono text-xs font-black uppercase text-black">
                    Meal Breakdown Headcount
                  </h3>
                  <span className="font-mono text-[10px] text-gray-600 font-bold uppercase">
                    {manifest.summaryCounts.length} Categories
                  </span>
                </div>
                <table className="w-full border-collapse text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b-2 border-black bg-gray-50 text-[10px] text-gray-700 uppercase">
                      <th className="p-2.5">Category / Restriction</th>
                      <th className="p-2.5 text-right">Meal Headcount</th>
                      <th className="p-2.5 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifest.summaryCounts.map((sc) => (
                      <tr
                        key={sc.tag}
                        className="border-b border-gray-200 hover:bg-amber-50/50"
                        data-testid={`manifest-row-${sc.tag}`}
                      >
                        <td className="p-2.5 font-bold text-gray-900">{sc.tag}</td>
                        <td className="p-2.5 text-right font-display font-black text-base text-orange-700">
                          {sc.count}
                        </td>
                        <td className="p-2.5 text-right text-gray-600 font-bold">
                          {sc.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Anonymized Special Requests */}
              {manifest.anonymizedNotes.length > 0 && (
                <div className="border-2 border-black bg-amber-50 p-3 space-y-1.5 shadow-[2px_2px_0_0_#000]">
                  <h3 className="font-mono text-xs font-black uppercase text-amber-950">
                    Anonymized Special Requests
                  </h3>
                  <ul className="list-disc list-inside space-y-1 font-mono text-xs text-amber-900">
                    {manifest.anonymizedNotes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="font-mono text-xs text-red-600">
              No manifest data available.
            </p>
          )}
        </div>

        {/* Modal Footer / Actions */}
        <div className="border-t-4 border-black bg-gray-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopySummary}
            disabled={!manifest || isLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 border-2 border-black bg-white hover:bg-gray-200 text-black font-mono text-xs font-bold uppercase px-3 py-2 cursor-pointer shadow-[2px_2px_0_0_#000] active:translate-y-[1px] disabled:opacity-50"
            data-testid="caterer-export-copy-button"
          >
            {copiedText ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copiedText ? "Copied!" : "Copy Kitchen Summary"}
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={!manifest || isLoading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 border-2 border-black bg-emerald-400 hover:bg-emerald-500 text-black font-mono text-xs font-bold uppercase px-3 py-2 cursor-pointer shadow-[2px_2px_0_0_#000] active:translate-y-[1px] disabled:opacity-50"
              data-testid="caterer-export-download-csv"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Download CSV
            </button>

            <button
              type="button"
              onClick={handleDownloadJson}
              disabled={!manifest || isLoading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 border-2 border-black bg-cyan-400 hover:bg-cyan-500 text-black font-mono text-xs font-bold uppercase px-3 py-2 cursor-pointer shadow-[2px_2px_0_0_#000] active:translate-y-[1px] disabled:opacity-50"
              data-testid="caterer-export-download-json"
            >
              <FileCode className="h-4 w-4" />
              Download JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
