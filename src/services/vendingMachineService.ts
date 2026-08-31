// =============================================================================
// Service: VendingMachineService
// Purpose: Handles smart vending machine snack allocations, QR code pings,
//   user credit balances, and POS dispense queries.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface VendingAllocation {
  id: string;
  event_id: string;
  allocated_amount: number;
  spent_amount: number;
  per_user_limit: number;
  created_at: string;
}

export interface VendingUserCredit {
  id: string;
  allocation_id: string;
  user_id: string;
  spent_balance: number;
  qr_code_token: string;
  expires_at: string;
  created_at: string;
}

export interface VendingDispenseLog {
  id: string;
  credit_id: string;
  vending_machine_id: string;
  product_name: string;
  amount_deducted: number;
  dispensed_at: string;
}

export class VendingMachineService {
  /**
   * Fetch the vending allocation configured for an event.
   */
  static async fetchAllocationForEvent(eventId: string): Promise<VendingAllocation | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("event_vending_allocations")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();

      if (error) throw error;
      return data as VendingAllocation | null;
    } catch (err) {
      console.error("Error fetching event vending allocation:", err);
      return null;
    }
  }

  /**
   * Fetch or create a student's active vending credit for an event.
   */
  static async fetchOrCreateUserCredit(eventId: string, userId: string): Promise<VendingUserCredit | null> {
    const supabase = createClient();
    try {
      // 1. Ensure event allocation exists
      const allocation = await this.fetchAllocationForEvent(eventId);
      if (!allocation) return null;

      // 2. Fetch user's existing credit
      const { data: existing, error: selectErr } = await supabase
        .from("vending_user_credits")
        .select("*")
        .eq("allocation_id", allocation.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (selectErr) throw selectErr;
      if (existing) return existing as VendingUserCredit;

      // 3. Otherwise provision new credit and dynamic QR token
      const qrToken = `qr-vend-${eventId.slice(0, 4)}-${userId.slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: created, error: insertErr } = await supabase
        .from("vending_user_credits")
        .insert({
          allocation_id: allocation.id,
          user_id: userId,
          qr_code_token: qrToken,
          expires_at: new Date(Date.now() + 24 * 3600000).toISOString(), // Expires in 24 hours
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      return created as VendingUserCredit;
    } catch (err) {
      console.error("Error fetch/create user credit:", err);
      return null;
    }
  }

  /**
   * Pings the POS dispense API, validating limits and executing real-time ledger deductions.
   */
  static async dispenseVendingItem(
    qrCodeToken: string,
    vendingMachineId: string,
    productName: string,
    itemCost: number
  ): Promise<{
    success: boolean;
    dispense_status?: string;
    product_name?: string;
    amount_deducted?: number;
    remaining_credit?: number;
    error?: string;
  }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("dispense_vending_item", {
        p_qr_code_token: qrCodeToken,
        p_vending_machine_id: vendingMachineId,
        p_product_name: productName,
        p_item_cost: itemCost,
      });

      if (error) throw error;
      
      const res = typeof data === "string" ? JSON.parse(data) : data;
      return {
        success: res?.success ?? false,
        dispense_status: res?.dispense_status,
        product_name: res?.product_name,
        amount_deducted: res?.amount_deducted,
        remaining_credit: res?.remaining_credit,
        error: res?.error,
      };
    } catch (err: any) {
      console.error("Error dispensing vending item:", err);
      return { success: false, error: err.message || "Failed to trigger POS dispense." };
    }
  }

  /**
   * Creates a new Vending Allocation for an event.
   */
  static async createVendingAllocation(
    eventId: string,
    allocatedAmount: number,
    perUserLimit: number
  ): Promise<VendingAllocation | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("event_vending_allocations")
        .insert({
          event_id: eventId,
          allocated_amount: allocatedAmount,
          per_user_limit: perUserLimit,
        })
        .select()
        .single();

      if (error) throw error;
      return data as VendingAllocation;
    } catch (err) {
      console.error("Error creating vending allocation:", err);
      return null;
    }
  }

  /**
   * Fetches historical dispense logs for a user credit.
   */
  static async fetchDispenseLogsForCredit(creditId: string): Promise<VendingDispenseLog[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("vending_dispense_logs")
        .select("*")
        .eq("credit_id", creditId)
        .order("dispensed_at", { ascending: false });

      if (error) throw error;
      return (data || []) as VendingDispenseLog[];
    } catch (err) {
      console.error("Error fetching dispense logs:", err);
      return [];
    }
  }
}
