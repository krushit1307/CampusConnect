/**
 * Supabase Edge Function: Send Push Notification
 * 
 * Triggered by the backend (e.g., via Database Webhooks or RPC) when a new direct message is created.
 * It fetches the recipient's push subscriptions and sends the web push payload to each endpoint.
 */

// @ts-ignore: Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore: Deno imports
import webpush from "https://esm.sh/web-push@3.6.0";

declare const Deno: any;

// Initialize Supabase client with service role key for admin access
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configure web-push with VAPID details
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

webpush.setVapidDetails(
  'mailto:admin@campusconnect.com',
  vapidPublicKey,
  vapidPrivateKey
);

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Expecting payload: { user_id: string, message: string, sender_name: string }
    const { user_id, message, sender_name } = await req.json();

    if (!user_id || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id or message in payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch all push subscriptions for the target user
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id);

    if (fetchError || !subscriptions) {
      console.error('Error fetching subscriptions:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions found for user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Construct the push payload
    const payload = JSON.stringify({
      title: `New message from ${sender_name || 'CampusConnect'}`,
      body: message,
      icon: '/icon-192x192.png',
      data: { url: '/messages' },
      tag: 'campusconnect-dm',
    });

    // 3. Send push notification to all active endpoints
    const sendPromises = subscriptions.map(async (sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription as any, payload);
        return { success: true, endpoint: sub.endpoint };
      } catch (err: any) {
        // If the subscription is expired or invalid (e.g., 410 Gone), we should ideally clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
        console.error(`Failed to send push to ${sub.endpoint}:`, err);
        return { success: false, endpoint: sub.endpoint, error: err.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter((r: any) => r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent to ${successCount} of ${subscriptions.length} devices`,
        details: results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Internal server error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
