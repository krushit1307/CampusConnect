import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { ethers } from "https://esm.sh/ethers@6.13.4";
import {
  CERTIFICATE_LEDGER_ABI,
  getMerkleProof,
  getMerkleRoot,
  isoDateToDayNumber,
} from "../shared/merkle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CERTS_PER_RUN = 5000;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isAuthorized =
    (webhookSecret && authHeader === `Bearer ${webhookSecret}`) ||
    (serviceKey && authHeader === `Bearer ${serviceKey}`);
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const contractAddress = Deno.env.get("CERT_LEDGER_CONTRACT_ADDRESS");
  const rpcUrl = Deno.env.get("CERT_LEDGER_RPC_URL");
  const signerKey = Deno.env.get("CERT_LEDGER_SIGNER_KEY");

  if (!contractAddress || !rpcUrl || !signerKey) {
    return new Response(
      JSON.stringify({
        error:
          "Blockchain ledger not configured. Set CERT_LEDGER_CONTRACT_ADDRESS, CERT_LEDGER_RPC_URL and CERT_LEDGER_SIGNER_KEY.",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey ?? "");

    // 1. Fetch all issued certificates that have a leaf hash but were never anchored.
    const { data: certs, error: fetchError } = await supabase
      .from("certificates")
      .select("id, event_id, user_id, verification_hash, issued_at")
      .not("verification_hash", "is", null)
      .is("merkle_root", null)
      .limit(MAX_CERTS_PER_RUN);

    if (fetchError) {
      throw new Error(`Failed to fetch certificates: ${fetchError.message}`);
    }

    if (!certs || certs.length === 0) {
      return new Response(
        JSON.stringify({ anchored: 0, batches: [], message: "No certificates awaiting anchor." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Group by UTC issue day.
    const byDay = new Map<string, typeof certs>();
    for (const cert of certs) {
      const day = (cert.issued_at ?? "").slice(0, 10);
      if (!day) continue;
      const group = byDay.get(day) ?? [];
      group.push(cert);
      byDay.set(day, group);
    }

    // 3. Connect to the chain.
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(signerKey, provider);
    const contract = new ethers.Contract(contractAddress, CERTIFICATE_LEDGER_ABI, wallet);

    const batches: {
      day: string;
      dayNumber: number;
      merkleRoot: string;
      certificateCount: number;
      txHash: string;
      blockNumber: number;
    }[] = [];

    // 4. Anchor one transaction per day (skip days already registered).
    for (const [day, dayCerts] of byDay) {
      const { data: existing } = await supabase
        .from("certificate_ledger_anchors")
        .select("day")
        .eq("day", day)
        .maybeSingle();
      if (existing) {
        console.warn(`[certificate-anchor] Day ${day} already anchored, skipping.`);
        continue;
      }

      const leaves = dayCerts.map((c) => c.verification_hash as string);
      const merkleRoot = getMerkleRoot(leaves);
      if (!merkleRoot) continue;

      const dayNumber = isoDateToDayNumber(day);
      console.log(
        `[certificate-anchor] Anchoring ${leaves.length} certificates for day ${day} (${dayNumber}).`,
      );

      const tx = await contract.anchorDay(dayNumber, merkleRoot, leaves.length);
      const receipt = await tx.wait();
      const blockNumber = Number(receipt.blockNumber);

      // 5. Persist root + per-certificate Merkle proofs.
      for (const cert of dayCerts) {
        const proof = getMerkleProof(leaves, cert.verification_hash as string);
        if (!proof) continue;

        const { error: updateError } = await supabase
          .from("certificates")
          .update({
            merkle_root: merkleRoot,
            merkle_path: {
              leaf: cert.verification_hash,
              leaf_index: proof.index,
              path: proof.path,
            },
            anchor_day: day,
            anchor_tx_hash: receipt.hash,
            anchor_block: blockNumber,
          })
          .eq("id", cert.id);

        if (updateError) {
          console.error(
            `[certificate-anchor] Failed to update certificate ${cert.id}: ${updateError.message}`,
          );
        }
      }

      const { error: anchorError } = await supabase
        .from("certificate_ledger_anchors")
        .insert({
          day,
          merkle_root: merkleRoot,
          tx_hash: receipt.hash,
          block_number: blockNumber,
          cert_count: leaves.length,
        });
      if (anchorError) {
        throw new Error(`Failed to register anchored day ${day}: ${anchorError.message}`);
      }

      batches.push({
        day,
        dayNumber,
        merkleRoot,
        certificateCount: leaves.length,
        txHash: receipt.hash,
        blockNumber,
      });
    }

    return new Response(JSON.stringify({ anchored: batches.length, batches }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[certificate-anchor] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
