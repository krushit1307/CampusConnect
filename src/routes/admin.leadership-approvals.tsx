import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, Check, X, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FundingRequestKanban } from "@/components/funding/FundingRequestKanban";
import { LeadershipBackgroundCheckWidget } from "@/components/admin/LeadershipBackgroundCheckWidget";
import { clubLeadershipBackgroundCheckService } from "@/services/clubLeadershipBackgroundCheckService";

export default function AdminLeadershipApprovals() {
  const supabase = createClient();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Verify permissions
  const { isLoading: isPermLoading } = useQuery({
    queryKey: ["check_system_admin_role"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return false;
      }
      const { data, error } = await supabase.rpc("is_system_admin");
      if (error) {
        setIsAdmin(false);
        return false;
      }
      setIsAdmin(!!data);
      return !!data;
    },
  });

  const {
    data: transitions = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin_pending_leadership_transitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leadership_transitions")
        .select(
          `
          id,
          role_title,
          effective_date,
          status,
          su_advisor_approval_status,
          clubs (
            id,
            name
          ),
          outgoing:profiles!leadership_transitions_outgoing_user_id_fkey (
            first_name,
            last_name,
            email
          ),
          incoming:profiles!leadership_transitions_incoming_user_id_fkey (
            first_name,
            last_name,
            email
          )
        `,
        )
        .eq("status", "accepted")
        .eq("su_advisor_approval_status", "pending")
        .order("effective_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin === true,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("approve_leadership_transfer", { p_transition_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role transfer approved and executed successfully!");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve transfer.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reject_leadership_transfer", { p_transition_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role transfer rejected.");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject transfer.");
    },
  });

  if (isPermLoading) {
    return (
      <SiteShell>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SiteShell>
    );
  }

  if (isAdmin === false) {
    return (
      <SiteShell>
        <section className="bg-cream px-4 py-20 md:px-6">
          <div className="neu-border neu-shadow mx-auto max-w-2xl bg-white p-8 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="mt-4 text-3xl font-bold text-black uppercase">Admin access required</h1>
            <p className="mt-3 font-mono text-sm leading-6 text-gray-700">
              Only system administrators or Student Union staff advisors can view pending leadership
              approvals.
            </p>
            <Link
              to="/clubs"
              className="neu-border neu-press mt-6 inline-block bg-black px-5 py-3 font-mono text-xs font-bold uppercase text-cream"
            >
              Return to clubs
            </Link>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-peach px-4 py-14 md:px-6 text-black">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow font-bold text-black flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> System Administration
              </p>
              <h1 className="mt-2 text-4xl font-black md:text-5xl uppercase">
                Pending Leadership Changes
              </h1>
              <p className="mt-4 max-w-2xl font-mono text-sm leading-6 text-gray-800">
                Review and approve high-risk role transfers (e.g. Club Presidency) to prevent
                unauthorized transfers.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin/clubs/pending"
                className="neu-border text-center bg-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-cream"
              >
                Clubs Approvals
              </Link>
              <Link
                to="/admin/analytics"
                className="neu-border text-center bg-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-cream"
              >
                System Analytics
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-cream px-4 py-12 md:px-6 min-h-[500px] text-black">
        <div className="mx-auto max-w-7xl">
          {isLoading ? (
            <div className="neu-border bg-white p-8 text-center font-mono text-sm text-gray-600">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
              Loading pending transitions...
            </div>
          ) : transitions.length > 0 ? (
            <div className="space-y-6">
              {transitions.map((t: any) => {
                const outgoingName =
                  `${t.outgoing?.first_name || ""} ${t.outgoing?.last_name || ""}`.trim() ||
                  "Outgoing Leader";
                const incomingName =
                  `${t.incoming?.first_name || ""} ${t.incoming?.last_name || ""}`.trim() ||
                  "Nominated Successor";

                return (
                  <div
                    key={t.id}
                    className="neu-border bg-white p-6 shadow-[4px_4px_0_0_#000] space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-3 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-200 uppercase">
                            Pending Staff Approval
                          </span>
                          <span className="text-xs text-gray-500 font-bold uppercase">
                            {t.clubs?.name}
                          </span>
                        </div>
                        <h3 className="font-display text-xl font-black uppercase text-black">
                          Transfer of {t.role_title} Presidency
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-gray-700">
                          <div>
                            <span className="font-bold">From Current President:</span>{" "}
                            <span>
                              {outgoingName} ({t.outgoing?.email})
                            </span>
                          </div>
                          <div>
                            <span className="font-bold">To Nominee:</span>{" "}
                            <span>
                              {incomingName} ({t.incoming?.email})
                            </span>
                          </div>
                          <div>
                            <span className="font-bold">Effective Handover Date:</span>{" "}
                            <span>{new Date(t.effective_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => approveMutation.mutate(t.id)}
                          disabled={
                            approveMutation.isPending ||
                            rejectMutation.isPending ||
                            !clubLeadershipBackgroundCheckService.isCandidateClearedForLeadership(t.id)
                          }
                          className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 rounded-none shadow-[2px_2px_0_0_#000] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check className="w-4 h-4 mr-1.5" /> Approve
                        </Button>
                        <Button
                          onClick={() => rejectMutation.mutate(t.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          variant="destructive"
                          className="neu-border bg-red-500 text-cream hover:bg-red-600 rounded-none shadow-[2px_2px_0_0_#000]"
                        >
                          <X className="w-4 h-4 mr-1.5" /> Reject
                        </Button>
                      </div>
                    </div>

                    {/* Automated Leadership Background Check Widget */}
                    <LeadershipBackgroundCheckWidget
                      transitionId={t.id}
                      onStatusChange={() => refetch()}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="neu-border bg-white p-12 text-center shadow-[4px_4px_0_0_#000]">
              <p className="font-mono text-sm text-gray-500 italic">
                No pending presidency transitions require advisor approval.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-cream px-4 py-12 md:px-6 text-black">
        <div className="mx-auto max-w-7xl">
          <FundingRequestKanban />
        </div>
      </section>
    </SiteShell>
  );
}
