import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Video } from "lucide-react";
import { type Candidate, uploadCandidateManifesto } from "@/lib/supabase/elections";

export type CandidateManifestoUploadProps = {
  electionId: string;
  candidate: Candidate;
  /** Called after a successful upload so the parent can refetch the candidate list. */
  onUploaded?: () => void;
};

const MAX_SIZE_BYTES = 100 * 1024 * 1024; // matches the bucket's file_size_limit
const ACCEPTED_TYPES: Record<string, "video" | "pdf"> = {
  "video/mp4": "video",
  "video/quicktime": "video",
  "application/pdf": "pdf",
};

/**
 * Lets a candidate upload their platform video/PDF. Only actually works
 * while the election is still a draft — enforced server-side by
 * `set_candidate_manifesto()` and the storage RLS policies, not by
 * anything in this component, so this stays functionally correct even if
 * someone bypasses the UI.
 */
export function CandidateManifestoUpload({
  electionId,
  candidate,
  onUploaded,
}: CandidateManifestoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;

    const manifestoType = ACCEPTED_TYPES[file.type];
    if (!manifestoType) {
      toast.error("Please upload an MP4/MOV video or a PDF.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("That file is too large — the limit is 100 MB.");
      return;
    }

    setUploading(true);
    const { error } = await uploadCandidateManifesto({
      electionId,
      candidateId: candidate.id,
      file,
      manifestoType,
    });
    setUploading(false);

    if (error) {
      toast.error("Upload failed. Voting may have already opened for this election.");
      return;
    }

    toast.success("Platform uploaded.");
    onUploaded?.();
  };

  return (
    <div className="neu-border flex items-center justify-between gap-3 bg-white p-3 dark:bg-zinc-900">
      <div className="flex items-center gap-2 font-mono text-sm">
        {candidate.manifesto_type === "video" ? (
          <Video size={16} aria-hidden="true" />
        ) : candidate.manifesto_type === "pdf" ? (
          <FileText size={16} aria-hidden="true" />
        ) : (
          <Upload size={16} aria-hidden="true" />
        )}
        <span>{candidate.manifesto_path ? "Platform uploaded" : "No platform uploaded yet"}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,application/pdf"
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading…" : candidate.manifesto_path ? "Replace" : "Upload"}
      </Button>
    </div>
  );
}
