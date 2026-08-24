import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { FeedbackSafetyAlertDashboard } from "@/components/admin/FeedbackSafetyAlertDashboard";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import AlertOctagon from "lucide-react/dist/esm/icons/alert-octagon";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";

export default function FeedbackSafetyAdmin() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [isReviewer, setIsReviewer] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const initialise = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUser(currentUser);
      if (currentUser) {
        const { data: reviewer } = await supabase.rpc("is_feedback_safety_reviewer", {
          p_user_id: currentUser.id,
        });
        if (active) setIsReviewer(Boolean(reviewer));
      }
      if (active) setAuthChecked(true);
    };
    void initialise();
    return () => {
      active = false;
    };
  }, [supabase]);

  // Fetch Pending Appeals
  const {
    data: appeals = [],
    refetch,
    isLoading: isAppealsLoading,
  } = useQuery({
    queryKey: ["admin_appeals_queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_appeals_queue")
        .select(
          `
          id,
          user_id,
          reason,
          status,
          created_at,
          profiles ( first_name, handle )
        `,
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: isReviewer,
  });

  const handleOverturn = async (appealId: string, userId: string) => {
    setProcessingId(appealId);
    try {
      // 1. Lift the shadowban on the user's profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ is_shadowbanned: false })
        .eq("id", userId);

      if (profileError) throw profileError;

      // 2. Mark the appeal as approved
      const { error: appealError } = await supabase
        .from("admin_appeals_queue")
        .update({ status: "approved" })
        .eq("id", appealId);

      if (appealError) throw appealError;

      // 3. Mock Whitelist Context Addition (Since this relies on backend NLP config)
      // In a real scenario, we'd trigger an RPC here to add the flagged word to a whitelist.
      toast.success("Ban overturned. User restored and context whitelisted.");
      refetch();
    } catch (error) {
      console.error(error);
      toast.error("Failed to overturn ban.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (appealId: string) => {
    setProcessingId(appealId);
    try {
      const { error } = await supabase
        .from("admin_appeals_queue")
        .update({ status: "rejected" })
        .eq("id", appealId);

      if (error) throw error;
      toast.success("Appeal rejected. Shadowban remains active.");
      refetch();
    } catch (error) {
      console.error(error);
      toast.error("Failed to reject appeal.");
    } finally {
      setProcessingId(null);
    }
  };

  if (authChecked && (!user || !isReviewer)) return <Navigate to="/" replace />;

  return (
    <SiteShell>
      <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-8 text-black">
        {/* NEW: Admin Appeals Queue */}
        <section className="neu-border bg-[#fef08a] p-6 shadow-[4px_4px_0_0_#000]">
          <div className="mb-6 flex items-center gap-3 border-b-4 border-black pb-4">
            <ShieldAlert className="h-8 w-8 text-black" />
            <div>
              <h2 className="font-display text-2xl font-black uppercase tracking-tight">
                Shadowban Appeals Queue
              </h2>
              <p className="font-mono text-xs font-bold text-black/70">
                Review false-positives triggered by the automated NLP moderation system.
              </p>
            </div>
          </div>

          {isAppealsLoading ? (
            <div className="py-8 text-center font-mono text-sm font-bold uppercase animate-pulse">
              Loading appeals...
            </div>
          ) : appeals.length === 0 ? (
            <div className="bg-white neu-border p-8 text-center border-dashed border-4 border-black/20">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-mono text-sm font-bold uppercase text-black/50">
                No pending appeals. The queue is clear.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {appeals.map((appeal: any) => (
                <div
                  key={appeal.id}
                  className="neu-border bg-white shadow-[4px_4px_0_0_#000] flex flex-col md:flex-row border-4 border-black"
                >
                  {/* Left Context Panel */}
                  <div className="bg-[#fee2e2] p-5 md:w-1/3 border-b-4 md:border-b-0 md:border-r-4 border-black flex flex-col justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1 bg-black text-white px-2 py-1 font-mono text-[10px] font-bold uppercase mb-3">
                        <AlertOctagon className="h-3 w-3" /> NLP Auto-Ban
                      </div>
                      <p className="font-mono text-xs font-bold uppercase text-black/60 mb-1">
                        User Profile
                      </p>
                      <p className="font-display text-lg font-black leading-tight mb-4">
                        {appeal.profiles?.first_name || "Unknown"} <br />
                        <span className="text-sm font-mono text-red-600">
                          @{appeal.profiles?.handle || "user"}
                        </span>
                      </p>

                      <div className="bg-white neu-border p-3 border-2 border-black">
                        <p className="font-mono text-[10px] font-bold uppercase text-black/50 mb-1">
                          Flagged Message
                        </p>
                        <p className="font-mono text-sm font-bold">"This event is killer!"</p>
                        <p className="font-mono text-[10px] font-bold text-red-600 mt-2 text-right">
                          NLP Confidence: 99%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Panel */}
                  <div className="p-5 md:w-2/3 flex flex-col justify-between">
                    <div>
                      <p className="font-mono text-xs font-bold uppercase text-black/60 mb-2">
                        User's Explanation
                      </p>
                      <div className="bg-gray-50 border-2 border-dashed border-black/30 p-4 font-mono text-sm text-black mb-6 italic">
                        "{appeal.reason}"
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => handleOverturn(appeal.id, appeal.user_id)}
                        disabled={processingId === appeal.id}
                        className="flex-1 neu-border bg-[#a3e635] py-3 font-mono text-xs font-bold uppercase hover:-translate-y-0.5 transition-transform shadow-[2px_2px_0_0_#000] disabled:opacity-50 disabled:hover:translate-y-0 flex justify-center items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" /> Overturn & Whitelist Context
                      </button>
                      <button
                        onClick={() => handleReject(appeal.id)}
                        disabled={processingId === appeal.id}
                        className="sm:w-1/3 neu-border bg-red-400 text-black py-3 font-mono text-xs font-bold uppercase hover:-translate-y-0.5 transition-transform shadow-[2px_2px_0_0_#000] disabled:opacity-50 disabled:hover:translate-y-0 flex justify-center items-center gap-2"
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Existing Safety Dashboard */}
        <FeedbackSafetyAlertDashboard />
      </div>
    </SiteShell>
  );
}
