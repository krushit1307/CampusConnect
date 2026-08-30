// =============================================================================
// Service: DroneMaintenanceService
// Purpose: Integrates immutable blockchain repairs logging and verification query layers.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface MaintenanceLog {
  id: string;
  item_id: string;
  technician_id: string;
  parts_used: string;
  serial_numbers: string;
  digital_signature: string;
  maintenance_hash: string;
  blockchain_tx_hash: string;
  recorded_at: string;
  profiles?: {
    full_name: string;
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  barcode: string;
  condition_status: string;
  daily_rental_rate: number;
  owner_club_id?: string;
}

export class DroneMaintenanceService {
  /**
   * Submits a repair log payload, running cryptographic SHA-256 ledger commit.
   */
  static async logEquipmentRepair(
    itemId: string,
    technicianId: string,
    partsUsed: string,
    serialNumbers: string,
    digitalSignature: string
  ): Promise<{
    success: boolean;
    log_id?: string;
    parts_used?: string;
    serial_numbers?: string;
    maintenance_hash?: string;
    blockchain_tx_hash?: string;
    error?: string;
  }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("log_equipment_repair", {
        p_item_id: itemId,
        p_technician_id: technicianId,
        p_parts_used: partsUsed,
        p_serial_numbers: serialNumbers,
        p_digital_signature: digitalSignature,
      });

      if (error) throw error;
      
      const res = typeof data === "string" ? JSON.parse(data) : data;
      return {
        success: res?.success ?? false,
        log_id: res?.log_id,
        parts_used: res?.parts_used,
        serial_numbers: res?.serial_numbers,
        maintenance_hash: res?.maintenance_hash,
        blockchain_tx_hash: res?.blockchain_tx_hash,
      };
    } catch (err: any) {
      console.error("Error logging equipment repair to blockchain:", err);
      return { success: false, error: err.message || "Failed to log repair." };
    }
  }

  /**
   * Fetches historical immutable maintenance logs for a specific inventory asset.
   */
  static async fetchMaintenanceLogs(itemId: string): Promise<MaintenanceLog[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("equipment_maintenance_blockchain_logs")
        .select("*, profiles:technician_id(full_name)")
        .eq("item_id", itemId)
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      return (data || []) as MaintenanceLog[];
    } catch (err) {
      console.error("Error querying blockchain logs:", err);
      return [];
    }
  }

  /**
   * Fetches all inventory items belonging to a specific club.
   */
  static async fetchInventoryItemsForClub(clubId: string): Promise<InventoryItem[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("owner_club_id", clubId);

      if (error) throw error;
      return (data || []) as InventoryItem[];
    } catch (err) {
      console.error("Error fetching club inventory:", err);
      return [];
    }
  }
}
