import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";

const MAX_DESCRIPTION_LENGTH = 2000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BugReportModal({ open, onOpenChange }: BugReportModalProps) {
  const [category, setCategory] = useState("bug"); // NEW: Category state
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // NEW: Dynamic text engine based on category
  const contentMap: Record<
    string,
    { title: string; subtitle: string; label: string; placeholder: string }
  > = {
    bug: {
      title: "Report a Bug",
      subtitle: "Found something broken? Let us know and we'll fix it.",
      label: "What went wrong?",
      placeholder:
        "Describe the bug — what happened, what you expected, and the steps to reproduce it.",
    },
    feature: {
      title: "Request a Feature",
      subtitle: "Have a great idea? We'd love to hear it.",
      label: "Describe your feature",
      placeholder:
        "Describe how this feature would work and why it would be useful to the community.",
    },
    suggestion: {
      title: "General Suggestion",
      subtitle: "How can we improve your experience?",
      label: "Your feedback",
      placeholder: "Share your thoughts, ideas, or general feedback with us.",
    },
  };

  const currentContent = contentMap[category];

  const submitReport = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to submit feedback.");

      let uploadedPath: string | null = null;

      try {
        let screenshotUrl: string | null = null;

        if (screenshot) {
          const ext = screenshot.name.split(".").pop()?.toLowerCase() ?? "png";
          const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
          uploadedPath = filePath;

          const { error: uploadError } = await supabase.storage
            .from("bug-screenshots")
            .upload(filePath, screenshot, { contentType: screenshot.type });
          if (uploadError) throw new Error(uploadError.message);

          const {
            data: { publicUrl },
          } = supabase.storage.from("bug-screenshots").getPublicUrl(filePath);

          screenshotUrl = publicUrl;
        }

        const { error: insertError } = await supabase.functions.invoke("submit-bug-report", {
          body: {
            category,
            description: description.trim(),
            screenshot_url: screenshotUrl,
          },
        });
        if (insertError) throw new Error(insertError.message);
      } catch (err) {
        // Best-effort cleanup: remove orphaned screenshot on failure
        if (uploadedPath) {
          await supabase.storage
            .from("bug-screenshots")
            .remove([uploadedPath])
            .catch(() => {});
        }
        throw err;
      }
    },
    onSuccess: () => {
      toast.success("Feedback submitted. Thank you!");
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("[BugReportModal] Submit failed:", error);
      toast.error(error.message || "Failed to submit report. Please try again.");
    },
  });

  function resetForm() {
    setCategory("bug");
    setDescription("");
    setScreenshot(null);
    setPreviewDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPG, PNG, and WEBP images are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Screenshot must be under 5 MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setScreenshot(file);
      setPreviewDataUrl(dataUrl);
    } catch {
      toast.error("Failed to read screenshot. Please try again.");
    }
  }

  function removeScreenshot() {
    setScreenshot(null);
    setPreviewDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const canSubmit = description.trim().length > 0 && !submitReport.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="font-mono text-[10px] font-bold uppercase tracking-widest text-black underline-offset-4 hover:underline"
        >
          Feedback
        </button>
      </DialogTrigger>

      <DialogContent className="neu-border neu-shadow bg-violet-500 sm:max-w-lg text-black">
        <DialogHeader>
          <DialogTitle className="text-blue-900">{currentContent.title}</DialogTitle>
          <DialogDescription className="text-black">{currentContent.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* NEW: Category Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="feedback-category" className="text-red-900">
              Feedback Type
            </Label>
            <select
              id="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="bug">🐛 Report a Bug</option>
              <option value="feature">💡 Request a Feature</option>
              <option value="suggestion">💭 General Suggestion</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-description" className="text-red-900">
              {currentContent.label}
            </Label>
            <Textarea
              id="bug-description"
              placeholder={currentContent.placeholder}
              rows={5}
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white"
            />
            <p className="text-right text-xs text-black">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-red-900">Screenshot (optional)</Label>

            {previewDataUrl ? (
              <div className="relative inline-block">
                <img
                  src={previewDataUrl}
                  alt="Screenshot preview"
                  className="max-h-40 rounded-md border-2 border-black object-contain"
                />
                <button
                  type="button"
                  aria-label="Remove screenshot"
                  onClick={removeScreenshot}
                  className="absolute -right-2 -top-2 rounded-full bg-black p-1 text-white hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="bug-screenshot"
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white cursor-pointer text-black font-bold uppercase border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:bg-gray-50 hover:text-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all"
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  UPLOAD SCREENSHOT
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            onClick={() => submitReport.mutate()}
            disabled={!canSubmit}
            className="w-full cursor-pointer sm:w-auto bg-black text-white font-bold uppercase border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:bg-gray-800 hover:text-white hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
          >
            {submitReport.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
