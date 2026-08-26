// tests/umbrellaEvents.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/supabase/client", () => ({
    supabase: {
        rpc: vi.fn(),
    },
}));

import { supabase } from "../src/lib/supabase/client";
import {
    fetchUmbrellaSchedule,
    purchaseGlobalPass,
} from "../src/lib/umbrellaEvents";

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
    mockRpc.mockReset();
});

describe("umbrellaEvents — fetchUmbrellaSchedule", () => {
    it("returns the parsed schedule when the RPC succeeds", async () => {
        mockRpc.mockResolvedValueOnce({
            data: {
                success: true,
                umbrella: {
                    id: "u1",
                    title: "Homecoming Week",
                    description: "A week of events.",
                    event_type: "umbrella",
                },
                children: [
                    {
                        id: "c1",
                        title: "Opening Concert",
                        attending_count: 50,
                        club_name: "Music Club",
                    },
                ],
            },
            error: null,
        });

        const result = await fetchUmbrellaSchedule("u1");
        expect(result).not.toBeNull();
        expect(result?.umbrella.title).toBe("Homecoming Week");
        expect(result?.children).toHaveLength(1);
        expect(result?.children[0].title).toBe("Opening Concert");
    });

    it("returns null when the RPC errors", async () => {
        mockRpc.mockResolvedValueOnce({
            data: null,
            error: { message: "permission denied" },
        });
        const result = await fetchUmbrellaSchedule("u1");
        expect(result).toBeNull();
    });

    it("returns null when the RPC reports success=false", async () => {
        mockRpc.mockResolvedValueOnce({
            data: { success: false, error: "Umbrella event not found." },
            error: null,
        });
        const result = await fetchUmbrellaSchedule("u1");
        expect(result).toBeNull();
    });
});

describe("umbrellaEvents — purchaseGlobalPass", () => {
    it("returns success with counts when the RPC succeeds", async () => {
        mockRpc.mockResolvedValueOnce({
            data: {
                success: true,
                message: "Global pass purchased.",
                auto_rsvped_count: 5,
                waitlisted_count: 2,
            },
            error: null,
        });

        const result = await purchaseGlobalPass("u1", "user-1");
        expect(result.success).toBe(true);
        expect(result.autoRsvpedCount).toBe(5);
        expect(result.waitlistedCount).toBe(2);
    });

    it("returns failure when the RPC reports success=false", async () => {
        mockRpc.mockResolvedValueOnce({
            data: {
                success: false,
                error: "Global passes are sold out.",
            },
            error: null,
        });

        const result = await purchaseGlobalPass("u1", "user-1");
        expect(result.success).toBe(false);
        expect(result.message).toBe("Global passes are sold out.");
        expect(result.autoRsvpedCount).toBe(0);
    });

    it("returns failure when the RPC errors", async () => {
        mockRpc.mockResolvedValueOnce({
            data: null,
            error: { message: "network error" },
        });

        const result = await purchaseGlobalPass("u1", "user-1");
        expect(result.success).toBe(false);
        expect(result.message).toContain("network error");
    });

    it("passes the correct parameters to the RPC", async () => {
        mockRpc.mockResolvedValueOnce({
            data: { success: true, auto_rsvped_count: 0, waitlisted_count: 0 },
            error: null,
        });

        await purchaseGlobalPass("umbrella-123", "user-456");

        expect(mockRpc).toHaveBeenCalledWith("purchase_global_pass", {
            p_umbrella_id: "umbrella-123",
            p_user_id: "user-456",
        });
    });
});

describe("umbrellaEvents — SQL contract (migration guards)", () => {
    it("the migration adds parent_event_id and event_type columns", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260818000000_umbrella_events.sql"),
            "utf-8"
        );
        expect(sql).toContain("ADD COLUMN IF NOT EXISTS parent_event_id");
        expect(sql).toContain("ADD COLUMN IF NOT EXISTS event_type");
        expect(sql).toContain("'standalone', 'umbrella', 'child'");
    });

    it("the migration adds is_global_pass to event_rsvps", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260818000000_umbrella_events.sql"),
            "utf-8"
        );
        expect(sql).toContain("ADD COLUMN IF NOT EXISTS is_global_pass");
    });

    it("the migration creates the get_umbrella_schedule RPC", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260818000000_umbrella_events.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_umbrella_schedule");
    });

    it("the migration creates the purchase_global_pass RPC", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260818000000_umbrella_events.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.purchase_global_pass");
    });

    it("the migration updates check_event_clashes for child events", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260818000000_umbrella_events.sql"),
            "utf-8"
        );
        expect(sql).toContain("p_parent_event_id UUID DEFAULT NULL");
        expect(sql).toContain("p_parent_event_id IS NULL OR e.id != p_parent_event_id");
        expect(sql).toContain("p_parent_event_id IS NULL OR e.parent_event_id != p_parent_event_id");
    });

    it("the migration creates the RLS policy for cross-club child events", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260818000000_umbrella_events.sql"),
            "utf-8"
        );
        expect(sql).toContain("Club admins can view parent umbrella events");
    });
});
