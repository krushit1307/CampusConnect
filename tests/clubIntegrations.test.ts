// tests/clubIntegrations.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/supabase/client", () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    order: vi.fn(() => ({ data: [], error: null })),
                })),
            })),
            insert: vi.fn(() => ({ error: null })),
            delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
        })),
    },
}));

vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import {
    fetchClubIntegrations,
    addIntegration,
    removeIntegration,
    testWebhook,
} from "../src/lib/clubIntegrations";

beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
});

describe("clubIntegrations — addIntegration", () => {
    it("returns success when insert succeeds", async () => {
        const result = await addIntegration("club-1", "discord", "https://discord.com/api/webhooks/123/abc");
        expect(result.success).toBe(true);
    });
});

describe("clubIntegrations — removeIntegration", () => {
    it("returns true when delete succeeds", async () => {
        const result = await removeIntegration("int-1");
        expect(result).toBe(true);
    });
});

describe("clubIntegrations — testWebhook", () => {
    it("returns success when the Edge Function returns success", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true }),
        });
        const result = await testWebhook("https://discord.com/api/webhooks/123/abc", "discord");
        expect(result.success).toBe(true);
        expect(result.message).toContain("successfully");
    });

    it("returns failure when the Edge Function returns an error", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: false, error: "Invalid webhook URL" }),
        });
        const result = await testWebhook("https://example.com", "generic");
        expect(result.success).toBe(false);
        expect(result.message).toContain("Invalid webhook URL");
    });
});

describe("clubIntegrations — SQL contract (migration guards)", () => {
    it("the migration creates club_integrations table", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260821000000_club_webhook_dispatcher.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.club_integrations");
        expect(sql).toContain("provider_type TEXT");
        expect(sql).toContain("webhook_url TEXT NOT NULL");
    });

    it("the migration creates the dispatch trigger on events", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260821000000_club_webhook_dispatcher.sql"),
            "utf-8"
        );
        expect(sql).toContain("dispatch_event_webhook");
        expect(sql).toContain("on_event_published_webhook");
        expect(sql).toContain("status = 'published'");
    });

    it("the migration uses pg_net for the HTTP POST", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260821000000_club_webhook_dispatcher.sql"),
            "utf-8"
        );
        expect(sql).toContain("extensions.net.http_post");
        expect(sql).toContain("club-webhook-dispatcher");
    });
});
