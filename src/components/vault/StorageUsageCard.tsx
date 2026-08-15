import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, HardDrive } from "lucide-react";

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const QUOTA_LIMIT = 1024 * 1024 * 1024; // 1GB

export function StorageUsageCard({ clubId }: { clubId: string }) {
  const [usage, setUsage] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    const fetchUsage = async () => {
      const { data } = await supabase
        .from("vault_documents")
        .select("file_size")
        .eq("club_id", clubId);

      if (data) {
        const total = data.reduce((acc, doc) => acc + Number(doc.file_size), 0);
        setUsage(total);
      }
    };
    fetchUsage();

    // Subscribe to changes in vault documents for real-time update
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vault_documents", filter: `club_id=eq.${clubId}` },
        () => fetchUsage(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId]);

  const percentage = Math.min((usage / QUOTA_LIMIT) * 100, 100);

  let statusColor = "bg-primary";
  let textColor = "text-primary";
  if (percentage >= 95) {
    statusColor = "bg-red-500";
    textColor = "text-red-500";
  } else if (percentage >= 80) {
    statusColor = "bg-amber-500";
    textColor = "text-amber-500";
  }

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <HardDrive className="w-4 h-4" /> Storage
        </span>
        <span>{percentage.toFixed(1)}%</span>
      </div>

      <Progress value={percentage} className="h-2" indicatorClassName={statusColor} />

      <div className="text-xs text-muted-foreground flex justify-between">
        <span>{formatBytes(usage)}</span>
        <span>1 GB</span>
      </div>

      {percentage >= 80 && (
        <div
          className={`text-xs flex gap-2 p-2 rounded-md ${percentage >= 95 ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"}`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p>
            {percentage >= 95
              ? "Critical: Storage nearly full. Uploads may be blocked."
              : "Warning: You have used over 80% of club storage."}
          </p>
        </div>
      )}
    </div>
  );
}
