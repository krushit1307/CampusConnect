// =============================================================================
// Hook: useWallet
// Issue: #2813 - Implement an In - App Wallet for Gamification Points
// Description: Manages the user's ConnectCoin balance, transaction history,
// and purchase operations.Interacts with the Edge Function for secure
// atomic purchases.
// =============================================================================

import { useState, useCallback, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export interface WalletBalance {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  balance_after: number;
  transaction_type: "earn" | "purchase" | "refund" | "expire" | "admin_adjust";
  description: string;
  created_at: string;
}

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  image_url: string;
  cost: number;
  stock_quantity: number;
  item_type: "physical" | "digital" | "vip_access";
}

interface UseWalletReturn {
  balance: WalletBalance | null;
  transactions: WalletTransaction[];
  storeItems: StoreItem[];
  isLoading: boolean;
  isPurchasing: boolean;
  error: string | null;
  refreshBalance: () => Promise<void>;
  purchaseItem: (itemId: string, quantity: number) => Promise<boolean>;
}

export function useWallet(): UseWalletReturn {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch wallet balance
      const { data: walletData, error: walletError } = await supabase
        .from("user_wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (walletError && walletError.code !== "PGRST116") {
        // PGRST116 = No rows
        throw walletError;
      }

      setBalance(walletData || { balance: 0, lifetime_earned: 0, lifetime_spent: 0 });

      // Fetch recent transactions
      const { data: txData, error: txError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (txError) throw txError;
      setTransactions(txData || []);

      // Fetch store items
      const { data: itemsData, error: itemsError } = await supabase
        .from("store_items")
        .select("*")
        .eq("is_active", true)
        .order("cost", { ascending: true });

      if (itemsError) throw itemsError;
      setStoreItems(itemsData || []);
    } catch (err: any) {
      console.error("[useWallet] Fetch failed:", err);
      setError(err.message || "Failed to load wallet data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const purchaseItem = async (itemId: string, quantity: number): Promise<boolean> => {
    setIsPurchasing(true);
    setError(null);

    try {
      // Call the Edge Function which wraps the atomic RPC
      const { data, error: fnError } = await supabase.functions.invoke("purchase-item", {
        body: { itemId, quantity },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      // Refresh balance and transactions after successful purchase
      await refreshBalance();
      return true;
    } catch (err: any) {
      console.error("[useWallet] Purchase failed:", err);
      setError(err.message || "Purchase failed. Please try again.");
      return false;
    } finally {
      setIsPurchasing(false);
    }
  };

  return {
    balance,
    transactions,
    storeItems,
    isLoading,
    isPurchasing,
    error,
    refreshBalance,
    purchaseItem,
  };
}
