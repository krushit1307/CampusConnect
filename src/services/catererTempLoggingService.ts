// =============================================================================
// Service: CatererTempLoggingService
// Purpose: Manages caterer shipment temperature uploads and FDA danger checks.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface CatererContract {
  id: string;
  event_id: string;
  caterer_name: string;
  caterer_email: string;
  caterer_phone: string | null;
  rfp_finalized_at: string | null;
  shipment_status: "PENDING" | "SAFE" | "CONDEMNED";
  stripe_payment_blocked: boolean;
  stripe_payment_intent_id: string | null;
  created_at: string;
}

export interface CatererTempLog {
  id: string;
  contract_id: string;
  temperature_fahrenheit: number;
  recorded_at: string;
}

export class CatererTempLoggingService {
  /**
   * Fetches the caterer contract associated with an event.
   */
  static async fetchContractForEvent(eventId: string): Promise<CatererContract | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("event_caterer_contracts")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) throw error;
      return data as CatererContract | null;
    } catch (err) {
      console.error("Error fetching caterer contract:", err);
      return null;
    }
  }

  /**
   * Uploads a timeseries of temperature readings from the Bluetooth IoT logger.
   */
  static async uploadTempLogs(
    contractId: string,
    readings: { recorded_at: string; temperature_fahrenheit: number }[]
  ): Promise<{
    success: boolean;
    shipment_status?: "PENDING" | "SAFE" | "CONDEMNED";
    stripe_payment_blocked?: boolean;
    message?: string;
    error?: string;
  }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("upload_caterer_temp_logs", {
        p_contract_id: contractId,
        p_logs: readings,
      });

      if (error) throw error;
      
      const res = typeof data === "string" ? JSON.parse(data) : data;
      return {
        success: res?.success ?? false,
        shipment_status: res?.shipment_status,
        stripe_payment_blocked: res?.stripe_payment_blocked,
        message: res?.message,
      };
    } catch (err: any) {
      console.error("Error uploading temp logs:", err);
      return { success: false, error: err.message || "Failed to upload log series." };
    }
  }

  /**
   * Fetches historical temperature logs for a contract.
   */
  static async fetchTempLogs(contractId: string): Promise<CatererTempLog[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("caterer_iot_temp_logs")
        .select("*")
        .eq("contract_id", contractId)
        .order("recorded_at", { ascending: true });

      if (error) throw error;
      return (data || []) as CatererTempLog[];
    } catch (err) {
      console.error("Error fetching caterer temp logs:", err);
      return [];
    }
  }
}
