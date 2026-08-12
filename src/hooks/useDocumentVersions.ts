// =============================================================================
// Hook: useDocumentVersions
// Issue: #2793 - Implement Semantic Versioning and Automated Changelog
// Description: Manages fetching, uploading, and downloading document versions.
// Handles the calculation of the next semantic version and interacts with
// Supabase Storage for file management.
// =============================================================================

import { useState, useCallback, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: string;
  file_url: string;
  file_type: string;
  change_summary: string;
  version_type: "major" | "minor" | "patch";
  uploaded_by: string;
  created_at: string;
  uploader_profile?: {
    full_name: string;
    avatar_url: string;
  };
}

export interface DocumentMeta {
  id: string;
  club_id: string;
  title: string;
  description: string;
  current_version: string;
  created_at: string;
  updated_at: string;
}

interface UseDocumentVersionsReturn {
  document: DocumentMeta | null;
  versions: DocumentVersion[];
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  fetchVersions: () => Promise<void>;
  uploadNewVersion: (
    file: File,
    summary: string,
    type: "major" | "minor" | "patch",
  ) => Promise<boolean>;
  downloadVersion: (version: DocumentVersion) => Promise<void>;
}

export function useDocumentVersions(documentId: string): UseDocumentVersionsReturn {
  const [document, setDocument] = useState<DocumentMeta | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!documentId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch document metadata
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .single();

      if (docError) throw docError;
      setDocument(docData);

      // Fetch version history with uploader profiles
      const { data: versionsData, error: versionsError } = await supabase
        .from("document_versions")
        .select(
          `
          *,
          uploader_profile:profiles!uploaded_by(full_name, avatar_url)
        `,
        )
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });

      if (versionsError) throw versionsError;
      setVersions(versionsData || []);
    } catch (err: any) {
      console.error("[useDocumentVersions] Fetch failed:", err);
      setError(err.message || "Failed to load document history");
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const uploadNewVersion = async (
    file: File,
    summary: string,
    type: "major" | "minor" | "patch",
  ): Promise<boolean> => {
    if (!document) return false;

    setIsUploading(true);
    setError(null);

    try {
      // 1. Calculate next version number client-side for UX,
      // but the DB trigger will enforce the final state
      const nextVersion = calculateNextVersion(document.current_version, type);

      // 2. Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop() || "pdf";
      const fileName = `${document.id}/v${nextVersion}_${Date.now()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("club-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 3. Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("club-documents").getPublicUrl(filePath);

      // 4. Insert version record into database
      // The trigger will automatically update the documents.current_version
      const { error: dbError } = await supabase.from("document_versions").insert({
        document_id: document.id,
        version_number: nextVersion,
        file_url: publicUrl,
        file_type: fileExt,
        change_summary: summary,
        version_type: type,
        uploaded_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (dbError) throw dbError;

      // 5. Refresh the list
      await fetchVersions();
      return true;
    } catch (err: any) {
      console.error("[useDocumentVersions] Upload failed:", err);
      setError(err.message || "Failed to upload new version");
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const downloadVersion = async (version: DocumentVersion) => {
    try {
      // Fetch the file as a blob to trigger a download
      const response = await fetch(version.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${document?.title}_v${version.version_number}.${version.file_type}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[useDocumentVersions] Download failed:", err);
    }
  };

  return {
    document,
    versions,
    isLoading,
    isUploading,
    error,
    fetchVersions,
    uploadNewVersion,
    downloadVersion,
  };
}

/**
 * Utility to calculate the next semantic version string
 */
function calculateNextVersion(current: string, type: string): string {
  const parts = current.split(".").map(Number);
  let major = parts[0] || 1;
  let minor = parts[1] || 0;
  let patch = parts[2] || 0;

  if (type === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === "minor") {
    minor += 1;
    patch = 0;
  } else if (type === "patch") {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}
