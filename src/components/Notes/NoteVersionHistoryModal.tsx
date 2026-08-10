import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  History,
  Clock,
  User,
  RotateCcw,
  FileText,
  GitCompare,
  Plus,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useNoteVersions, type NoteVersion } from "@/hooks/useNoteVersions";
import { NoteDiffViewer } from "./NoteDiffViewer";
import { toast } from "sonner";

interface NoteVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  currentTitle: string;
  currentContentText: string;
  currentYjsState: string;
  isAdmin: boolean;
  onVersionRestored?: () => void;
}

export const NoteVersionHistoryModal: React.FC<NoteVersionHistoryModalProps> = ({
  isOpen,
  onClose,
  noteId,
  currentTitle,
  currentContentText,
  currentYjsState,
  isAdmin,
  onVersionRestored,
}) => {
  const {
    versions,
    isLoading,
    isSaving,
    isRestoring,
    fetchVersions,
    createSnapshot,
    restoreVersion,
  } = useNoteVersions(isOpen ? noteId : null);

  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "diff">("preview");
  const [compareTarget, setCompareTarget] = useState<"previous" | "current">("previous");
  const [showCreateSnapshot, setShowCreateSnapshot] = useState(false);
  const [snapshotSummary, setSnapshotSummary] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, fetchVersions]);

  useEffect(() => {
    if (versions.length > 0 && !selectedVersion) {
      setSelectedVersion(versions[0]);
    }
  }, [versions, selectedVersion]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentYjsState) {
      toast.error("No document state available to snapshot.");
      return;
    }
    const created = await createSnapshot(
      currentTitle,
      currentContentText,
      currentYjsState,
      snapshotSummary || `Manual snapshot ${new Date().toLocaleTimeString()}`,
    );
    if (created) {
      setSelectedVersion(created);
      setShowCreateSnapshot(false);
      setSnapshotSummary("");
    }
  };

  const handleRestore = async (version: NoteVersion) => {
    if (!isAdmin) {
      toast.error("Only club admins can restore historical document versions.");
      return;
    }
    if (
      confirm(
        `Are you sure you want to restore Version ${version.version_number}? This will update the active document.`,
      )
    ) {
      const ok = await restoreVersion(version);
      if (ok) {
        onVersionRestored?.();
        onClose();
      }
    }
  };

  // Find target text to compare against
  const getCompareText = (): string => {
    if (!selectedVersion) return "";
    if (compareTarget === "current") {
      return currentContentText;
    }
    // Previous version in historical array
    const currIndex = versions.findIndex((v) => v.id === selectedVersion.id);
    if (currIndex !== -1 && currIndex + 1 < versions.length) {
      return versions[currIndex + 1].content_text || "";
    }
    return "";
  };

  const compareText = getCompareText();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl border-2 border-black bg-white p-6 shadow-[8px_8px_0_0_var(--color-ink)] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-lime">
                <History className="h-6 w-6 text-black" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-black font-display uppercase">
                  Version History & Diffs — {currentTitle}
                </DialogTitle>
                <DialogDescription className="font-mono text-xs text-gray-600">
                  Scrub through past versions, compare text diffs, and restore historical snapshots.
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setShowCreateSnapshot(!showCreateSnapshot)}
              className="border-2 border-black bg-black text-cream hover:bg-black/90 font-mono text-xs uppercase font-bold shadow-[2px_2px_0_0_var(--color-ink)]"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {showCreateSnapshot ? "Cancel" : "Save Snapshot"}
            </Button>
          </div>
        </DialogHeader>

        {/* Create Snapshot Form */}
        {showCreateSnapshot && (
          <form
            onSubmit={handleCreateSnapshot}
            className="p-3 border-2 border-black bg-yellow-50 flex items-center gap-2"
          >
            <Input
              type="text"
              placeholder="Snapshot description (e.g. Approved agenda notes)"
              value={snapshotSummary}
              onChange={(e) => setSnapshotSummary(e.target.value)}
              className="border-2 border-black font-mono text-xs bg-white"
            />
            <Button
              type="submit"
              disabled={isSaving}
              className="border-2 border-black bg-lime text-black hover:bg-lime/90 font-mono text-xs uppercase font-bold shrink-0 shadow-[2px_2px_0_0_var(--color-ink)]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Snapshot
            </Button>
          </form>
        )}

        {/* Main Content Layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0 overflow-hidden pt-2">
          {/* ── Timeline Sidebar (4 cols) ── */}
          <div className="md:col-span-4 border-2 border-black bg-cream overflow-y-auto max-h-[500px]">
            <div className="p-3 border-b-2 border-black bg-white flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase text-gray-700">
                Snapshots ({versions.length})
              </span>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-black" />}
            </div>

            {versions.length === 0 && !isLoading ? (
              <div className="p-6 text-center font-mono text-xs text-gray-500">
                No historical versions saved yet. Click "Save Snapshot" above to record a version.
              </div>
            ) : (
              <div className="divide-y-2 divide-black">
                {versions.map((ver) => {
                  const isSelected = selectedVersion?.id === ver.id;
                  const dateStr = new Date(ver.created_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <button
                      key={ver.id}
                      type="button"
                      onClick={() => setSelectedVersion(ver)}
                      className={`w-full text-left p-3 transition-colors ${
                        isSelected
                          ? "bg-yellow-200 border-l-4 border-l-black font-bold"
                          : "hover:bg-white bg-cream"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 border border-black bg-white font-mono text-[10px] font-bold uppercase">
                          v{ver.version_number}
                        </span>
                        <span className="font-mono text-[10px] text-gray-600">{dateStr}</span>
                      </div>
                      <p className="font-mono text-xs font-bold mt-1 text-black truncate">
                        {ver.summary || `Version ${ver.version_number}`}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-gray-600 font-mono text-[10px]">
                        <User className="h-3 w-3" />
                        <span>{ver.profiles?.full_name || "Club Member"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Detail & Preview / Diff View (8 cols) ── */}
          <div className="md:col-span-8 flex flex-col min-h-0">
            {selectedVersion ? (
              <div className="flex-1 flex flex-col space-y-3 min-h-0">
                {/* Header for selected version */}
                <div className="p-3 border-2 border-black bg-white flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold uppercase bg-lime px-2 py-0.5 border border-black">
                        Version {selectedVersion.version_number}
                      </span>
                      <span className="font-mono text-xs text-gray-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(selectedVersion.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-gray-700 mt-1 font-bold">
                      {selectedVersion.summary}
                    </p>
                  </div>

                  {isAdmin && (
                    <Button
                      type="button"
                      disabled={isRestoring}
                      onClick={() => handleRestore(selectedVersion)}
                      className="border-2 border-black bg-lime text-black hover:bg-lime/90 font-mono text-xs uppercase font-bold shadow-[2px_2px_0_0_var(--color-ink)]"
                    >
                      {isRestoring ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      )}
                      Restore Version
                    </Button>
                  )}
                </div>

                {/* View Tabs */}
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("preview")}
                      className={`font-mono text-xs uppercase font-bold border-2 border-black ${
                        activeTab === "preview" ? "bg-black text-white" : "bg-white text-black"
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Preview Text
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("diff")}
                      className={`font-mono text-xs uppercase font-bold border-2 border-black ${
                        activeTab === "diff" ? "bg-black text-white" : "bg-white text-black"
                      }`}
                    >
                      <GitCompare className="h-3.5 w-3.5 mr-1" />
                      Compare Diff
                    </Button>
                  </div>

                  {activeTab === "diff" && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] uppercase font-bold text-gray-600">
                        Compare against:
                      </span>
                      <select
                        value={compareTarget}
                        onChange={(e) => setCompareTarget(e.target.value as "previous" | "current")}
                        className="border-2 border-black font-mono text-xs bg-white px-2 py-1"
                      >
                        <option value="previous">Previous Snapshot</option>
                        <option value="current">Current Live Note</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto">
                  {activeTab === "preview" ? (
                    <div className="p-4 border-2 border-black bg-white font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[420px] overflow-y-auto">
                      {selectedVersion.content_text || (
                        <span className="italic text-gray-400">Empty note snapshot.</span>
                      )}
                    </div>
                  ) : (
                    <NoteDiffViewer
                      oldText={compareText}
                      newText={selectedVersion.content_text || ""}
                      oldVersionLabel={
                        compareTarget === "current" ? "Current Live Note" : "Previous Snapshot"
                      }
                      newVersionLabel={`Version ${selectedVersion.version_number}`}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center border-2 border-black bg-cream p-8 text-center font-mono text-xs text-gray-500">
                Select a version from the timeline to view document details and diffs.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
