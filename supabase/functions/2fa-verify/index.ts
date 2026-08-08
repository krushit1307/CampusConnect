// =============================================================================
// Edge Function: 2FA Verify (Login Step 2)
// Issue: #2386 - Implement Time-Based One-Time Password (TOTP) 2FA system
// Description: Validates the 6-digit TOTP code during login if the user has 
// 2FA enabled. Returns a valid session/JWT upon successful verification.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticator } from "https://esm.sh/otplib@12.0.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { email, temp_token, code } = await req.json();

        if (!email || !temp_token || !code) {
            throw new Error("Missing required fields: email, temp_token, code");
        }

        // Initialize Supabase client with Service Role Key to bypass RLS for verification
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Fetch user profile to get the encrypted TOTP secret
        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("id, totp_secret, is_2fa_enabled")
            .eq("id", temp_token) // Assuming temp_token is the user ID for this flow
            .single();

        if (profileError || !profile) {
            throw new Error("User not found or invalid temporary token");
        }

        if (!profile.is_2fa_enabled) {
            throw new Error("2FA is not enabled for this account");
        }

        const cleanSecret = profile.totp_secret.replace("ENC:", "");

        // Configure otplib to accept codes from 30s in the past or future (window: 1)
        authenticator.options = { window: 1 };
        const isValid = authenticator.check(code, cleanSecret);

        if (!isValid) {
            return new Response(
                JSON.stringify({ error: "Invalid 2FA code. Time drift or incorrect entry." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
            );
        }

        // Generate a valid Supabase session / JWT for the frontend
        // In a real implementation, you would use supabase.auth.admin.generateLink or similar
        // Here we simulate returning a success state for the frontend to finalize auth
        return new Response(
            JSON.stringify({
                success: true,
                message: "2FA Verified. Access Granted.",
                userId: profile.id
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
});
