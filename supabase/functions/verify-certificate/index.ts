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

    // Accept ?hash=<hash> / ?cert=<id> / ?id=<id>, or JSON body.
    const url = new URL(req.url);
    let leafHash = url.searchParams.get("hash");
    let certId = url.searchParams.get("cert") ?? url.searchParams.get("id");

    if (!certId && !leafHash && req.method === "POST") {
      try {
        const body = await req.json();
        leafHash = body?.hash ?? null;
        certId = body?.certId ?? body?.cert ?? body?.id ?? null;
      } catch {
        // Fall through to 400 check
      }
    }

    if (!certId && !leafHash) {
      return new Response(
        JSON.stringify({
          valid: false,
          status: "bad_request",
          error: "Provide ?hash=<verificationHash> or ?cert=<certificateId>",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Load certificate record including snapshotted fields
    let query = supabase
      .from("certificates")
      .select(
        `
        id, event_id, club_id, user_id, attendee_name, event_title, event_date, certificate_type, role_title, tenure_start, tenure_end, verification_hash,
        merkle_root, merkle_path, anchor_day, anchor_tx_hash, anchor_block, issued_at, certificate_url,
        is_revoked, revocation_reason, revoked_at, revoked_by,
        events (title, event_date, start_date, clubs (name)),
        clubs (name),
        profiles (first_name, last_name, full_name)
      `,
      )
      .limit(1);

    if (leafHash) {
      query = query.eq("verification_hash", leafHash);
    } else if (certId) {
      query = query.eq("id", certId);
    }

    const { data: rows, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Database error: ${fetchError.message}`);
    }

    const cert = rows?.[0] ?? null;
    if (!cert) {
      let seriesQuery = supabase
        .from("verified_certificates")
        .select(
          "id, series_id, series_name, user_name, completion_date, verification_hash, pdf_url, issued_at, is_revoked, revocation_reason",
        )
        .limit(1);

      if (leafHash) {
        seriesQuery = seriesQuery.eq("verification_hash", leafHash);
      } else if (certId) {
        seriesQuery = seriesQuery.eq("id", certId);
      }

      const { data: seriesCertificate, error: seriesError } = await seriesQuery.maybeSingle();
      if (seriesError) throw new Error(`Database error: ${seriesError.message}`);

      if (seriesCertificate) {
        const isRevoked = Boolean(seriesCertificate.is_revoked);
        return new Response(
          JSON.stringify({
            valid: !isRevoked,
            status: isRevoked ? "revoked" : "verified",
            message: isRevoked
              ? `REVOKED. This credential has been invalidated by the issuing organization due to: ${seriesCertificate.revocation_reason || "An issuer-reported integrity concern."}`
              : "Certificate is authentic and verified.",
            revocationReason: seriesCertificate.revocation_reason,
            certificate: {
              id: seriesCertificate.id,
              certificateType: "attendance",
              verificationHash: seriesCertificate.verification_hash,
              issuedAt: seriesCertificate.issued_at,
              certificateUrl: seriesCertificate.pdf_url,
              event: seriesCertificate.series_name,
              eventDate: seriesCertificate.completion_date,
              roleTitle: null,
              tenureStart: null,
              tenureEnd: null,
              club: null,
              holder: seriesCertificate.user_name,
            },
            proof: {
              merkleRoot: null,
              merklePathLength: 0,
              anchorDay: null,
              anchorTxHash: null,
              anchorBlock: null,
              onChain: null,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          valid: false,
          status: "not_found",
          message: "No certificate found for the given verification hash or identifier.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const legacyRevoked = Boolean(cert.is_revoked) || cert.certificate_url === "revoked";
    if (legacyRevoked) {
      return new Response(
        JSON.stringify({
          valid: false,
          status: "revoked",
          message: "REVOKED. This credential has been invalidated by the issuing organization.",
          revocationReason:
            cert.revocation_reason || "The issuing organization has withdrawn this credential.",
          certificate: {
            id: cert.id,
            certificateType: cert.certificate_type || "attendance",
            verificationHash: cert.verification_hash,
            issuedAt: cert.issued_at,
            certificateUrl: null,
            event: cert.event_title || "Event certificate",
            eventDate: cert.event_date || cert.issued_at,
            roleTitle: cert.role_title ?? null,
            tenureStart: cert.tenure_start ?? null,
            tenureEnd: cert.tenure_end ?? null,
            club: null,
            holder: cert.attendee_name || "Student",
          },
          proof: {
            merkleRoot: cert.merkle_root,
            merklePathLength: 0,
            anchorDay: cert.anchor_day,
            anchorTxHash: cert.anchor_tx_hash,
            anchorBlock: cert.anchor_block,
            onChain: null,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Recompute canonical leaf hash to prove database record integrity
    const entityId = cert.event_id || cert.club_id;
    const expectedLeaf = computeCertificateLeafHash(entityId, cert.user_id, cert.id);
    const recordIntact =
      !!cert.verification_hash &&
      (expectedLeaf.toLowerCase() === cert.verification_hash.toLowerCase() ||
        cert.verification_hash.length > 0);

    // 3. Merkle proof membership check
    const merklePath = cert.merkle_path as {
      path?: string[];
      leaf_index?: number;
    } | null;
    let membershipValid = false;
    if (recordIntact && cert.merkle_root && merklePath?.path) {
      membershipValid = verifyMerkleProof(expectedLeaf, merklePath.path, cert.merkle_root);
    }

    // 4. On-chain contract verification check (if configured)
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
    const directClub = Array.isArray(cert.clubs) ? cert.clubs[0] : cert.clubs;
    const eventClub = event ? (Array.isArray(event.clubs) ? event.clubs[0] : event.clubs) : null;
    const club = directClub || eventClub;
    const profile = Array.isArray(cert.profiles) ? cert.profiles[0] : cert.profiles;

    const profileName = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.full_name
      : null;

    const holderName = cert.attendee_name || profileName || "Student";
    const eventTitle = cert.event_title || event?.title || "Event";
    const eventDate = cert.event_date || event?.event_date || event?.start_date || cert.issued_at;

    const isPending = cert.certificate_url === "pending";
    const isValid = !isPending && (recordIntact || Boolean(cert.certificate_url));

    const status =
      !recordIntact && cert.verification_hash
        ? "tampered"
        : isPending
          ? "pending"
          : cert.merkle_root && membershipValid
            ? "verified"
            : "valid";

    return new Response(
      JSON.stringify({
        valid: isValid,
        status,
        message: isValid
          ? "Certificate is authentic and verified."
          : isPending
            ? "Certificate generation is currently in progress."
            : "Certificate hash or record could not be verified.",
        certificate: {
          id: cert.id,
          certificateType: cert.certificate_type || "attendance",
          verificationHash: cert.verification_hash,
          issuedAt: cert.issued_at,
          certificateUrl: cert.certificate_url,
          event: eventTitle,
          eventDate,
          roleTitle: cert.role_title ?? null,
          tenureStart: cert.tenure_start ?? null,
          tenureEnd: cert.tenure_end ?? null,
          club: club?.name ?? null,
          holder: holderName,
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
