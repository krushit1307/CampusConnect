// =============================================================================
// Service: PoapService
// Purpose: Handles Web3 wallet registration, fetching claimed POAPs, and
//   processing simulated background blockchain mint jobs.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface PoapEvent {
  id: string;
  event_id: string;
  poap_id: number;
  badge_title: string;
  badge_image_url: string;
  secret_code: string | null;
  created_at: string;
}

export interface PoapClaim {
  id: string;
  poap_event_id: string;
  user_id: string;
  wallet_address: string;
  token_id: string | null;
  transaction_hash: string | null;
  minted_at: string;
  poap_events?: PoapEvent; // Joined event relation
}

export interface PoapMintJob {
  id: string;
  rsvp_id: string;
  poap_event_id: string;
  wallet_address: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  attempts: number;
  last_error: string | null;
  created_at: string;
}

export class PoapService {
  /**
   * Fetches POAP claims for a user, including POAP Event details.
   */
  static async fetchUserClaims(userId: string): Promise<PoapClaim[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("poap_claims")
        .select("*, poap_events(*)")
        .eq("user_id", userId)
        .order("minted_at", { ascending: false });

      if (error) throw error;
      return (data || []) as PoapClaim[];
    } catch (err) {
      console.error("Error fetching user POAP claims:", err);
      return [];
    }
  }

  /**
   * Updates/saves Web3 wallet address for a user.
   */
  static async saveWalletAddress(userId: string, wallet: string): Promise<boolean> {
    // Regex validation for ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      throw new Error("Invalid Ethereum wallet address format.");
    }

    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ wallet_address: wallet })
        .eq("id", userId);

      if (error) throw error;

      // --- AFTER WALLET SAVE: AUTO-QUEUE PENDING JOBS FOR MISSING WALLET RSVPS ---
      // Fetch checked_in RSVPs for events that have POAP events registered
      const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select("id, event_id")
        .eq("user_id", userId)
        .eq("checked_in", true);

      if (rsvps && rsvps.length > 0) {
        for (const rsvp of rsvps) {
          const { data: poapEvent } = await supabase
            .from("poap_events")
            .select("id")
            .eq("event_id", rsvp.event_id)
            .maybeSingle();

          if (poapEvent) {
            // Check if a job already exists
            const { data: job } = await supabase
              .from("poap_mint_jobs")
              .select("id")
              .eq("rsvp_id", rsvp.id)
              .eq("poap_event_id", poapEvent.id)
              .maybeSingle();

            if (!job) {
              await supabase
                .from("poap_mint_jobs")
                .insert({
                  rsvp_id: rsvp.id,
                  poap_event_id: poapEvent.id,
                  wallet_address: wallet,
                  status: "PENDING"
                });
            }
          }
        }
      }

      return true;
    } catch (err) {
      console.error("Error saving Web3 wallet:", err);
      return false;
    }
  }

  /**
   * Background SQS Minting Worker Simulator.
   * Processes PENDING mint jobs and records claims logs.
   */
  static async runSimulatedWorker(): Promise<number> {
    const supabase = createClient();
    try {
      // 1. Fetch pending jobs
      const { data: jobs, error } = await supabase
        .from("poap_mint_jobs")
        .select("*")
        .eq("status", "PENDING")
        .limit(10);

      if (error || !jobs || jobs.length === 0) return 0;

      let processedCount = 0;

      for (const job of (jobs as PoapMintJob[])) {
        // Mark as processing
        await supabase
          .from("poap_mint_jobs")
          .update({ status: "PROCESSING", attempts: job.attempts + 1 })
          .eq("id", job.id);

        try {
          // Simulate blockchain minting latency and calling POAP API
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Generate mock NFT metadata details
          const tokenId = Math.floor(1000000 + Math.random() * 9000000).toString();
          const txHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

          // Get rsvp user_id
          const { data: rsvp } = await supabase
            .from("event_rsvps")
            .select("user_id")
            .eq("id", job.rsvp_id)
            .single();

          if (!rsvp) throw new Error("RSVP record not found.");

          // Record claim in blockchain claims table
          await supabase
            .from("poap_claims")
            .insert({
              poap_event_id: job.poap_event_id,
              user_id: rsvp.user_id,
              wallet_address: job.wallet_address,
              token_id: tokenId,
              transaction_hash: txHash,
              minted_at: new Date().toISOString()
            });

          // Mark job as completed
          await supabase
            .from("poap_mint_jobs")
            .update({ status: "COMPLETED" })
            .eq("id", job.id);

          processedCount++;
        } catch (jobErr: any) {
          console.error(`Failed to process POAP mint job ${job.id}:`, jobErr);
          await supabase
            .from("poap_mint_jobs")
            .update({ status: "FAILED", last_error: jobErr.message || "Minting error" })
            .eq("id", job.id);
        }
      }

      return processedCount;
    } catch (err) {
      console.error("Worker exception:", err);
      return 0;
    }
  }
}
