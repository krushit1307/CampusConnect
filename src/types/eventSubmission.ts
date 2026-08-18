// src/types/eventSubmission.ts

export interface EventSubmission {
  id: string;
  event_id: string;
  user_id: string;
  team_name?: string | null;
  file_url: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  submitted_at: string;
  updated_at: string;
  profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    handle?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface UploadSubmissionOptions {
  eventId: string;
  userId: string;
  file: File;
  teamName?: string;
  onProgress?: (progress: number) => void;
}

export function isValidSubmissionFileType(file: File): boolean {
  const allowedExtensions = [".pdf", ".zip", ".pptx"];
  const fileNameLower = file.name.toLowerCase();
  return allowedExtensions.some((ext) => fileNameLower.endsWith(ext));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
