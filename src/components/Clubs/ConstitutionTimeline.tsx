// src/components/Clubs/ConstitutionTimeline.tsx
// -----------------------------------------------------------------------------
// Issue #3690 — Interactive "Club Constitution" Version Timeline
//
// The "Time Machine" UI. Renders a horizontal slider whose stops are
// the archived constitution versions for a club. As the user drags,
// the right-hand pane re-renders with the full text of the version
// the slider is resting on. A "Compare to Current" button overlays a
// visual diff between the selected (historical) version and the
// current (latest) version.
// -----------------------------------------------------------------------------

import { useCallback, useMemo, useState } from "react";
import {
  GitCompare,
  History,
  Loader2,
  FileText,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useConstitutionTimeline } from "@/hooks/useConstitutionTimeline";
import {
  nearestStopForPosition,
  versionLabel,
  type ArchivedConstitution,
  type TimelineStop,
} from "@/lib/constitutionTimeline";
import { ConstitutionDiffModal } from "./ConstitutionDiffModal";

export interface ConstitutionTimelineProps {
  clubId: string;
  clubName?: string;
}

export function ConstitutionTimeline({
  clubId,
  clubName,
}: ConstitutionTimelineProps) {
  const {
    stops,
    selectedVersion,
    currentVersion,
    selectVersion,
    isLoading,
    error,
  } = useConstitutionTimeline(clubId);

  const [isDiffOpen, setIsDiffOpen] = useState(false);

  const sliderValue = useMemo(() => {
    if (!selectedVersion) return 0;
    const stop = stops.find(
      (s) => s.version.version_number === selectedVersion.version_number,
    );
    return stop ? stop.position : 0;
  }, [selectedVersion, stops]);

  const onSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const pos = Number(e.target.value);
      const stop = nearestStopForPosition(stops, pos);
      if (stop) selectVersion(stop.version.version_number);
    },
    [stops, selectVersion],
  );

  if (isLoading) {
    return (
      <div
        className="neu-border bg-white p-8 flex items-center justify-center"
        data-testid="constitution-timeline-loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-3 font-mono text-sm text-gray-600">
          Loading constitution history…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="neu-border bg-red-50 p-6 border-red-400"
        data-testid="constitution-timeline-error"
      >
        <p className="font-mono text-sm text-red-800">
          Could not load the constitution timeline: {error}
        </p>
      </div>
    );
  }

  if (stops.length === 0) {
    return (
      <div
        className="neu-border bg-white p-8 text-center"
        data-testid="constitution-timeline-empty"
      >
        <History className="h-10 w-10 mx-auto text-gray-300" />
        <p className="mt-3 font-display text-lg font-bold uppercase text-gray-500">
          No constitution history yet
        </p>
        <p className="mt-1 font-mono text-sm text-gray-400">
          Archived versions will appear here as the club uploads them.
        </p>
      </div>
    );
  }

  const isOnCurrent = selectedVersion?.is_current ?? false;

  return (
    <div
      className="neu-border bg-white p-6 space-y-6"
      data-testid="constitution-timeline"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b-4 border-black pb-4">
        <History className="h-6 w-6 text-blue-600" />
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight truncate">
            Constitution Timeline
          </h2>
          {clubName && (
            <p className="font-mono text-sm text-gray-600 truncate">
              {clubName}
            </p>
          )}
        </div>
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <SliderAxis stops={stops} selectedVersion={selectedVersion} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={sliderValue}
          onChange={onSliderChange}
          aria-label="Constitution version slider"
          aria-valuetext={
            selectedVersion
              ? versionLabel(selectedVersion)
              : "No version selected"
          }
          className="w-full h-2 cursor-pointer accent-blue-600"
          data-testid="constitution-timeline-slider"
        />
      </div>

      {/* Selected version header + actions */}
      {selectedVersion && (
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xl font-bold uppercase">
                {versionLabel(selectedVersion)}
              </h3>
              {selectedVersion.is_current && (
                <span className="bg-green-200 border-2 border-black px-2 py-0.5 text-xs font-bold font-mono">
                  CURRENT
                </span>
              )}
            </div>
            {selectedVersion.change_summary && (
              <p className="font-mono text-sm text-gray-600 mt-1">
                {selectedVersion.change_summary}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isOnCurrent && currentVersion && (
              <button
                onClick={() => setIsDiffOpen(true)}
                className="flex items-center gap-2 neu-border bg-yellow-300 px-4 py-2 font-mono text-sm font-bold uppercase hover:bg-yellow-400 transition-colors"
                data-testid="compare-to-current-btn"
              >
                <GitCompare className="h-4 w-4" />
                Compare to Current
              </button>
            )}
            {selectedVersion.file_url && (
              <DownloadButton version={selectedVersion} />
            )}
          </div>
        </div>
      )}

      {/* Constitution text pane */}
      {selectedVersion && <ConstitutionTextPane version={selectedVersion} />}

      {/* Diff modal */}
      {isDiffOpen && selectedVersion && currentVersion && (
        <ConstitutionDiffModal
          isOpen={isDiffOpen}
          onClose={() => setIsDiffOpen(false)}
          oldVersion={selectedVersion}
          newVersion={currentVersion}
        />
      )}
    </div>
  );
}

