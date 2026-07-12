import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory store for rate limiting (Note: in a multi-region deployment, use Redis. 
// For this scale, global memory per isolate works to prevent rapid spam bursts).
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 2000; // 2 seconds

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get JWT from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { eventId, hasRsvpd } = await req.json()

    if (!eventId) {
      return new Response(JSON.stringify({ error: 'Missing eventId' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Rate Limiting Logic
    const rateLimitKey = `${user.id}:${eventId}`;
    const now = Date.now();
    const lastRequest = rateLimitMap.get(rateLimitKey);

    if (lastRequest && (now - lastRequest < RATE_LIMIT_WINDOW_MS)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait before toggling again.' }), { 
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    rateLimitMap.set(rateLimitKey, now);

    // Clean up old entries periodically to prevent memory leak
    if (rateLimitMap.size > 10000) {
        rateLimitMap.clear();
    }

    // Execute RSVP logic securely
    if (hasRsvpd) {
      const { error } = await supabase
        .from("event_rsvps")
        .delete()
        .match({ event_id: eventId, user_id: user.id });
        
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("event_rsvps")
        .insert({ event_id: eventId, user_id: user.id });
        
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
