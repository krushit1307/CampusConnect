// =============================================================================
// Hook: useConstitutionLinter
// Issue: #3536 - Implement 'Club Constitution Conflict Resolver'
// Description: Manages the upload of PDF constitutions, triggers the Edge
// Function for AI analysis, and fetches the resulting violations for the UI.
// =============================================================================

import { useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";

export interface ConstitutionViolation {
  id: string;
  clause_reference: string;
  quote: string;
  reason: string;
  severity: "info" | "warning" | "severe";
  is_resolved: boolean;
}

export interface ConstitutionPlagiarismParagraph {
  currentParagraph: string;
  sourceParagraph: string;
  similarity: number;
}

export interface ConstitutionPlagiarismMatch {
  sourceDocumentId: string;
  sourceClubName: string | null;
  similarity: number;
  duplicateParagraphs: ConstitutionPlagiarismParagraph[];
}

export interface ConstitutionDocument {
  id: string;
  club_id: string;
  file_url: string;
  raw_text: string | null;
  status: "pending_review" | "approved" | "rejected" | "requires_revision";
  overall_risk_score: number;
  plagiarism_score: number;
  plagiarism_review_required: boolean;
  plagiarism_matches: ConstitutionPlagiarismMatch[];
  plagiarism_scanned_at: string | null;
  created_at: string;
  violations?: ConstitutionViolation[];
}

interface UseConstitutionLinterReturn {
  isUploading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  uploadAndLint: (clubId: string, file: File) => Promise<boolean>;
  fetchDocument: (documentId: string) => Promise<ConstitutionDocument | null>;
}

export function useConstitutionLinter(): UseConstitutionLinterReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAndLint = async (clubId: string, file: File): Promise<boolean> => {
    setIsUploading(true);
    setError(null);

    try {
      // 1. Upload Markdown, plain text, or PDF to Storage
      const allowedTypes = new Set(["application/pdf", "text/plain", "text/markdown"]);
      const allowedExtensions = new Set(["pdf", "txt", "md", "markdown"]);
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
      if (!allowedTypes.has(file.type) && !allowedExtensions.has(fileExt)) {
        throw new Error("Constitution must be a PDF, Markdown, or plain-text file.");
      }
      const fileName = `${clubId}/${Date.now()}.${fileExt}`;
      const filePath = `constitutions/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("club-documents")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("club-documents").getPublicUrl(filePath);

      // 2. Insert record into constitution_documents
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("You must be signed in to upload a constitution.");
      const { data: docRecord, error: insertError } = await supabase
        .from("constitution_documents")
        .insert({
          club_id: clubId,
          uploaded_by: authData.user.id,
          file_url: publicUrl,
          status: "pending_review",
        })
        .select()
        .single();

      if (insertError || !docRecord) throw insertError;

      // 3. Trigger Edge Function for AI Linting
      setIsUploading(false);
      setIsAnalyzing(true);

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "lint-constitution",
        {
          body: { document_id: docRecord.id, file_url: publicUrl },
        },
      );

      if (fnError) throw fnError;
      if (fnData.error) throw new Error(fnData.error);

      setIsAnalyzing(false);
      return true;
    } catch (err: any) {
      console.error("[useConstitutionLinter] Upload/Lint failed:", err);
      setError(err.message || "Failed to process constitution.");
      setIsUploading(false);
      setIsAnalyzing(false);
      return false;
    }
  };

  const fetchDocument = async (documentId: string): Promise<ConstitutionDocument | null> => {
    try {
      const { data: doc, error: docError } = await supabase
        .from("constitution_documents")
        .select("*, violations:constitution_violations(*)")
        .eq("id", documentId)
        .single();

      if (docError) throw docError;
      return doc as ConstitutionDocument;
    } catch (err: any) {
      console.error("[useConstitutionLinter] Fetch failed:", err);
      return null;
    }
  };

  return { isUploading, isAnalyzing, error, uploadAndLint, fetchDocument };
}
