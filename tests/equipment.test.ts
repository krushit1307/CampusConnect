// tests/equipment.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/supabase/client", () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    order: vi.fn(() => ({ data: [], error: null })),
                })),
            })),
        })),
        rpc: vi.fn(),
    },
}));

import { supabase } from "../src/lib/supabase/client";
import {
    fetchInventory,
    checkAvailability,
    createReservation,
    checkOutEquipment,
    checkInEquipment,
} from "../src/lib/equipment";

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
    mockRpc.mockReset();
});

describe("equipment — checkAvailability", () => {
    it("returns true when the RPC reports available", async () => {
        mockRpc.mockResolvedValueOnce({ data: true, error: null });
        const result = await checkAvailability("item-1", "2026-01-01", "2026-01-02");
        expect(result).toBe(true);
    });

    it("returns false when the RPC reports unavailable", async () => {
        mockRpc.mockResolvedValueOnce({ data: false, error: null });
        const result = await checkAvailability("item-1", "2026-01-01", "2026-01-02");
        expect(result).toBe(false);
    });
});

describe("equipment — checkOutEquipment", () => {
    it("returns success when the RPC succeeds", async () => {
        mockRpc.mockResolvedValueOnce({
            data: { success: true, message: "Checked out" },
            error: null,
        });
        const result = await checkOutEquipment("BARCODE-1", "res-1");
        expect(result.success).toBe(true);
    });

    it("returns failure when the RPC fails", async () => {
        mockRpc.mockResolvedValueOnce({
            data: { success: false, error: "Item not found" },
            error: null,
        });
        const result = await checkOutEquipment("BAD", "res-1");
        expect(result.success).toBe(false);
        expect(result.message).toContain("not found");
    });
});

describe("equipment — checkInEquipment", () => {
    it("returns success for good condition", async () => {
        mockRpc.mockResolvedValueOnce({
            data: { success: true, message: "Checked in" },
            error: null,
        });
        const result = await checkInEquipment("BARCODE-1", "good");
        expect(result.success).toBe(true);
    });

    it("returns success for damaged condition with notes", async () => {
        mockRpc.mockResolvedValueOnce({
            data: { success: true, message: "Checked in" },
            error: null,
        });
        const result = await checkInEquipment("BARCODE-1", "damaged", "Broken leg");
        expect(result.success).toBe(true);
        expect(mockRpc).toHaveBeenCalledWith("check_in_equipment", {
            p_barcode: "BARCODE-1",
            p_condition: "damaged",
            p_damage_notes: "Broken leg",
        });
    });
});

describe("equipment — SQL contract (migration guards)", () => {
    it("the migration creates inventory_items and equipment_reservations tables", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260819000000_equipment_rental.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.inventory_items");
        expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.equipment_reservations");
    });

    it("the migration has the double-booking exclusion constraint", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260819000000_equipment_rental.sql"),
            "utf-8"
        );
        expect(sql).toContain("exclude_overlapping_reservations");
        expect(sql).toContain("EXCLUDE USING gist");
        expect(sql).toContain("INTERVAL '2 hours'");
    });

    it("the migration creates the check-out and check-in RPCs", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260819000000_equipment_rental.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.check_out_equipment");
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.check_in_equipment");
    });
});
