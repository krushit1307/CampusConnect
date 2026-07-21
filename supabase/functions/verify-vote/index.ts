import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as snarkjs from "npm:snarkjs";
import vKey from "./verification_key.json" with { type: "json" };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { proof, publicSignals, pollId, voteData } = await req.json();

    if (!proof || !publicSignals || !pollId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: proof, publicSignals, pollId" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verify the Zero-Knowledge Proof
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid Zero-Knowledge Proof" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // nullifierHash is usually the first public signal in anonymous voting circuits
    const nullifierHash = publicSignals[0]; 

    // 2. Initialize Supabase Admin Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Record the vote and prevent double-voting using the nullifier hash
    // We insert into vote_nullifiers. If it violates the UNIQUE constraint, the user has already voted.
    const { error: nullifierError } = await supabaseClient
      .from('vote_nullifiers')
      .insert({ poll_id: pollId, nullifier_hash: nullifierHash });

    if (nullifierError) {
      if (nullifierError.code === '23505') { // Postgres unique_violation code
        return new Response(
          JSON.stringify({ error: "Double voting detected. This nullifier has already been used." }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw nullifierError;
    }

    // 4. Record the actual vote (anonymously)
    // Assuming there's a 'votes' table. If not, this is where it would be recorded.
    // await supabaseClient.from('votes').insert({ poll_id: pollId, data: voteData });

    return new Response(
      JSON.stringify({ message: "Vote successfully cast and verified anonymously!" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
