import { useQuery, useMutation, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Download from "lucide-react/dist/esm/icons/download";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { EventBudgetActualSankey } from "@/components/analytics/EventBudgetActualSankey";
import { EventBudgetVarianceTable } from "@/components/analytics/EventBudgetVarianceTable";
import {
  downloadPdf,
  generateEventRoiPdf,
  type EventRoiSummary,
  formatCurrency,
} from "@/lib/eventRoiReport";

export function EventFinancesSection({ eventId }: { eventId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [splitPercent, setSplitPercent] = useState("50");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const {
    data: roi,
    isLoading: roiLoading,
    isError: roiError,
  } = useQuery({
    queryKey: ["event-roi", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calculate_event_roi", {
        p_event_id: eventId,
      });
      if (error) throw error;
      return data as unknown as EventRoiSummary;
    },
    enabled: !!eventId,
  });

  const logExpenseMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = Number(amount);
      if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Enter a valid description and positive amount.");
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not logged in");

      const { data: memberData, error: memberError } = await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", userData.user.id)
        .limit(1)
        .single();

      if (memberError || !memberData) throw new Error("Not a club member");

      const { data: expenseData, error: expenseError } = await supabase
        .from("event_expenses" as never)
        .insert({
          event_id: eventId,
          payer_club_id: memberData.club_id,
          total_amount: parsedAmount,
          description: description.trim(),
        } as never)
        .select()
        .single();

      if (expenseError) throw expenseError;

      const split = Math.min(100, Math.max(0, Number(splitPercent) || 0));
      if (expenseData && split > 0) {
        await supabase.from("expense_splits" as never).insert({
          expense_id: (expenseData as { id: string }).id,
          owing_club_id: memberData.club_id,
          owed_amount: (parsedAmount * split) / 100,
          status: "pending",
        } as never);
      }
    },
    onSuccess: () => {
      toast.success("Expense logged successfully.");
      setDescription("");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["event-roi", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-budget-actual-sankey", eventId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const refreshRoi = () => {
    queryClient.invalidateQueries({ queryKey: ["event-roi", eventId] });
  };

  const generatePdf = async () => {
    if (!roi) return;
    setIsGeneratingPdf(true);
    try {
      const bytes = await generateEventRoiPdf(roi);
      const safeTitle = (roi.event_title || "event")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
      downloadPdf(bytes, `${safeTitle || "event"}-p-and-l.pdf`);
      toast.success("P&L statement downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="neu-border bg-white p-6 mt-8">
      <div className="flex flex-col gap-3 border-b-2 border-black pb-3 mb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <DollarSign /> Event ROI & P&L
          </h2>
          <p className="font-mono text-xs text-black/60 mt-1">
            Live ticket revenue, Stripe fees, refunds and approved reimbursements.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={refreshRoi}
            disabled={roiLoading}
            aria-label="Refresh event ROI"
            className="neu-border bg-white px-3 py-2 font-mono text-sm flex items-center gap-2 hover:-translate-y-1 transition-transform disabled:opacity-50"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            type="button"
            onClick={generatePdf}
            disabled={!roi || isGeneratingPdf}
            className="neu-border bg-black text-white px-4 py-2 font-mono text-sm flex items-center gap-2 hover:-translate-y-1 transition-transform disabled:opacity-50"
          >
            <Download size={16} /> {isGeneratingPdf ? "Generating…" : "Download P&L"}
          </button>
        </div>
      </div>

      {roiLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-24 animate-pulse bg-gray-100 neu-border" />
          ))}
        </div>
      ) : roiError || !roi ? (
        <div className="neu-border bg-red-50 p-5 font-mono text-sm text-red-800">
          Unable to calculate this event's financial summary. Verify that you are a club treasurer
          or executive and try again.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Metric label="Total Revenue" value={formatCurrency(roi.ticket_sales_cents)} />
            <Metric label="Total Expenses" value={formatCurrency(roi.total_expenses_cents)} />
            <Metric
              label="Net Profit"
              value={formatCurrency(roi.net_profit_cents)}
              emphasis={roi.net_profit_cents >= 0}
            />
            <Metric label="Margin" value={`${roi.margin_percent.toFixed(2)}%`} />
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
            <Detail label="Paid tickets" value={String(roi.ticket_count)} />
            <Detail label="Stripe fees" value={`-${formatCurrency(roi.stripe_fees_cents)}`} />
            <Detail label="Refunds" value={`-${formatCurrency(roi.refunds_cents)}`} />
            <Detail label="Net ticket revenue" value={formatCurrency(roi.net_revenue_cents)} />
          </div>

          <p className="mt-4 font-mono text-[10px] text-black/50">
            Fee model: {roi.stripe_fee_model}. Reimbursements include approved and paid claims from
            the event's host club.
          </p>
        </>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 bg-gray-50 p-4 neu-border">
          <h3 className="font-bold text-lg font-mono uppercase">Log Expense</h3>
          <div>
            <label htmlFor="expense-description" className="block text-sm font-bold font-mono">
              Description
            </label>
            <input
              id="expense-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="neu-border w-full p-2 mt-1"
              placeholder="e.g. DJ Services"
            />
          </div>
          <div>
            <label htmlFor="expense-amount" className="block text-sm font-bold font-mono">
              Total Amount ($)
            </label>
            <input
              id="expense-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="neu-border w-full p-2 mt-1"
              placeholder="1000"
            />
          </div>
          <div>
            <label htmlFor="split-percent" className="block text-sm font-bold font-mono">
              Split to Co-host (%)
            </label>
            <input
              id="split-percent"
              type="number"
              min="0"
              max="100"
              step="1"
              value={splitPercent}
              onChange={(e) => setSplitPercent(e.target.value)}
              className="neu-border w-full p-2 mt-1"
              placeholder="50"
            />
          </div>
          <button
            type="button"
            onClick={() => logExpenseMutation.mutate()}
            disabled={logExpenseMutation.isPending}
            className="neu-border bg-black text-white w-full py-2 font-bold font-mono uppercase hover:-translate-y-1 transition-transform disabled:opacity-50"
          >
            {logExpenseMutation.isPending ? "Submitting…" : "Submit Expense"}
          </button>
        </div>
      </div>

      <EventBudgetVarianceTable eventId={eventId} />

      <EventBudgetActualSankey eventId={eventId} />
    </div>
  );
}

function Metric({
  label,
  value,
  emphasis = true,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="neu-border bg-gray-50 p-4">
      <p className="font-mono text-[10px] uppercase text-black/50">{label}</p>
      <p
        className={`font-display text-2xl font-black mt-1 ${emphasis ? "text-green-800" : "text-red-700"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-black p-3 bg-white">
      <p className="text-black/50 uppercase">{label}</p>
      <p className="font-bold mt-1">{value}</p>
    </div>
  );
}
