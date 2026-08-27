// src/lib/clubIntegrations.ts
//
// Frontend client for the Club Integrations / Webhook system (Issue #2687).

import { supabase } from "./supabase/client";

export interface ClubIntegration {
    id: string;
    club_id: string;
    provider_type: "discord" | "slack" | "generic";
    webhook_url: string;
    is_active: boolean;
    created_at: string;
}

/**
 * Fetch all integrations for a club.
 * The webhook_url is returned because RLS allows club admins to see it.
 */
export async function fetchClubIntegrations(clubId: string): Promise<ClubIntegration[]> {
    const { data, error } = await supabase
        .from("club_integrations")
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data as ClubIntegration[];
}

/**
 * Add a new webhook integration for a club.
 */
export async function addIntegration(
    clubId: string,
    providerType: "discord" | "slack" | "generic",
    webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from("club_integrations").insert({
        club_id: clubId,
        provider_type: providerType,
        webhook_url: webhookUrl,
        is_active: true,
    });

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true };
}

/**
 * Remove a webhook integration.
 */
export async function removeIntegration(integrationId: string): Promise<boolean> {
    const { error } = await supabase
        .from("club_integrations")
        .delete()
        .eq("id", integrationId);

    return !error;
}

/**
 * Test a webhook by invoking the dispatcher Edge Function directly.
 * Sends a test event payload.
 */
export async function testWebhook(
    webhookUrl: string,
    providerType: "discord" | "slack" | "generic"
): Promise<{ success: boolean; message: string }> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

    const response = await fetch(
        `${supabaseUrl}/functions/v1/club-webhook-dispatcher`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
                event_id: "test-event",
                event_title: "🧪 Test Webhook from CampusConnect",
                event_description: "If you can see this message, your webhook is configured correctly!",
                event_date: new Date().toISOString(),
                event_location: "CampusConnect Dashboard",
                banner_url: null,
                club_name: "Test Club",
                webhook_url: webhookUrl,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok || data.success === false) {
        return {
            success: false,
            message: data.error ?? data.detail ?? "Test failed",
        };
    }

    return { success: true, message: "Test message sent successfully!" };
}
