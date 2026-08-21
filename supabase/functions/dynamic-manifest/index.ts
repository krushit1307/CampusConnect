// =============================================================================
// Edge Function: Dynamic PWA Manifest
// Issue: #3345 - Implement 'Dynamic PWA App Icon Switching'
// Description: Serves a dynamically generated Web App Manifest based on the
// requested theme query parameter.This allows Android PWAs and browser tabs
// to reflect the user's personalized icon and theme color.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Define available themes and their corresponding assets
const THEMES: Record<string, { theme_color: string; background_color: string; icon_prefix: string }> = {
    default: {
        theme_color: "#4F46E5", // Indigo
        background_color: "#ffffff",
        icon_prefix: "icon-default"
    },
    dark: {
        theme_color: "#1F2937", // Gray 800
        background_color: "#111827",
        icon_prefix: "icon-dark"
    },
    red: {
        theme_color: "#DC2626", // Red 600
        background_color: "#ffffff",
        icon_prefix: "icon-red"
    },
    purple: {
        theme_color: "#9333EA", // Purple 600
        background_color: "#ffffff",
        icon_prefix: "icon-purple"
    },
    green: {
        theme_color: "#16A34A", // Green 600
        background_color: "#ffffff",
        icon_prefix: "icon-green"
    }
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const requestedTheme = url.searchParams.get("theme") || "default";

        // Fallback to default if invalid theme requested
        const themeConfig = THEMES[requestedTheme] || THEMES.default;
        const baseUrl = Deno.env.get("APP_URL") || "https://campusconnect.app";

        // Construct the Web App Manifest JSON
        const manifest = {
            name: "CampusConnect",
            short_name: "CampusConnect",
            description: "The ultimate platform for campus clubs and events.",
            start_url: "/",
            display: "standalone",
            orientation: "portrait",
            theme_color: themeConfig.theme_color,
            background_color: themeConfig.background_color,
            icons: [
                {
                    src: `${baseUrl}/assets/pwa/${themeConfig.icon_prefix}-192x192.png`,
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "any maskable"
                },
                {
                    src: `${baseUrl}/assets/pwa/${themeConfig.icon_prefix}-512x512.png`,
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "any maskable"
                }
            ]
        };

        // Return manifest with correct content type and aggressive caching headers
        // (Manifests rarely change, but we cache for 1 hour to allow theme updates)
        return new Response(JSON.stringify(manifest, null, 2), {
            headers: {
                ...corsHeaders,
                "Content-Type": "application/manifest+json",
                "Cache-Control": "public, max-age=3600"
            },
            status: 200
        });

    } catch (error: any) {
        console.error("[DynamicManifest] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