// ── Slider axis with year labels at each stop ─────────────────────────

function SliderAxis({
  stops,
  selectedVersion,
}: {
  stops: TimelineStop[];
  selectedVersion: ArchivedConstitution | null;
}) {
  return (
    <div className="relative h-8">
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-gray-200" />
      {stops.map((stop) => {
        const isSelected =
          selectedVersion?.version_number === stop.version.version_number;
        return (
          <button
            key={stop.key}
            type="button"
            onClick={() => {
              const slider = document.querySelector<HTMLInputElement>(
                '[data-testid="constitution-timeline-slider"]',
              );
              if (slider) {
                slider.value = String(stop.position);
                slider.dispatchEvent(new Event("input", { bubbles: true }));
              }
            }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center group"
            style={{ left: `${stop.position * 100}%` }}
            aria-label={`Jump to ${stop.shortDateLabel}`}
          >
            <span
              className={`block w-3 h-3 rounded-full border-2 border-black transition-transform group-hover:scale-125 ${
                isSelected ? "bg-blue-600 scale-125" : "bg-white"
              }`}
            />
            <span
              className={`mt-1 font-mono text-xs ${
                isSelected ? "font-bold text-blue-700" : "text-gray-500"
              }`}
            >
              {stop.yearLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Constitution text pane ────────────────────────────────────────────

function ConstitutionTextPane({
  version,
}: {
  version: ArchivedConstitution;
}) {
  return (
    <div
      className="border-2 border-black bg-gray-50 p-4 max-h-[500px] overflow-y-auto"
      data-testid="constitution-text-pane"
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-300">
        <FileText className="h-4 w-4 text-gray-500" />
        <span className="font-mono text-xs uppercase text-gray-500">
          Version {version.version_number} · full text
        </span>
      </div>
      <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
        {version.raw_text || "[Text not yet extracted from PDF]"}
      </pre>
    </div>
  );
}

// ── Download button ────────────────────────────────────────────────────

function DownloadButton({ version }: { version: ArchivedConstitution }) {
  const handleDownload = useCallback(async () => {
    if (!version.file_url) return;
    try {
      const supabase = createClient();
      const { data, error: dlError } = await supabase.storage
        .from("club_documents")
        .download(version.file_url!);
      if (dlError) throw dlError;
      const blobUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `constitution-v${version.version_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      toast.error(msg);
    }
  }, [version.file_url, version.version_number]);

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-2 neu-border bg-white px-4 py-2 font-mono text-sm font-bold uppercase hover:bg-gray-100 transition-colors"
      data-testid="download-version-btn"
    >
      <Download className="h-4 w-4" />
      Download PDF
    </button>
  );
}
