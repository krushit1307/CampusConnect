// =============================================================================
// Edge Function: Decrypt Vault
// Issue: #4051 - Implement 'Automated "Club Transition" Document Vault'
// Description: Verifies the user is the current president, checks if the 
// unlock_date has passed, and returns the decrypted payload while logging 
// the access attempt immutably.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_SECRET = Deno.env.get("VAULT_MASTER_SECRET") || "fallback-master-secret-change-in-prod";

// Simple AES-GCM decryption helper (matches client-side encryption logic)
async function decryptPayload(encryptedBase64: string, ivBase64: string): Promise<string> {
    const keyData = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(MASTER_SECRET));
    const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["decrypt"]);

    const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedData);
    return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { vault_id } = await req.json();
        if (!vault_id) throw new Error("Missing vault_id");

        // 1. Fetch vault and verify club presidency
        const { data: vault, error: vaultErr } = await supabaseAdmin
            .from("transition_vaults")
            .select("*, clubs!inner(club_members!inner(user_id, role))")
            .eq("id", vault_id)
            .single();

        if (vaultErr || !vault) throw new Error("Vault not found");

        const isPresident = (vault.clubs as any).club_members.some(
            (m: any) => m.user_id === user.id && m.role === 'president'
        );
        if (!isPresident) throw new Error("Only the current club president can access this vault");

        // 2. Check unlock date
        const today = new Date().toISOString().split('T')[0];
        if (vault.unlock_date > today) {
            throw new Error(`This vault is locked until ${vault.unlock_date}.`);
        }

        // 3. Decrypt payload
        const decryptedPayload = await decryptPayload(vault.encrypted_payload, vault.iv);

        // 4. Log access immutably
        const clientIP = req.headers.get("x-forwarded-for") || "unknown";
        await supabaseAdmin.from("vault_access_logs").insert({
            vault_id,
            user_id: user.id,
            action: 'decrypted',
            ip_address: clientIP,
        });

        return new Response(
            JSON.stringify({ success: true, payload: JSON.parse(decryptedPayload) }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
    } catch (error: any) {
        console.error("[DecryptVault] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 403 });
    }
});
