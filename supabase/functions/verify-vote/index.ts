// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
// @ts-ignore
import * as snarkjs from "https://esm.sh/snarkjs@0.7.6";
// @ts-ignore
import { z } from "https://esm.sh/zod@3.24.2";
// @ts-ignore
import vKey from "./verification_key.json" with { type: "json" };
import { parseJsonBody } from "../_shared/validation.ts";

declare const Deno: any;

const verifyVoteSchema = z
  .object({
    proof: z.unknown(),
    publicSignals: z.array(z.unknown()).min(1, "publicSignals must be a non-empty array"),
    electionId: z.string().min(1, "electionId is required"),
    voteChoice: z.string().min(1, "voteChoice is required"),
  })
  .strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const handler = async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // We use service role to bypass RLS since users voting are anonymous
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const parsed = await parseJsonBody(verifyVoteSchema, req);
    if (!parsed.ok) return parsed.response;
    const { proof, publicSignals, electionId, voteChoice } = parsed.data;

    // 1. Verify the ZKP
    // The public signals typically contain:
    // [0]: nullifier hash (to prevent double voting)
    // [1]: election ID (to ensure proof is for this election)
    type SnarkJSGroth16 = {
      groth16: {
        verify: (vKey: unknown, publicSignals: unknown, proof: unknown) => Promise<boolean>;
      };
    };

    const snark = snarkjs as unknown as SnarkJSGroth16;
    const isValid = await snark.groth16.verify(vKey, publicSignals, proof);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid ZKP proof" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nullifier = publicSignals[0];

    // 2. Check if nullifier has already been used for this election
    const { data: existingVote, error: checkError } = await supabase
      .from("votes")
      .select("id")
      .eq("election_id", electionId)
      .eq("nullifier", nullifier)
      .single();

    if (existingVote) {
      return new Response(
        JSON.stringify({ error: "Double voting detected. Nullifier already used." }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // PGRST116 is "No rows found", which is expected if the nullifier is unused
    if (checkError && checkError.code !== "PGRST116") {
      throw new Error(`Database error: ${checkError.message}`);
    }

    // 3. Record the vote securely against the nullifier
    const { error: insertError } = await supabase.from("votes").insert({
      election_id: electionId,
      choice: voteChoice,
      nullifier: nullifier,
      // user_id is intentionally omitted to preserve anonymity
    });

    if (insertError) {
      throw new Error(`Failed to record vote: ${insertError.message}`);
    }

    return new Response(JSON.stringify({ message: "Vote successfully recorded" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
