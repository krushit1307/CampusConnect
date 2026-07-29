import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { secondary_jwt } = await req.json();

    if (!secondary_jwt) {
      return new Response(JSON.stringify({ error: 'Missing secondary_jwt' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Initialize client for the primary user
    const primaryClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Initialize client for the secondary user
    const secondaryClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${secondary_jwt}` } },
    });

    // Validate Primary JWT
    const { data: primaryData, error: primaryError } = await primaryClient.auth.getUser();
    if (primaryError || !primaryData.user) {
      return new Response(JSON.stringify({ error: 'Invalid primary authentication' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const primary_id = primaryData.user.id;

    // Validate Secondary JWT
    const { data: secondaryData, error: secondaryError } = await secondaryClient.auth.getUser();
    if (secondaryError || !secondaryData.user) {
      return new Response(JSON.stringify({ error: 'Invalid secondary authentication' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    const secondary_id = secondaryData.user.id;

    if (primary_id === secondary_id) {
      return new Response(JSON.stringify({ error: 'Primary and secondary accounts are the same' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Call the database RPC to perform the merge
    const { error: rpcError } = await primaryClient.rpc('merge_user_accounts', {
      primary_id,
      secondary_id,
    });

    if (rpcError) {
      return new Response(JSON.stringify({ error: 'Database merge failed', details: rpcError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Initialize admin client to delete the secondary auth.users account
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(secondary_id);

    if (deleteError) {
      return new Response(JSON.stringify({ error: 'Failed to delete secondary account from auth.users', details: deleteError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Accounts successfully merged' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
