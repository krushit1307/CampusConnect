import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface ClubFinancialSummary {
  club_id: string;
  club_name: string;
  total_budget: number;
  total_income: number;
  total_expenses: number;
  remaining_balance: number;
  transaction_count: number;
  refreshed_at: string;
}

export interface ClubTransaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  category: string | null;
  status: "pending" | "approved" | "rejected";
  transaction_date: string;
  created_at: string;
}

export function useClubBudget(clubId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useQuery<ClubFinancialSummary | null>({
    queryKey: ["club-budget-summary", clubId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_club_financial_summary", {
        p_club_id: clubId,
      });
      if (error) throw error;
      return (data as ClubFinancialSummary[])?.length > 0
        ? (data as ClubFinancialSummary[])[0]
        : null;
    },
    enabled: !!clubId,
  });

  const {
    data: transactions = [],
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useQuery<ClubTransaction[]>({
    queryKey: ["club-transactions", clubId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_club_transactions", {
        p_club_id: clubId,
        p_limit: 50,
        p_offset: 0,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clubId,
  });

  const createTransaction = useMutation({
    mutationFn: async (txn: {
      club_id: string;
      type: "income" | "expense";
      amount: number;
      description: string;
      category?: string;
    }) => {
      const { error } = await supabase.from("transactions").insert({
        club_id: txn.club_id,
        type: txn.type,
        amount: txn.amount,
        description: txn.description,
        category: txn.category || null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-transactions", clubId] });
      queryClient.invalidateQueries({ queryKey: ["club-budget-summary", clubId] });
      toast.success("Transaction added");
    },
    onError: (err: Error) => {
      if (err.message.includes("Insufficient Funds")) {
        toast.error("Insufficient funds — this expense would take the treasury below $0.00.");
      } else {
        toast.error(err.message);
      }
    },
  });

  const updateTransactionStatus = useMutation({
    mutationFn: async ({
      transactionId,
      status,
    }: {
      transactionId: string;
      status: "approved" | "rejected";
    }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ status })
        .eq("id", transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-transactions", clubId] });
      queryClient.invalidateQueries({ queryKey: ["club-budget-summary", clubId] });
      toast.success("Transaction status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    summary,
    transactions,
    isLoading: summaryLoading || transactionsLoading,
    createTransaction,
    updateTransactionStatus,
    refetchTransactions,
  };
}
