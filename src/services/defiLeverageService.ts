// =============================================================================
// Service: DefiLeverageService
// Purpose: Handles MakerDAO CDP configuration, flash minting leverage, and
//          tax-exempt capital gains calculations.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface DefiDonation {
  id: string;
  donor_id: string;
  club_id: string;
  contract_address: string;
  principal_locked_usdc: number;
  total_yield_harvested_usdc: number;
  apy_rate: number;
  status: "ACTIVE" | "CLOSED" | "DEPLOYING";
  created_at: string;
  
  // MakerDAO & Leverage fields
  collateral_asset: string;
  collateral_amount: number;
  debt_amount_dai: number;
  is_leveraged: boolean;
  liquidation_ratio: number;
  liquidation_price: number;
  tax_savings_usd: number;
  leverage_multiplier: number;
}

export class DefiLeverageService {
  /**
   * Fetches all yield donations for a given donor.
   */
  static async fetchDonations(donorId: string): Promise<DefiDonation[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("lossless_yield_donations")
        .select("*")
        .eq("donor_id", donorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as DefiDonation[];
    } catch (err) {
      console.error("Error fetching yield donations:", err);
      return [];
    }
  }

  /**
   * Triggers the backend MakerDAO CDP simulation and stores the metrics.
   */
  static async simulateLeverage(
    donationId: string,
    collateralAmount: number,
    debtAmountDai: number,
    ethPrice: number = 3000.00
  ): Promise<{
    success: boolean;
    collateral_value?: number;
    liquidation_price?: number;
    tax_savings?: number;
    leverage_multiplier?: number;
    error?: string;
  }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("simulate_maker_cdp_leverage", {
        p_donation_id: donationId,
        p_collateral_amount: collateralAmount,
        p_debt_amount_dai: debtAmountDai,
        p_eth_price: ethPrice,
      });

      if (error) throw error;

      const res = typeof data === "string" ? JSON.parse(data) : data;
      return {
        success: res?.success ?? false,
        collateral_value: res?.collateral_value,
        liquidation_price: res?.liquidation_price,
        tax_savings: res?.tax_savings,
        leverage_multiplier: res?.leverage_multiplier,
        error: res?.error,
      };
    } catch (err: any) {
      console.error("CDP simulation failed:", err);
      return { success: false, error: err.message || "Failed to simulate CDP leverage." };
    }
  }
}
