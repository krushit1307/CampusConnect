import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, UploadCloud } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "./VaultDashboard";

interface UploadFileModalProps {
  clubId: string;
  category: string;
  onUploadComplete: () => void;
}

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "text/csv"];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const QUOTA_LIMIT = 1024 * 1024 * 1024; // 1GB

export function UploadFileModal({ clubId, category, onUploadComplete }: UploadFileModalProps) {
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState(category);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkQuota = async (fileSize: number) => {
    const { data, error } = await supabase
      .from("vault_documents")
      .select("file_size")
      .eq("club_id", clubId);

    if (error) throw new Error("Could not verify storage quota");

    const currentUsage = data.reduce((acc, doc) => acc + Number(doc.file_size), 0);
    if (currentUsage + fileSize > QUOTA_LIMIT) {
      throw new Error("Club storage quota exceeded (1GB limit). Please delete old files first.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error("Unsupported file type. Allowed: PDF, PNG, JPEG, CSV.");
        setSelectedFile(null);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File is too large. Maximum size is 100MB.");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await checkQuota(selectedFile.size);

      const fileExt = selectedFile.name.split(".").pop();
      const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${clubId}/${uploadCategory}/${uniqueFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("club_vaults")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("vault_documents").insert({
        club_id: clubId,
        file_name: selectedFile.name,
        file_path: filePath,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        category: uploadCategory,
        uploaded_by: user.id,
      });

      if (dbError) throw dbError;

      await supabase.from("vault_audit_log").insert({
        club_id: clubId,
        user_id: user.id,
        action: "UPLOAD",
        file_name: selectedFile.name,
      });

      toast.success("File uploaded successfully");
      setIsOpen(false);
      setSelectedFile(null);
      onUploadComplete();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white">
          <UploadCloud className="w-4 h-4" /> Upload File
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document to Vault</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Folder Category</Label>
            <Select value={uploadCategory} onValueChange={setUploadCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Select File</Label>
            <div
              className="border-2 border-dashed rounded-md p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="font-medium text-amber-600">{selectedFile.name}</div>
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2">
                  <UploadCloud className="w-8 h-8" />
                  <span>Click to browse</span>
                  <span className="text-xs">Supports PDF, PNG, JPG, CSV (Max 100MB)</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpeg,.jpg,.csv"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <Button className="w-full" onClick={handleUpload} disabled={!selectedFile || uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {uploading ? "Uploading..." : "Confirm Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
