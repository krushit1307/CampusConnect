import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Download, FileText, Loader2, GitCompareArrows } from "lucide-react";
import format from "date-fns/format";
import { toast } from "sonner";
import { ConstitutionVersionDiff } from "./ConstitutionVersionDiff";

interface ConstitutionVersion {
  id: string;
  club_id: string;
  file_url: string;
  version_number: number;
  uploaded_by: string;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

interface ConstitutionHistoryModalProps {
  clubId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ConstitutionHistoryModal({
  clubId,
  isOpen,
  onClose,
}: ConstitutionHistoryModalProps) {
  const [history, setHistory] = useState<ConstitutionVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [diffData, setDiffData] = useState<{
    oldText: string;
    newText: string;
    oldVersion: number;
    newVersion: number;
  } | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const supabase = createClient();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 2) {
        next.add(id);
      } else {
        // Replace the oldest selection
        const arr = Array.from(next);
        next.delete(arr[0]);
        next.add(id);
      }
      return next;
    });
  };

  const loadText = useCallback(
    async (fileUrl: string): Promise<string> => {
      try {
        const { data, error } = await supabase.storage.from("club_documents").download(fileUrl);
        if (error) throw error;
        return await data.text();
      } catch {
        return "[Could not load document text]";
      }
    },
    [supabase],
  );

  const handleCompare = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length !== 2) return;

    const older = history.find((h) => h.id === ids[0]);
    const newer = history.find((h) => h.id === ids[1]);
    if (!older || !newer) return;

    // Ensure older < newer version
    const [oldDoc, newDoc] =
      older.version_number < newer.version_number ? [older, newer] : [newer, older];

    setIsDiffLoading(true);
    const [oldText, newText] = await Promise.all([
      loadText(oldDoc.file_url),
      loadText(newDoc.file_url),
    ]);
    setIsDiffLoading(false);

    setDiffData({
      oldText,
      newText,
      oldVersion: oldDoc.version_number,
      newVersion: newDoc.version_number,
    });
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, clubId]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("club_documents")
        .select("*, profiles:uploaded_by(first_name, last_name)")
        .eq("club_id", clubId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      setHistory(data as any);
    } catch (err: any) {
      toast.error(err.message || "Failed to load constitution history");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPdf = async (fileUrl: string, versionNumber: number) => {
    try {
      const { data, error } = await supabase.storage.from("club_documents").download(fileUrl);
      if (error) throw error;

      const blobUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `constitution-v${versionNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast.error(err.message || "Failed to download document");
    }
  };

  if (!isOpen) return null;

  // Diff view takes over the full modal when active
  if (diffData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="flex w-full max-w-5xl flex-col max-h-[90vh]">
          <ConstitutionVersionDiff
            oldText={diffData.oldText}
            newText={diffData.newText}
            oldVersion={diffData.oldVersion}
            newVersion={diffData.newVersion}
            onClose={() => setDiffData(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col bg-white border-4 border-black shadow-[8px_8px_0_0_#000] max-h-[85vh]">
        <div className="flex items-center justify-between border-b-4 border-black bg-blue-300 p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            <h2 className="font-display text-2xl font-black uppercase tracking-tight">
              Constitution History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="neu-border bg-red-400 p-1 hover:bg-red-500 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Compare bar */}
        {history.length >= 2 && (
          <div className="flex items-center justify-between border-b-2 border-black bg-yellow-100 px-4 py-2 font-mono text-xs">
            <span className="font-bold">
              {selectedIds.size === 0
                ? "Select 2 versions to compare"
                : selectedIds.size === 1
                  ? "Select 1 more version"
                  : "Ready to compare"}
            </span>
            <button
              onClick={handleCompare}
              disabled={selectedIds.size !== 2 || isDiffLoading}
              className="neu-border neu-press flex items-center gap-1.5 bg-lime px-3 py-1.5 font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDiffLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitCompareArrows className="h-3.5 w-3.5" />
              )}
              Compare
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center p-8 font-mono text-gray-500 border-2 border-dashed border-gray-300">
              No previous versions found.
            </div>
          ) : (
            <div className="relative border-l-4 border-black ml-4 space-y-8 pb-4">
              {history.map((doc, index) => {
                const isCurrent = index === 0;
                const isSelected = selectedIds.has(doc.id);
                return (
                  <div key={doc.id} className="relative pl-6">
                    {/* Timeline Dot */}
                    <div
                      className={`absolute -left-[14px] top-2 h-6 w-6 rounded-full border-4 border-black ${
                        isCurrent ? "bg-green-400" : isSelected ? "bg-yellow-400" : "bg-white"
                      }`}
                    />

                    <div
                      className={`neu-border bg-white p-4 group hover:-translate-y-1 transition-transform ${
                        isSelected ? "ring-4 ring-yellow-400" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {history.length >= 2 && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(doc.id)}
                              className="h-5 w-5 accent-yellow-500 cursor-pointer"
                              title="Select for comparison"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-display text-xl font-bold uppercase">
                                Version {doc.version_number}
                              </h3>
                              {isCurrent && (
                                <span className="bg-green-200 border-2 border-black px-2 py-0.5 text-xs font-bold font-mono">
                                  CURRENT
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-sm text-gray-600 mt-1">
                              {format(new Date(doc.created_at), "PPP")}
                            </p>
                          </div>
                        </div>

                        <div className="font-mono text-sm font-bold bg-blue-100 border-2 border-black px-3 py-1">
                          {doc.profiles?.first_name || "Unknown"}{" "}
                          {doc.profiles?.last_name || "Secretary"}
                        </div>
                      </div>

                      <button
                        onClick={() => downloadPdf(doc.file_url, doc.version_number)}
                        className="mt-4 flex items-center gap-2 neu-border bg-yellow-300 px-4 py-2 font-mono text-sm font-bold uppercase hover:bg-yellow-400 transition-colors"
                      >
                        <Download className="h-4 w-4" /> Download PDF
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
