// tests/prospectus.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/supabase/client", () => ({
    supabase: {
        rpc: vi.fn(),
    },
}));

import { supabase } from "../src/lib/supabase/client";
import {
    fetchProspectusMetrics,
    generateGrowthChartSVG,
    generateProspectusHTML,
    type ProspectusMetrics,
} from "../src/lib/prospectus";

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

const MOCK_METRICS: ProspectusMetrics = {
    club_name: "Robotics Club",
    club_description: "We build robots.",
    logo_url: null,
    banner_url: null,
    member_count: 45,
    event_count: 12,
    total_attendance: 320,
    avg_attendance: 26,
    majors: [{ major: "Engineering", count: 20 }],
    growth: [
        { year: 2022, members: 10 },
        { year: 2023, members: 25 },
        { year: 2024, members: 45 },
    ],
    tiers: [
        { name: "Gold", price: 50000, perks: ["Logo on shirt", "Booth at event"] },
    ],
};

beforeEach(() => {
    mockRpc.mockReset();
});

describe("prospectus — fetchProspectusMetrics", () => {
    it("returns parsed metrics on success", async () => {
        mockRpc.mockResolvedValueOnce({ data: MOCK_METRICS, error: null });
        const result = await fetchProspectusMetrics("club-1");
        expect(result).not.toBeNull();
        expect(result?.club_name).toBe("Robotics Club");
    });

    it("returns null on error", async () => {
        mockRpc.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
        const result = await fetchProspectusMetrics("club-1");
        expect(result).toBeNull();
    });
});

describe("prospectus — generateGrowthChartSVG", () => {
    it("generates a valid base64 SVG string", () => {
        const svg = generateGrowthChartSVG(MOCK_METRICS.growth, "#6366f1");
        expect(svg).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it("handles empty data gracefully", () => {
        const svg = generateGrowthChartSVG([], "#000");
        expect(svg).toContain("No growth data available");
    });
});

describe("prospectus — generateProspectusHTML", () => {
    it("includes the club name and pitch text", () => {
        const html = generateProspectusHTML(MOCK_METRICS, {
            pitchText: "Support us!",
            selectedTiers: ["Gold"],
            primaryColor: "#6366f1",
        });
        expect(html).toContain("Robotics Club");
        expect(html).toContain("Support us!");
    });

    it("includes the custom brand color", () => {
        const html = generateProspectusHTML(MOCK_METRICS, {
            pitchText: "",
            selectedTiers: [],
            primaryColor: "#ff0000",
        });
        expect(html).toContain("#ff0000");
    });

    it("includes the selected tier", () => {
        const html = generateProspectusHTML(MOCK_METRICS, {
            pitchText: "",
            selectedTiers: ["Gold"],
            primaryColor: "#6366f1",
        });
        expect(html).toContain("Gold");
        expect(html).toContain("$500.00");
        expect(html).toContain("Logo on shirt");
    });

    it("excludes unselected tiers", () => {
        const html = generateProspectusHTML(MOCK_METRICS, {
            pitchText: "",
            selectedTiers: [], // No tiers selected
            primaryColor: "#6366f1",
        });
        expect(html).not.toContain("Sponsorship Tiers");
    });

    it("includes the growth chart image", () => {
        const html = generateProspectusHTML(MOCK_METRICS, {
            pitchText: "",
            selectedTiers: [],
            primaryColor: "#6366f1",
        });
        expect(html).toContain("data:image/svg+xml;base64,");
    });
});

describe("prospectus — SQL contract (migration guards)", () => {
    it("the migration creates the get_club_prospectus_metrics RPC", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260822000000_prospectus_metrics.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_club_prospectus_metrics");
    });
});
