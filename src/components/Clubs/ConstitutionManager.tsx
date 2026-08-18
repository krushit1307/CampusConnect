import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConstitutionHistoryModal } from "./ConstitutionHistoryModal";
import { FileText, Upload, Clock, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

interface ConstitutionManagerProps {
  clubId: string;
  isOrganizer: boolean;
  currentVersion?: number;
  currentFileUrl?: string;
}

export function ConstitutionManager({
  clubId,
  isOrganizer,
  currentVersion,
  currentFileUrl,
}: ConstitutionManagerProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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
        // Rollback storage if DB fails
        await supabase.storage.from("club_documents").remove([uploadData.path]);
        throw rpcError;
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
            Club Constitution
          </h2>
          <p className="font-mono text-sm text-gray-600">
            Version-controlled repository for club governance.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
        <div className="flex-1">
          {localVersion > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="font-mono text-lg font-bold">Current: Version {localVersion}</div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleDownloadCurrent}
                  className="flex items-center gap-2 font-mono text-sm font-bold text-blue-600 hover:underline"
                >
                  <Download className="h-4 w-4" /> Download Latest
                </button>
                <button
                  onClick={() => setIsHistoryOpen(true)}
                  className="flex items-center gap-2 font-mono text-sm font-bold text-purple-600 hover:underline"
                >
                  <Clock className="h-4 w-4" /> View History
                </button>
              </div>
            </div>
          ) : (
            <div className="font-mono text-sm text-gray-500 italic">
              No constitution has been uploaded yet.
            </div>
          )}
        </div>

        {isOrganizer && (
          <div className="relative">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              disabled={isUploading}
            />
            <button
              disabled={isUploading}
              className="neu-border neu-press flex items-center gap-2 bg-yellow-300 px-6 py-3 font-mono font-bold uppercase transition-colors hover:bg-yellow-400 disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
              Upload New Revision
            </button>
          </div>
        )}
      </div>

      <ConstitutionHistoryModal
        clubId={clubId}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
    </div>
  );
}
