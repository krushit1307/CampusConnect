import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import format from "date-fns/format";
import {
  FileIcon,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Loader2,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function getFileIcon(mimeType: string) {
  if (mimeType.includes("pdf")) return <FileText className="w-8 h-8 text-red-500" />;
  if (mimeType.includes("image")) return <ImageIcon className="w-8 h-8 text-blue-500" />;
  if (mimeType.includes("csv")) return <FileIcon className="w-8 h-8 text-green-500" />;
  return <FileIcon className="w-8 h-8 text-slate-500" />;
}

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function VaultFileActions({
  file,
  onFileChanged,
}: {
  file: any;
  onFileChanged: () => void;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage.from("club_vaults").download(file.file_path);
      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Failed to download file");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this file? This action cannot be undone."))
      return;
    setLoading(true);
    try {
      const { error: storageError } = await supabase.storage
        .from("club_vaults")
        .remove([file.file_path]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from("vault_documents").delete().eq("id", file.id);
      if (dbError) throw dbError;

      toast.success("File deleted");
      onFileChanged();
    } catch (err: any) {
      toast.error("Failed to delete file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MoreVertical className="w-4 h-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDownload} className="gap-2">
          <Download className="w-4 h-4" /> Download
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-red-600 gap-2">
          <Trash2 className="w-4 h-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function VaultFileGrid({
  files,
  loading,
  onFileChanged,
}: {
  files: any[];
  loading: boolean;
  onFileChanged: () => void;
}) {
  if (loading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (files.length === 0)
    return (
      <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg bg-card">
        No files found in this folder.
      </div>
    );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {files.map((file) => (
        <div
          key={file.id}
          className="bg-card border rounded-lg p-4 flex flex-col hover:border-primary/50 transition-colors group relative"
        >
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <VaultFileActions file={file} onFileChanged={onFileChanged} />
          </div>

          <div className="flex-1 flex items-center justify-center py-6">
            {getFileIcon(file.mime_type)}
          </div>
          <div className="mt-2">
            <p className="text-sm font-medium truncate" title={file.file_name}>
              {file.file_name}
            </p>
            <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
              <span>{formatBytes(file.file_size)}</span>
              <span>{format(new Date(file.uploaded_at), "MMM d, yyyy")}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
