import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { safetyCheckResponseId, dispatchedByUserId } = await req.json();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Extract the last known GPS coordinate of the missing student
        const { data: response, error: responseError } = await supabase
            .from('safety_check_responses')
            .select('id, user_id, status, last_known_latitude, last_known_longitude, location_updated_at')
            .eq('id', safetyCheckResponseId)
            .single();

        if (responseError || !response) {
            throw new Error('Safety check response not found.');
        }

        if (response.last_known_latitude == null || response.last_known_longitude == null) {
            return new Response(
                JSON.stringify({ success: false, message: 'No GPS fix recorded for this student.' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. Trigger an automated, high-priority webhook to the Drone Dispatch API (e.g. Skydio)
        const droneApiUrl = Deno.env.get('DRONE_DISPATCH_API_URL') ?? '';
        const droneApiKey = Deno.env.get('DRONE_DISPATCH_API_KEY') ?? '';

        let droneApiDispatchId: string | null = null;
        let hlsPlaybackUrl: string | null = null;
        let dispatchStatus = 'DISPATCHED';

        try {
            const droneRes = await fetch(`${droneApiUrl}/dispatch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${droneApiKey}`,
                },
                body: JSON.stringify({
                    target_latitude: response.last_known_latitude,
                    target_longitude: response.last_known_longitude,
                    priority: 'EMERGENCY',
                    requested_by: dispatchedByUserId,
                    reason: `Student ${response.user_id} did not confirm safe during an active Safety Roll Call.`,
                }),
            });

            const droneData = await droneRes.json();
            droneApiDispatchId = droneData.dispatch_id ?? null;
            hlsPlaybackUrl = droneData.hls_playback_url ?? null; // Drone streams RTMP; the fleet API exposes an HLS mirror for browser playback
        } catch (droneErr) {
            dispatchStatus = 'FAILED';
        }

        // 3. Record the dispatch
        const { data: dispatch, error: dispatchError } = await supabase
            .from('drone_dispatches')
            .insert({
                safety_check_response_id: response.id,
                student_user_id: response.user_id,
                dispatched_by: dispatchedByUserId,
                target_latitude: response.last_known_latitude,
                target_longitude: response.last_known_longitude,
                status: dispatchStatus,
                drone_api_dispatch_id: droneApiDispatchId,
                hls_playback_url: hlsPlaybackUrl,
            })
            .select()
            .single();

        if (dispatchError) throw new Error(dispatchError.message);

        return new Response(
            JSON.stringify({ success: dispatchStatus !== 'FAILED', dispatch }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});