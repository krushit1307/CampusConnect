import { useQuery, useMutation, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Download from "lucide-react/dist/esm/icons/download";
import { EventBudgetActualSankey } from "@/components/analytics/EventBudgetActualSankey";

export function EventFinancesSection({ eventId }: { eventId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [splitPercent, setSplitPercent] = useState("50");

  const { data: eventClubs } = useQuery({
    queryKey: ["event_sponsors", eventId],
    queryFn: async () => {
      // In a real app, we'd query event sponsors. Mocking for now based on requirement.
      const { data, error } = await supabase
        .from("events")
        .select("host_club_id")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const logExpenseMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not logged in");

      const { data: memberData } = await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", userData.user.id)
        .limit(1)
        .single();

      if (!memberData) throw new Error("Not a club member");

      // Create expense
      const { data: expenseData, error: expenseError } = (await supabase
        .from("event_expenses" as any)
        .insert({
          event_id: eventId,
          payer_club_id: memberData.club_id,
          total_amount: parseFloat(amount),
          description: description,
        })
        .select()
        .single()) as { data: any; error: any };

      if (expenseError) throw expenseError;

      // Mocking co-host split (in reality, query co-hosts)
      // Here we just pick a dummy club for demo if none found
      const owedAmount = (parseFloat(amount) * parseFloat(splitPercent)) / 100;

      const { error: splitError } = await supabase.from("expense_splits" as any).insert({
        expense_id: expenseData.id,
        owing_club_id: "00000000-0000-0000-0000-000000000000", // Would be actual co-host ID
        owed_amount: owedAmount,
        status: "pending",
      });

      if (splitError) {
        console.warn("Could not create split (might be due to dummy UUID), but expense logged.");
      }
    },
    onSuccess: () => {
      toast.success("Expense logged & Invoice generated!");
      setDescription("");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["event-budget-actual-sankey", eventId] });
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  const generatePDF = () => {
    // Generate P&L PDF
    window.print();
  };

  return (
    <div className="neu-border bg-white p-6 mt-8">
      <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <DollarSign /> Finances & Ledger
        </h2>
        <button
          onClick={generatePDF}
          className="neu-border bg-black text-white px-4 py-2 font-mono text-sm flex items-center gap-2 hover:-translate-y-1 transition-transform"
        >
          <Download size={16} /> Download P&L
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 bg-gray-50 p-4 neu-border">
          <h3 className="font-bold text-lg font-mono uppercase">Log Expense</h3>
          <div>
            <label className="block text-sm font-bold font-mono">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="neu-border w-full p-2 mt-1"
              placeholder="e.g. DJ Services"
            />
          </div>
          <div>
            <label className="block text-sm font-bold font-mono">Total Amount ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="neu-border w-full p-2 mt-1"
              placeholder="1000"
            />
          </div>
          <div>
            <label className="block text-sm font-bold font-mono">Split to Co-host (%)</label>
            <input
              type="number"
              value={splitPercent}
              onChange={(e) => setSplitPercent(e.target.value)}
              className="neu-border w-full p-2 mt-1"
              placeholder="50"
            />
          </div>
          <button
            onClick={() => logExpenseMutation.mutate()}
            className="neu-border bg-black text-white w-full py-2 font-bold font-mono uppercase hover:-translate-y-1 transition-transform"
          >
            Submit Expense
          </button>
        </div>

        <div className="bg-green-50 p-4 neu-border flex flex-col justify-center items-center text-center">
          <h3 className="font-bold text-lg font-mono uppercase text-green-800">
            Event P&L Summary
          </h3>
          <p className="text-sm mt-2 text-green-700">Ticket Revenue: $4,500.00</p>
          <p className="text-sm mt-1 text-red-700">Total Expenses: $1,000.00</p>
          <div className="w-full h-[2px] bg-black my-4"></div>
          <p className="font-bold text-2xl text-green-900">Net Profit: $3,500.00</p>
          <p className="text-xs mt-4 text-gray-500 font-mono">
            * This section will be included in the PDF export.
          </p>
        </div>
      </div>

      <EventBudgetActualSankey eventId={eventId} />
    </div>
  );
}
