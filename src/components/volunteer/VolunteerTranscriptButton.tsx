import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

interface VolunteerTranscriptButtonProps {
  userId: string;
}

export function VolunteerTranscriptButton({ userId }: VolunteerTranscriptButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const supabase = createClient();

  const handleGenerateTranscript = async () => {
    setIsGenerating(true);
    toast.info("Generating your official transcript...");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-volunteer-transcript`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ userId }),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // Download the PDF blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `volunteer_transcript.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Transcript downloaded successfully");
    } catch (error: any) {
      toast.error(`Failed to generate transcript: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleGenerateTranscript}
      disabled={isGenerating}
      className="gap-2 bg-slate-900 hover:bg-slate-800 text-white"
    >
      {isGenerating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileText className="w-4 h-4" />
      )}
      Generate Official Transcript
    </Button>
  );
}
