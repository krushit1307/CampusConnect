import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import type { User } from "@supabase/supabase-js";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Download from "lucide-react/dist/esm/icons/download";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import { SiteShell } from "@/components/site/SiteShell";

export default function SettingsDataPage() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const { data: latestExportJob, refetch: refetchExportJob } = useQuery({
    queryKey: ["latest_export_job", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_export_jobs")
        .select("*")
        .eq("user_id", user?.id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const handleRequestDataTakeout = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      const { error } = await supabase.functions.invoke("request-data-takeout");
      if (error) throw error;
      toast.success("Your data export is being prepared! You will receive an email shortly.");
      refetchExportJob();
    } catch (error: any) {
      toast.error(error.message || "Failed to request data takeout");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-[#facc15] px-4 py-16 md:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-sm font-bold uppercase tracking-widest text-black/80">
            Account
          </p>
          <h1 className="mt-2 text-5xl font-extrabold tracking-tight text-black md:text-7xl">
            Data & Privacy.
          </h1>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            <h2 className="font-display text-2xl font-bold uppercase text-black mb-2 flex items-center gap-2">
              <Download className="h-6 w-6" /> Data Export
            </h2>
            <p className="text-gray-700 font-mono text-sm mb-4">
              Download a portable ZIP archive containing your profile, posts, comments, club memberships, event RSVPs, and uploaded media files. 
              Export links are securely emailed to you and expire after 48 hours.
            </p>
            
            {latestExportJob && (
              <div className="mb-4 bg-lime/20 border border-lime p-4 rounded-none neu-border">
                <p className="font-mono text-sm">
                  <strong>Last Export Status:</strong> {latestExportJob.status}
                  {latestExportJob.completed_at && (
                    <span className="block text-xs mt-1 text-gray-600">
                      Completed at: {new Date(latestExportJob.completed_at).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            )}

            <button
              onClick={handleRequestDataTakeout}
              disabled={isExporting || latestExportJob?.status === "processing"}
              className="neu-border flex items-center gap-2 bg-lime px-4 py-2 font-bold uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {latestExportJob?.status === "processing" ? "Exporting..." : "Request Data Export"}
            </button>
          </div>

          <div className="border-2 border-black bg-red-50 p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            <h2 className="font-display text-2xl font-bold uppercase text-red-600 mb-2 flex items-center gap-2">
              <ShieldAlert className="h-6 w-6" /> Data Deletion
            </h2>
            <p className="text-gray-700 font-mono text-sm mb-4">
              Under GDPR/CCPA compliance, you have the right to request the complete deletion of your personal data.
              Account data, profile images, and files are permanently deleted immediately upon confirmation.
            </p>
            
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="neu-border flex items-center gap-2 bg-red-600 text-white px-4 py-2 font-bold uppercase transition-all hover:scale-105 active:scale-95"
            >
              <Trash2 className="h-4 w-4" />
              Delete All My Data
            </button>

            <DeleteAccountModal
              open={deleteModalOpen}
              onClose={() => setDeleteModalOpen(false)}
            />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
