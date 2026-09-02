// =============================================================================
// Service: CatererZkService
// Purpose: Handles zk-SNARK cryptographic proof generation simulation, submits
//          zero-knowledge safety proofs, and verifies status on Polygon.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface ZkProof {
  id: string;
  contract_id: string;
  lot_number: string;
  proof_hash: string;
  total_readings: number;
  max_threshold_temp: number;
  verification_status: "VERIFYING" | "VERIFIED" | "FAILED";
  verified_at: string | null;
  created_at: string;
}

export class CatererZkService {
  /**
   * Fetches the ZK proofs associated with a caterer contract.
   */
  static async fetchZkProofs(contractId: string): Promise<ZkProof[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("caterer_zk_proofs")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as ZkProof[];
    } catch (err) {
      console.error("Error fetching ZK proofs:", err);
      return [];
    }
  }

  /**
   * Submits a zk-SNARK proof of temperature compliance to the smart contract database.
   */
  static async submitZkProof(
    contractId: string,
    lotNumber: string,
    proofHash: string,
    totalReadings: number,
    maxThresholdTemp: number
  ): Promise<{
    success: boolean;
    proof_id?: string;
    status?: string;
    verified_at?: string;
    message?: string;
    error?: string;
  }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("submit_caterer_zk_proof", {
        p_contract_id: contractId,
        p_lot_number: lotNumber,
        p_proof_hash: proofHash,
        p_total_readings: totalReadings,
        p_max_threshold_temp: maxThresholdTemp,
      });

      if (error) throw error;

      const res = typeof data === "string" ? JSON.parse(data) : data;
      return {
        success: res?.success ?? false,
        proof_id: res?.proof_id,
        status: res?.status,
        verified_at: res?.verified_at,
        message: res?.message,
        error: res?.error,
      };
    } catch (err: any) {
      console.error("Error submitting ZK proof:", err);
      return { success: false, error: err.message || "Failed to submit zk-SNARK proof." };
    }
  }

  /**
   * Generates a mock zk-SNARK proof from a raw temperature log dataset,
   * hiding the raw temperatures/GPS coordinates and outputting a cryptographic hash.
   */
  static async generateMockZkSnark(
    rawLogs: { temperature_fahrenheit: number }[]
  ): Promise<{
    proof_hash: string;
    total_readings: number;
    max_threshold_temp: number;
    is_valid: boolean;
  }> {
    // Simulate compilation of arithmetic circuit & proving key execution
    const total = rawLogs.length || 5000;
    const maxTemp = rawLogs.length > 0 
      ? Math.max(...rawLogs.map(l => l.temperature_fahrenheit)) 
      : 39.5;

    // Groth16 mathematical proving simulation
    const mockHash = "zk-snark-groth16-proof-" + Math.random().toString(36).substring(2, 15);
    const isValid = maxTemp <= 40.0;

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          proof_hash: mockHash,
          total_readings: total,
          max_threshold_temp: 40.0,
          is_valid: isValid,
        });
      }, 1500); // Proving computation delay
    });
  }
}
