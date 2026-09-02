// =============================================================================
// Edge Function: did-vc-manager
// Issue: #5467 - Interactive "Dietary Restriction" Live IoT Temp Logging (FDA Blockchain Compliance Export via Zero-Knowledge Proofs and Decentralized Identifiers)
// Description:
//   Manages W3C Decentralized Identifiers (DIDs) and Verifiable Credentials (VCs)
//   for FDA blockchain compliance. Issues VCs to certified food vendors, signs
//   zk-SNARK proofs with DID private keys, and verifies signatures against
//   public DID registry.
//
// Usage:
//   - Create DIDs for food vendors
//   - Issue Verifiable Credentials (e.g., "Certified Food Vendor")
//   - Sign VCs with DID private keys
//   - Verify VC signatures
//   - Sign zk-SNARK proofs with DID
//   - Verify DID signatures on proofs
// =============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/validation";

interface DIDCreateRequest {
  controller_id: string;
  did_method?: string;
  blockchain_address?: string;
  chain_id?: number;
}

interface VCIssueRequest {
  did_id: string;
  issuer_did: string;
  credential_type: string[];
  credential_subject: any;
  expires_at?: string;
  issued_by?: string;
}

interface VCSignRequest {
  credential_id: string;
  signature: string;
  proof_type?: string;
  proof_purpose?: string;
  verification_method?: string;
}

interface ZKProofCreateRequest {
  iot_log_id: string;
  did_id: string;
  credential_id?: string;
  proof_a: string[];
  proof_b: string[][];
  proof_c: string[];
  public_inputs: string[];
  did_signature: string;
  verification_method: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    if (req.method === "GET") {
      const url = new URL(req.url);
      const action = url.searchParams.get("action");

      if (action === "verify-credential") {
        const credentialId = url.searchParams.get("credential_id");
        return await verifyCredential(supabase, credentialId);
      }

      if (action === "verify-proof") {
        const proofId = url.searchParams.get("proof_id");
        return await verifyProof(supabase, proofId);
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body;

      if (action === "create-did") {
        return await createDID(supabase, body);
      }

      if (action === "issue-credential") {
        return await issueCredential(supabase, body);
      }

      if (action === "sign-credential") {
        return await signCredential(supabase, body);
      }

      if (action === "create-zk-proof") {
        return await createZKProof(supabase, body);
      }

      if (action === "submit-blockchain") {
        return await submitBlockchain(supabase, body);
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in DID/VC manager:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function createDID(supabase: any, body: DIDCreateRequest): Promise<Response> {
  try {
    const { controller_id, did_method, blockchain_address, chain_id } = body;

    const { data: didId, error } = await supabase.rpc("create_did", {
      p_controller_id: controller_id,
      p_did_method: did_method || "ethr",
      p_blockchain_address: blockchain_address,
      p_chain_id: chain_id || 137,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, did_id: didId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error creating DID:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function issueCredential(supabase: any, body: VCIssueRequest): Promise<Response> {
  try {
    const { did_id, issuer_did, credential_type, credential_subject, expires_at, issued_by } = body;

    const { data: credentialId, error } = await supabase.rpc("issue_verifiable_credential", {
      p_did_id: did_id,
      p_issuer_did: issuer_did,
      p_credential_type: credential_type,
      p_credential_subject: credential_subject,
      p_expires_at: expires_at,
      p_issued_by: issued_by,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, credential_id: credentialId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error issuing credential:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function signCredential(supabase: any, body: VCSignRequest): Promise<Response> {
  try {
    const { credential_id, signature, proof_type, proof_purpose, verification_method } = body;

    const { data: signedCredentialId, error } = await supabase.rpc("sign_verifiable_credential", {
      p_credential_id: credential_id,
      p_signature: signature,
      p_proof_type: proof_type || "EcdsaSecp256k1Signature2019",
      p_proof_purpose: proof_purpose || "assertionMethod",
      p_verification_method: verification_method,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, credential_id: signedCredentialId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error signing credential:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function verifyCredential(supabase: any, credentialId: string | null): Promise<Response> {
  try {
    if (!credentialId) {
      return new Response(JSON.stringify({ error: "credential_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: verificationResult, error } = await supabase.rpc("verify_verifiable_credential", {
      p_credential_id: credentialId,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, verification: verificationResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error verifying credential:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function createZKProof(supabase: any, body: ZKProofCreateRequest): Promise<Response> {
  try {
    const {
      iot_log_id,
      did_id,
      credential_id,
      proof_a,
      proof_b,
      proof_c,
      public_inputs,
      did_signature,
      verification_method,
    } = body;

    const { data: proofId, error } = await supabase.rpc("create_zk_snark_proof", {
      p_iot_log_id: iot_log_id,
      p_did_id: did_id,
      p_credential_id: credential_id,
      p_proof_a: proof_a,
      p_proof_b: proof_b,
      p_proof_c: proof_c,
      p_public_inputs: public_inputs,
      p_did_signature: did_signature,
      p_verification_method: verification_method,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, proof_id: proofId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error creating zk-SNARK proof:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function verifyProof(supabase: any, proofId: string | null): Promise<Response> {
  try {
    if (!proofId) {
      return new Response(JSON.stringify({ error: "proof_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: verificationResult, error } = await supabase.rpc("verify_zk_snark_proof", {
      p_proof_id: proofId,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, verification: verificationResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error verifying proof:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function submitBlockchain(supabase: any, body: any): Promise<Response> {
  try {
    const { zk_snark_proof_id, contract_address, transaction_hash, block_number } = body;

    const { data: submissionId, error } = await supabase.rpc("submit_to_blockchain", {
      p_zk_snark_proof_id: zk_snark_proof_id,
      p_contract_address: contract_address,
      p_transaction_hash: transaction_hash,
      p_block_number: block_number,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, submission_id: submissionId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error submitting to blockchain:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
