import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import { DuesRosterPanel } from "@/components/Clubs/DuesRosterPanel";
import { ContractWarningAlert } from "@/components/Clubs/ContractWarningAlert";

export function ClubFinancesTab({ clubId }: { clubId: string }) {
  const supabase = createClient();
  const [disputeReason, setDisputeReason] = useState("");
  const [disputingId, setDisputingId] = useState<string | null>(null);

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ["club_invoices", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_splits" as any)
        .select(`
          id,
          owed_amount,
          status,
          expense_id,
          event_expenses (
            description,
            total_amount,
            payer_club_id,
            clubs (name)
          )
        `)
        .eq("owing_club_id", clubId);
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  const payMutation = useMutation({
    mutationFn: async (splitId: string) => {
      const { error } = await supabase
        .from("expense_splits" as any)
        .update({ status: "paid" })
        .eq("id", splitId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice marked as paid.");
      refetch();
    },
    onError: (err: Error) => toast.error(`Failed to pay: ${err.message}`),
  });

  const disputeMutation = useMutation({
    mutationFn: async (splitId: string) => {
      const { error } = await supabase
        .from("expense_splits" as any)
        .update({ status: "disputed", dispute_reason: disputeReason })
        .eq("id", splitId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice disputed. Student Union alerted.");
      setDisputingId(null);
      setDisputeReason("");
      refetch();
    },
    onError: (err: Error) => toast.error(`Failed to dispute: ${err.message}`),
  });

  if (isLoading) return <div>Loading finances...</div>;

  return (
    <div className="neu-border bg-white p-6 space-y-6">
      <h2 className="font-display text-2xl font-bold border-b-2 border-black pb-2 flex items-center gap-2">
        <DollarSign /> Financial Dashboard
      </h2>
      
      <ContractWarningAlert clubId={clubId} />

      {/* Membership dues: standing, arrears and the reminder due next. */}
      <DuesRosterPanel clubId={clubId} />

      
      <div className="space-y-4">
        {invoices?.length === 0 && <p className="font-mono text-sm text-gray-500">No invoices pending.</p>}
        {invoices?.map((invoice: any) => (
          <div key={invoice.id} className="neu-border p-4 flex flex-col gap-2 bg-gray-50">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{invoice.event_expenses?.description}</h3>
                <p className="font-mono text-sm text-gray-600">Owed to: {invoice.event_expenses?.clubs?.name}</p>
                <p className="font-mono text-sm font-bold mt-1 text-red-600">Amount: ${invoice.owed_amount}</p>
              </div>
              <div>
                <span className={`px-2 py-1 text-xs font-bold uppercase neu-border ${
                  invoice.status === "paid" ? "bg-green-100 text-green-800" :
                  invoice.status === "disputed" ? "bg-red-100 text-red-800" :
                  "bg-yellow-100 text-yellow-800"
                }`}>
                  {invoice.status}
                </span>
              </div>
            </div>
            
            {invoice.status === "pending" && (
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => payMutation.mutate(invoice.id)}
                  className="flex items-center gap-1 neu-border bg-black text-white px-3 py-1 font-mono text-sm hover:-translate-y-1 transition-transform"
                >
                  <CheckCircle size={14} /> Mark as Paid
                </button>
                <button 
                  onClick={() => setDisputingId(invoice.id)}
                  className="flex items-center gap-1 neu-border bg-white text-black px-3 py-1 font-mono text-sm hover:-translate-y-1 transition-transform"
                >
                  <AlertTriangle size={14} /> Dispute
                </button>
              </div>
            )}

            {disputingId === invoice.id && (
              <div className="mt-2 flex gap-2">
                <input 
                  type="text" 
                  value={disputeReason} 
                  onChange={e => setDisputeReason(e.target.value)} 
                  placeholder="Reason for dispute..." 
                  className="neu-border px-2 py-1 font-mono text-sm flex-1"
                />
                <button 
                  onClick={() => disputeMutation.mutate(invoice.id)}
                  className="neu-border bg-red-500 text-white px-3 py-1 font-mono text-sm"
                >
                  Submit
                </button>
                <button 
                  onClick={() => setDisputingId(null)}
                  className="neu-border bg-gray-200 px-3 py-1 font-mono text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
