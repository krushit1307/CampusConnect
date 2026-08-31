// =============================================================================
// Service: VendorSlaService
// Purpose: Handles multi-oracle SLA evaluations, queries contracts, and pings
//          smart contract payout triggers with sensor readings and oracle signatures.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface SlaContract {
  id: string;
  club_id: string;
  vendor_name: string;
  amount: number;
  delivery_deadline: string | null;
  gps_arrival_time: string | null;
  min_temp_limit: number;
  min_recorded_temp: number | null;
  slashed_amount: number;
  oracle_sig: string | null;
  status: "PENDING" | "RELEASED" | "SLASHED" | "REFUNDED";
  created_at: string;
}

export class VendorSlaService {
  /**
   * Fetches all contracts with SLA settings for a club.
   */
  static async fetchContractsForClub(clubId: string): Promise<SlaContract[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("vendor_contracts")
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as SlaContract[];
    } catch (err) {
      console.error("Error fetching SLA contracts:", err);
      return [];
    }
  }

  /**
   * Triggers the multi-oracle contract payout execution RPC.
   */
  static async executeSlaPayout(
    contractId: string,
    gpsArrivalTime: string,
    minRecordedTemp: number,
    oracleSig: string
  ): Promise<{
    success: boolean;
    payout_status?: string;
    amount_paid?: number;
    amount_slashed?: number;
    reason?: string;
    error?: string;
  }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("execute_vendor_sla_payout", {
        p_contract_id: contractId,
        p_gps_arrival_time: gpsArrivalTime,
        p_min_recorded_temp: minRecordedTemp,
        p_oracle_sig: oracleSig,
      });

      if (error) throw error;

      const res = typeof data === "string" ? JSON.parse(data) : data;
      return {
        success: res?.success ?? false,
        payout_status: res?.payout_status,
        amount_paid: res?.amount_paid,
        amount_slashed: res?.amount_slashed,
        reason: res?.reason,
        error: res?.error,
      };
    } catch (err: any) {
      console.error("Error running SLA payout execution:", err);
      return { success: false, error: err.message || "Failed to execute SLA payout." };
    }
  }

  /**
   * Configures or updates SLA constraints on a contract.
   */
  static async configureSlaContract(
    contractId: string,
    deliveryDeadline: string,
    minTempLimit: number
  ): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("vendor_contracts")
        .update({
          delivery_deadline: deliveryDeadline,
          min_temp_limit: minTempLimit,
          status: "PENDING",
        })
        .eq("id", contractId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error configuring SLA contract:", err);
      return false;
    }
  }
}
