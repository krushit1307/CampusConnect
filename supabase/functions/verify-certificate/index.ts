import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { ethers } from "https://esm.sh/ethers@6.13.4";
import {
  CERTIFICATE_LEDGER_ABI,
  computeCertificateLeafHash,
  isoDateToDayNumber,
  verifyMerkleProof,
} from "../shared/merkle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Accept ?cert=<id> / ?id=<id> / ?hash=<leaf hash>, or a JSON body.
    const url = new URL(req.url);
    let certId = url.searchParams.get("cert") ?? url.searchParams.get("id");
    let leafHash = url.searchParams.get("hash");

    if (!certId && !leafHash && req.method === "POST") {
      try {
        const body = await req.json();
        certId = body?.certId ?? body?.cert ?? body?.id ?? null;
        leafHash = body?.hash ?? null;
      } catch {
        // Fall through to the 400 below.
      }
    }

    if (!certId && !leafHash) {
      return new Response(
        JSON.stringify({
          valid: false,
          status: "bad_request",
          error: "Provide ?cert=<certificateId> or ?hash=<verificationHash>",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Load the certificate record.
    let query = supabase
      .from("certificates")
      .select(
        `
        id, event_id, user_id, verification_hash, merkle_root, merkle_path,
        anchor_day, anchor_tx_hash, anchor_block, issued_at, certificate_url,
        events (title, clubs (name)),
        profiles (full_name)
      `,
      )
      .limit(1);
    query = certId
      ? query.eq("id", certId)
      : query.eq("verification_hash", leafHash);

    const { data: rows, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Database error: ${fetchError.message}`);
    }

    const cert = rows?.[0] ?? null;
    if (!cert) {
      return new Response(
        JSON.stringify({
          valid: false,
          status: "not_found",
          message: "No certificate found for the given identifier.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Recompute the canonical leaf hash — proves the DB record is intact.
    const expectedLeaf = computeCertificateLeafHash(cert.event_id, cert.user_id, cert.id);
    const recordIntact =
      !!cert.verification_hash && expectedLeaf.toLowerCase() === cert.verification_hash.toLowerCase();

    // 3. Prove membership in the anchored daily batch (off-chain Merkle path).
    const merklePath = cert.merkle_path as {
      path?: string[];
      leaf_index?: number;
    } | null;
    let membershipValid = false;
    if (recordIntact && cert.merkle_root && merklePath?.path) {
      membershipValid = verifyMerkleProof(expectedLeaf, merklePath.path, cert.merkle_root);
    }

    // 4. Confirm the root is anchored on-chain (read-only RPC call).
    let onChain: boolean | null = null;
    let chainError: string | null = null;
    const contractAddress = Deno.env.get("CERT_LEDGER_CONTRACT_ADDRESS");
    const rpcUrl = Deno.env.get("CERT_LEDGER_RPC_URL");
    if (contractAddress && rpcUrl && cert.merkle_root && cert.anchor_day) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(contractAddress, CERTIFICATE_LEDGER_ABI, provider);
        onChain = await contract.verifyRoot(
          isoDateToDayNumber(String(cert.anchor_day)),
          cert.merkle_root,
        );
      } catch (error) {
        chainError = error instanceof Error ? error.message : "RPC call failed";
        console.error("[verify-certificate] On-chain verification failed:", chainError);
      }
    }

    const event = Array.isArray(cert.events) ? cert.events[0] : cert.events;
    const club = event ? (Array.isArray(event.clubs) ? event.clubs[0] : event.clubs) : null;
    const profile = Array.isArray(cert.profiles) ? cert.profiles[0] : cert.profiles;

    const status = !recordIntact
      ? "tampered"
      : cert.merkle_root && membershipValid
        ? "verified"
        : cert.merkle_root
          ? "unverified"
          : "pending_anchor";

    return new Response(
      JSON.stringify({
        valid: status === "verified",
        status,
        message:
          status === "verified"
            ? "Certificate is authentic and anchored on-chain."
            : status === "pending_anchor"
              ? "Certificate issued but its batch has not been anchored to the blockchain yet."
              : status === "tampered"
                ? "Certificate record does not match its issued hash."
                : "Certificate hash does not match the anchored batch.",
        certificate: {
          id: cert.id,
          verificationHash: cert.verification_hash,
          issuedAt: cert.issued_at,
          certificateUrl: cert.certificate_url,
          event: event?.title ?? null,
          club: club?.name ?? null,
          holder: profile?.full_name ?? null,
        },
        proof: {
          merkleRoot: cert.merkle_root,
          merklePathLength: merklePath?.path?.length ?? 0,
          anchorDay: cert.anchor_day,
          anchorTxHash: cert.anchor_tx_hash,
          anchorBlock: cert.anchor_block,
          onChain,
          chainError,
          contractAddress,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[verify-certificate] Error:", error);
    return new Response(
      JSON.stringify({
        valid: false,
        status: "error",
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
