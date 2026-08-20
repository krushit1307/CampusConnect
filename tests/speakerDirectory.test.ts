// tests/speakerDirectory.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/supabase/client", () => ({
    supabase: {
        rpc: vi.fn(),
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                order: vi.fn(() => ({ data: [], error: null })),
            })),
            insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: { id: "spk-1" }, error: null })) })) })),
            update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
        })),
    },
}));

import { supabase } from "../src/lib/supabase/client";
import {
    searchSpeakers,
    createSpeaker,
    fetchSpeakerHistory,
    addSpeakerNote,
    linkSpeakerToEvent,
} from "../src/lib/speakerDirectory";

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
    mockRpc.mockReset();
});

describe("speakerDirectory — searchSpeakers", () => {
    it("returns empty array for empty query", async () => {
        const result = await searchSpeakers("");
        expect(result).toEqual([]);
    });

    it("returns results when RPC succeeds", async () => {
        mockRpc.mockResolvedValueOnce({
            data: [{ id: "spk-1", name: "John Doe", organization: "Microsoft" }],
            error: null,
        });
        const result = await searchSpeakers("John");
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("John Doe");
    });
});

describe("speakerDirectory — createSpeaker", () => {
    it("returns success with speaker ID", async () => {
        const result = await createSpeaker({
            name: "Jane Smith",
            organization: "Google",
        });
        expect(result.success).toBe(true);
        expect(result.speakerId).toBe("spk-1");
    });
});

describe("speakerDirectory — fetchSpeakerHistory", () => {
    it("returns parsed history on success", async () => {
        mockRpc.mockResolvedValueOnce({
            data: {
                success: true,
                speaker: { id: "spk-1", name: "John Doe", contact_email: "john@example.com" },
                events: [{ event_id: "evt-1", event_title: "Tech Talk" }],
                notes: [{ note_id: "note-1", note_text: "Great speaker" }],
            },
            error: null,
        });
        const result = await fetchSpeakerHistory("spk-1");
        expect(result).not.toBeNull();
        expect(result?.speaker.name).toBe("John Doe");
        expect(result?.events).toHaveLength(1);
        expect(result?.notes).toHaveLength(1);
    });

    it("returns null when RPC fails", async () => {
        mockRpc.mockResolvedValueOnce({
            data: { success: false, error: "Not found" },
            error: null,
        });
        const result = await fetchSpeakerHistory("spk-1");
        expect(result).toBeNull();
    });
});

describe("speakerDirectory — addSpeakerNote", () => {
    it("returns success on insert", async () => {
        const result = await addSpeakerNote("spk-1", "club-1", "user-1", "Was late");
        expect(result.success).toBe(true);
    });
});

describe("speakerDirectory — linkSpeakerToEvent", () => {
    it("returns success on update", async () => {
        const result = await linkSpeakerToEvent("evt-1", "spk-1");
        expect(result.success).toBe(true);
    });
});

describe("speakerDirectory — SQL contract (migration guards)", () => {
    it("the migration creates guest_speakers table", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260823000000_speaker_directory.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.guest_speakers");
        expect(sql).toContain("contact_email TEXT");
    });

    it("the migration creates speaker_notes table", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260823000000_speaker_directory.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.speaker_notes");
        expect(sql).toContain("is_private BOOLEAN NOT NULL DEFAULT TRUE");
    });

    it("the migration adds speaker_id to events", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260823000000_speaker_directory.sql"),
            "utf-8"
        );
        expect(sql).toContain("ADD COLUMN IF NOT EXISTS speaker_id UUID REFERENCES public.guest_speakers(id)");
    });

    it("the migration creates the is_club_admin function", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260823000000_speaker_directory.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.is_club_admin()");
    });

    it("the migration creates the guest_speakers_public view", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260823000000_speaker_directory.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE OR REPLACE VIEW public.guest_speakers_public AS");
        // Verify the view masks the email
        expect(sql).toContain("CASE WHEN public.is_club_admin() THEN contact_email ELSE NULL END");
    });
});
