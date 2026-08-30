import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Download from "lucide-react/dist/esm/icons/download";

interface DynamicEventPosterProps {
  event: {
    id: string;
    title: string;
  };
}

export function DynamicEventPoster({ event }: DynamicEventPosterProps) {
  const [generating, setGenerating] = useState(false);
  const { i18n } = useTranslation();
  const supabase = createClient();

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      const supabaseUrl =
        import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const lang = i18n.language || "en";
      const fetchUrl = `${supabaseUrl}/functions/v1/generate-poster?event_id=${event.id}&lang=${lang}`;

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(fetchUrl, {
        method: "GET",
        headers,
      });

      if (!res.ok) throw new Error("Failed to generate poster");

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${event.title.replace(/\s+/g, "_")}_poster.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success("Poster downloaded!");
    } catch (e: any) {
      toast.error(e.message || "Failed to download poster");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={generating}
      className="neu-border flex items-center gap-2 bg-white px-5 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50"
    >
      <Download aria-hidden="true" size={14} strokeWidth={3} />
      {generating ? "Generating..." : "Download Poster"}
    </Button>
  );
}
