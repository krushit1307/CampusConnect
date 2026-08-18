import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, DownloadCloud } from "lucide-react";

export function TransitionExportButton({ clubId }: { clubId: string }) {
  const [isExporting, setIsExporting] = useState(false);
  const supabase = createClient();

  const handleExport = async () => {
    setIsExporting(true);
    toast.info("Preparing vault export. This may take a moment...");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-club-vault`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ clubId }),
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `club_vault_export.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Vault exported successfully");
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full justify-start gap-2"
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <DownloadCloud className="w-4 h-4 text-muted-foreground" />
      )}
      {isExporting ? "Zipping files..." : "Export Entire Vault"}
    </Button>
  );
}
