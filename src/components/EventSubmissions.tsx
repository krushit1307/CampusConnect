// src/components/EventSubmissions.tsx
import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Archive,
  Presentation,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  Trash2,
  Users,
  Loader2,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EventSubmission,
  formatFileSize,
  isValidSubmissionFileType,
} from "@/types/eventSubmission";
import { EventSubmissionService } from "@/services/eventSubmissionService";
import { createClient } from "@/lib/supabase/client";

interface EventSubmissionsProps {
  eventId: string;
  submissionDeadline?: string | null;
  userRsvp?: boolean;
  isOrganizer?: boolean;
}

export function EventSubmissions({
  eventId,
  submissionDeadline,
  userRsvp = false,
  isOrganizer = false,
}: EventSubmissionsProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mySubmission, setMySubmission] = useState<EventSubmission | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<EventSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload Form state
  const [file, setFile] = useState<File | null>(null);
  const [teamName, setTeamName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isReplacing, setIsReplacing] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check deadline
  const isDeadlinePassed = submissionDeadline
    ? new Date().getTime() > new Date(submissionDeadline).getTime()
    : false;

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        try {
          const sub = await EventSubmissionService.getUserSubmission(eventId, user.id);
          setMySubmission(sub);
          if (sub?.team_name) setTeamName(sub.team_name);
        } catch (e) {
          console.error("Failed to load user submission:", e);
        }
      }

      if (isOrganizer) {
        try {
          const all = await EventSubmissionService.getEventSubmissions(eventId);
          setAllSubmissions(all);
        } catch (e) {
          console.error("Failed to load all submissions:", e);
        }
      }

      setLoading(false);
    }

    loadData();
  }, [eventId, isOrganizer]);

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;

    if (!isValidSubmissionFileType(selectedFile)) {
      toast.error("Invalid file format! Allowed types are .pdf, .zip, and .pptx.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error("Please sign in to upload your submission.");
      return;
    }
    if (!userRsvp) {
      toast.error("You must RSVP for this event before submitting files.");
      return;
    }
    if (isDeadlinePassed) {
      toast.error("Submissions for this event are closed (deadline has passed).");
      return;
    }
    if (!file && !mySubmission) {
      toast.error("Please select a file to upload.");
      return;
    }

    if (!file && mySubmission) {
      setIsReplacing(false);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10);

      const sub = await EventSubmissionService.uploadSubmission({
        eventId,
        userId: currentUser.id,
        file: file!,
        teamName,
        onProgress: (p) => setUploadProgress(p),
      });

      setMySubmission(sub);
      setFile(null);
      setIsReplacing(false);
      toast.success(
        mySubmission ? "Submission updated successfully!" : "File submitted successfully!"
      );

      // Refresh organizer view if applicable
      if (isOrganizer) {
        const all = await EventSubmissionService.getEventSubmissions(eventId);
        setAllSubmissions(all);
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteSubmission = async () => {
    if (!mySubmission || isDeadlinePassed) return;
    if (!window.confirm("Are you sure you want to remove your submission?")) return;

    try {
      setLoading(true);
      await EventSubmissionService.deleteSubmission(
        mySubmission.id,
        mySubmission.storage_path
      );
      setMySubmission(null);
      setFile(null);
      toast.success("Submission removed successfully.");

      if (isOrganizer) {
        const all = await EventSubmissionService.getEventSubmissions(eventId);
        setAllSubmissions(all);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove submission.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMyFile = async () => {
    if (!mySubmission) return;
    try {
      const url = await EventSubmissionService.getDownloadUrl(mySubmission.storage_path);
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to download file.");
    }
  };

  const handleDownloadAllZip = async () => {
    try {
      setDownloadingZip(true);
      await EventSubmissionService.downloadAllSubmissionsZip(eventId);
      toast.success("Submissions ZIP downloaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to download ZIP archive.");
    } finally {
      setDownloadingZip(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split(".").pop();
    if (ext === "pdf") return <FileText className="h-6 w-6 text-red-500" />;
    if (ext === "zip") return <Archive className="h-6 w-6 text-amber-500" />;
    if (ext === "pptx") return <Presentation className="h-6 w-6 text-orange-500" />;
    return <FileCheck className="h-6 w-6 text-blue-500" />;
  };

  if (loading) {
    return (
      <div className="neu-border p-6 bg-white dark:bg-zinc-900 flex items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-black dark:text-white" />
        <span className="font-mono text-xs">Loading submission panel…</span>
      </div>
    );
  }

  return (
    <section aria-label="Secure File Drop for Competition" className="space-y-6">
      {/* Header & Deadline Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 neu-border p-4 bg-white dark:bg-zinc-900">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight text-black dark:text-white">
            <Upload className="h-5 w-5 text-amber-500" /> Competition File Drop
          </h2>
          <p className="font-mono text-xs text-gray-600 dark:text-gray-400 mt-1">
            Secure submission vault for decks, code, and project files (.pdf, .zip, .pptx).
          </p>
        </div>

        {/* Deadline Status Badge */}
        {submissionDeadline ? (
          <div
            className={`inline-flex items-center gap-2 font-mono text-xs font-bold uppercase px-3 py-1.5 neu-border ${
              isDeadlinePassed
                ? "bg-red-100 text-red-800 border-red-800 dark:bg-red-950 dark:text-red-300"
                : "bg-amber-100 text-amber-900 border-amber-900 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            <Clock className="h-4 w-4" />
            {isDeadlinePassed ? (
              <span>Submissions Closed</span>
            ) : (
              <span>
                Deadline: {new Date(submissionDeadline).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        ) : (
          <span className="font-mono text-xs text-gray-500 italic">No deadline set</span>
        )}
      </div>

      {/* Competitor / User Submission Section */}
      <div className="neu-border bg-white dark:bg-zinc-900 p-6 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
        {!currentUser ? (
          <div className="text-center py-6">
            <p className="font-mono text-sm text-gray-600 dark:text-gray-400">
              Please sign in to access the competition file drop.
            </p>
          </div>
        ) : !userRsvp ? (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border-2 border-amber-500 text-amber-900 font-mono text-xs">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <span>You must RSVP for this event before you can submit competition files.</span>
          </div>
        ) : mySubmission && !isReplacing ? (
          /* Submission Confirmation Card */
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-green-700 dark:text-green-400 uppercase">
                <CheckCircle className="h-4 w-4" /> Submitted Successfully
              </span>
              <span className="font-mono text-[11px] text-gray-500">
                Uploaded {new Date(mySubmission.submitted_at).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-4 p-4 border-2 border-black bg-gray-50 dark:bg-zinc-800">
              {getFileIcon(mySubmission.file_name)}
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-bold truncate text-black dark:text-white">
                  {mySubmission.file_name}
                </p>
                <div className="flex items-center gap-3 font-mono text-xs text-gray-500 mt-0.5">
                  <span>{formatFileSize(mySubmission.file_size)}</span>
                  {mySubmission.team_name && (
                    <span className="flex items-center gap-1 font-semibold text-black dark:text-white">
                      <Users className="h-3 w-3" /> Team: {mySubmission.team_name}
                    </span>
                  )}
                </div>
              </div>
              <Button onClick={handleDownloadMyFile} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-1" /> View
              </Button>
            </div>

            {/* Actions for Resubmission */}
            {!isDeadlinePassed ? (
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setIsReplacing(true)}
                  size="sm"
                  className="bg-amber-400 text-black hover:bg-amber-500 neu-border font-mono uppercase text-xs font-bold"
                >
                  <Upload className="h-4 w-4 mr-1" /> Replace Submission
                </Button>
                <Button
                  onClick={handleDeleteSubmission}
                  size="sm"
                  variant="destructive"
                  className="neu-border font-mono uppercase text-xs font-bold"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            ) : (
              <p className="font-mono text-xs italic text-gray-500">
                Submissions are locked as the deadline has passed.
              </p>
            )}
          </div>
        ) : (
          /* Submission Upload Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {mySubmission && isReplacing && (
              <div className="flex items-center justify-between bg-amber-50 p-2 border border-amber-300 font-mono text-xs text-amber-900">
                <span>Replacing submission: <strong>{mySubmission.file_name}</strong></span>
                <button
                  type="button"
                  onClick={() => setIsReplacing(false)}
                  className="underline hover:text-black"
                >
                  Cancel
                </button>
              </div>
            )}

            <div>
              <label className="block font-mono text-xs font-bold uppercase mb-1">
                Team / Participant Name (Optional)
              </label>
              <Input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. CyberKnights / Alex Smith"
                className="font-mono text-xs"
              />
            </div>

            {/* Drag & Drop File Upload Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`neu-border border-dashed p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "bg-amber-100 border-amber-600"
                  : "bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.zip,.pptx"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  {getFileIcon(file.name)}
                  <p className="font-mono text-sm font-bold text-black dark:text-white">
                    {file.name}
                  </p>
                  <p className="font-mono text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  <span className="font-mono text-xs text-blue-600 underline mt-1">
                    Click to change file
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-gray-400" />
                  <p className="font-mono text-sm font-bold text-black dark:text-white">
                    Drag and drop your file here, or click to browse
                  </p>
                  <p className="font-mono text-xs text-gray-500">
                    Supported file formats: <strong>.pdf, .zip, .pptx</strong> (Max 500MB)
                  </p>
                </div>
              )}
            </div>

            {/* Upload Progress Bar */}
            {uploading && (
              <div className="space-y-1">
                <div className="flex justify-between font-mono text-xs text-black dark:text-white">
                  <span>Uploading file…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full bg-gray-200 border border-black overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={uploading || (!file && !mySubmission) || isDeadlinePassed}
                className="neu-border bg-black text-white hover:bg-zinc-800 font-mono text-xs font-bold uppercase"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />{" "}
                    {mySubmission ? "Update Submission" : "Submit File"}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Organizer Submissions Management Dashboard */}
      {isOrganizer && (
        <div className="neu-border bg-white dark:bg-zinc-900 p-6 shadow-[3px_3px_0px_rgba(0,0,0,1)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 pb-4">
            <div>
              <h3 className="font-display text-lg font-bold uppercase tracking-tight text-black dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" /> Organizer Dashboard: Submissions
              </h3>
              <p className="font-mono text-xs text-gray-500 mt-0.5">
                {allSubmissions.length} total competition file submission(s) received.
              </p>
            </div>

            <Button
              onClick={handleDownloadAllZip}
              disabled={downloadingZip || allSubmissions.length === 0}
              className="neu-border bg-indigo-600 text-white hover:bg-indigo-700 font-mono text-xs font-bold uppercase"
            >
              {downloadingZip ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating ZIP…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" /> Download All Submissions (.ZIP)
                </>
              )}
            </Button>
          </div>

          {/* Submissions List */}
          {allSubmissions.length === 0 ? (
            <p className="font-mono text-xs italic text-gray-500 py-4 text-center">
              No submissions received yet for this competition.
            </p>
          ) : (
            <div className="space-y-2">
              {allSubmissions.map((sub) => {
                const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
                const submitterName =
                  sub.team_name ||
                  (profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Participant");

                return (
                  <div
                    key={sub.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border border-black/20 bg-gray-50 dark:bg-zinc-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {getFileIcon(sub.file_name)}
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-black dark:text-white truncate">
                          {submitterName} — {sub.file_name}
                        </p>
                        <p className="font-mono text-[10px] text-gray-500">
                          {formatFileSize(sub.file_size)} • Submitted{" "}
                          {new Date(sub.submitted_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={async () => {
                        try {
                          const url = await EventSubmissionService.getDownloadUrl(sub.storage_path);
                          window.open(url, "_blank");
                        } catch (err: any) {
                          toast.error(err.message || "Failed to download file.");
                        }
                      }}
                      size="sm"
                      variant="outline"
                      className="font-mono text-xs shrink-0"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" /> Download
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
