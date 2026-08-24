import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConstitutionHistoryModal } from "./ConstitutionHistoryModal";
import { ConstitutionTimeline } from "./ConstitutionTimeline";
import { FileText, Upload, Clock, Loader2, Download, History } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

interface ConstitutionManagerProps {
  clubId: string;
  isOrganizer: boolean;
  currentVersion?: number;
  currentFileUrl?: string;
  clubName?: string;
}

export function ConstitutionManager({
  clubId,
  isOrganizer,
  currentVersion,
  currentFileUrl,
  clubName,
}: ConstitutionManagerProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localVersion, setLocalVersion] = useState(currentVersion || 0);
  const [localFileUrl, setLocalFileUrl] = useState(currentFileUrl);
  const supabase = createClient();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Constitution must be a PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    const filePath = `${clubId}/${uuidv4()}.pdf`;

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("club_documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: userAuth } = await supabase.auth.getUser();
      if (!userAuth.user) throw new Error("Not authenticated");

      const { data: rpcData, error: rpcError } = await supabase.rpc("upload_club_document", {
        p_club_id: clubId,
        p_file_url: uploadData.path,
        p_uploaded_by: userAuth.user.id,
      });

      if (rpcError) {
        await supabase.storage.from("club_documents").remove([uploadData.path]);
        throw rpcError;
      }

      const { data: publicFile } = supabase.storage
        .from("club_documents")
        .getPublicUrl(uploadData.path);
      const { data: reviewDocument, error: reviewInsertError } = await supabase
        .from("constitution_documents")
        .insert({
          club_id: clubId,
          uploaded_by: userAuth.user.id,
          file_url: publicFile.publicUrl,
          status: "pending_review",
        })
        .select("id")
        .single();

      if (!reviewInsertError && reviewDocument) {
        const { error: scanError } = await supabase.functions.invoke("lint-constitution", {
          body: { document_id: reviewDocument.id, file_url: publicFile.publicUrl },
        });
        if (scanError) {
          toast.warning("Constitution uploaded; automated review is still pending.");
        }
      } else {
        toast.warning("Constitution uploaded; automated review could not be started.");
      }

      toast.success("Constitution uploaded successfully!");
      setLocalVersion(rpcData.version_number);
      setLocalFileUrl(rpcData.file_url);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload constitution.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadCurrent = async () => {
    if (!localFileUrl) return;
    try {
      const { data, error } = await supabase.storage.from("club_documents").download(localFileUrl);
      if (error) throw error;

      const blobUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `constitution-v${localVersion}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast.error("Failed to download current constitution");
    }
  };

  return (
    <div className="neu-border bg-white p-6 mb-8 shadow-[4px_4px_0_0_#000]">
      <div className="flex items-center gap-3 border-b-4 border-black pb-4 mb-4">
        <FileText className="h-8 w-8 text-blue-600" />
        <div>
          <h2 className="font-display text-2xl font-black uppercase tracking-tight">
            Constitution
          </h2>
          <p className="font-mono text-sm text-gray-600">
            Current Version: {localVersion > 0 ? `v${localVersion}` : "None"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {isOrganizer && (
          <label className="flex items-center gap-2 neu-border bg-blue-300 px-4 py-2 font-mono text-sm font-bold uppercase hover:bg-blue-400 transition-colors cursor-pointer">
            <Upload className="h-4 w-4" />
            Upload New Version
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        )}

        {localVersion > 0 && (
          <>
            <button
              onClick={handleDownloadCurrent}
              className="flex items-center gap-2 neu-border bg-yellow-300 px-4 py-2 font-mono text-sm font-bold uppercase hover:bg-yellow-400 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download Current
            </button>

            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 neu-border bg-white px-4 py-2 font-mono text-sm font-bold uppercase hover:bg-gray-100 transition-colors"
            >
              <Clock className="h-4 w-4" />
              History
            </button>

            <button
              onClick={() => setIsTimelineOpen(true)}
              className="flex items-center gap-2 neu-border bg-purple-300 px-4 py-2 font-mono text-sm font-bold uppercase hover:bg-purple-400 transition-colors"
              data-testid="view-timeline-btn"
            >
              <History className="h-4 w-4" />
              View Timeline
            </button>
          </>
        )}
      </div>

      {isUploading && (
        <div className="mt-4 flex items-center gap-2 font-mono text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading…
        </div>
      )}

      <ConstitutionHistoryModal
        clubId={clubId}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {isTimelineOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          data-testid="constitution-timeline-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Constitution version timeline"
        >
          <div className="flex w-full max-w-5xl flex-col bg-white border-4 border-black shadow-[8px_8px_0_0_#000] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-4 border-black bg-purple-300 p-4 sticky top-0 z-10">
              <h2 className="font-display text-2xl font-black uppercase tracking-tight">
                Constitution Time Machine
              </h2>
              <button
                onClick={() => setIsTimelineOpen(false)}
                className="neu-border bg-red-400 px-3 py-1 font-mono text-sm font-bold uppercase hover:bg-red-500 transition-colors"
                aria-label="Close timeline"
              >
                Close
              </button>
            </div>
            <div className="p-6">
              <ConstitutionTimeline clubId={clubId} clubName={clubName} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
