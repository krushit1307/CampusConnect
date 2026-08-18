// tests/budgetWorkflow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/supabase/client", () => ({
    supabase: {
        rpc: vi.fn(),
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                            single: vi.fn(() => ({ data: null, error: null })),
                        })),
                    })),
                })),
                in: vi.fn(() => ({
                    order: vi.fn(() => ({ data: [], error: null })),
                })),
            })),
        })),
    },
}));

import { supabase } from "../src/lib/supabase/client";
import {
    submitBudgetRequest,
    approveBudgetRequest,
    rejectBudgetRequest,
    requestBudgetChanges,
    reviewLineItem,
} from "../src/lib/budgetWorkflow";

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
    mockRpc.mockReset();
});

describe("budgetWorkflow — submitBudgetRequest", () => {
    it("returns success with request ID when RPC succeeds", async () => {
        mockRpc.mockResolvedValueOnce({ data: "req-123", error: null });
        const result = await submitBudgetRequest("evt-1", "club-1", "user-1", [
            { description: "Pizza", category: "food", requested_amount: 100 },
        ]);
        expect(result.success).toBe(true);
        expect(result.requestId).toBe("req-123");
    });

    it("returns error when RPC fails", async () => {
        mockRpc.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
        const result = await submitBudgetRequest("evt-1", "club-1", "user-1", []);
        expect(result.success).toBe(false);
    });
});

describe("budgetWorkflow — approveBudgetRequest", () => {
    it("returns success with totalApproved", async () => {
        mockRpc.mockResolvedValueOnce({
            data: { success: true, total_approved: 500 },
            error: null,
        });
        const result = await approveBudgetRequest("req-1", "admin-1");
        expect(result.success).toBe(true);
        expect(result.totalApproved).toBe(500);
    });
});

describe("budgetWorkflow — rejectBudgetRequest", () => {
    it("returns success", async () => {
        mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });
        const result = await rejectBudgetRequest("req-1", "admin-1", "No budget");
        expect(result.success).toBe(true);
    });
});

describe("budgetWorkflow — requestBudgetChanges", () => {
    it("returns success", async () => {
        mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });
        const result = await requestBudgetChanges("req-1", "admin-1", "Reduce pizza");
        expect(result.success).toBe(true);
    });
});

describe("budgetWorkflow — reviewLineItem (partial approval)", () => {
    it("returns new status for approve action", async () => {
        mockRpc.mockResolvedValueOnce({
            data: { success: true, new_status: "approved" },
            error: null,
        });
        const result = await reviewLineItem("item-1", "admin-1", "approve");
        expect(result.success).toBe(true);
        expect(result.newStatus).toBe("approved");
    });

    it("passes approved_amount for modify action", async () => {
        mockRpc.mockResolvedValueOnce({
            data: { success: true, new_status: "modified" },
            error: null,
        });
        await reviewLineItem("item-1", "admin-1", "modify", 75.0);
        expect(mockRpc).toHaveBeenCalledWith("approve_line_item", {
            p_line_item_id: "item-1",
            p_admin_id: "admin-1",
            p_action: "modify",
            p_approved_amount: 75.0,
        });
    });
});

describe("budgetWorkflow — SQL contract (migration guards)", () => {
    it("the migration creates budget_requests and budget_line_items tables", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260820000000_budget_approval_workflow.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.budget_requests");
        expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.budget_line_items");
        expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.budget_approval_audit_log");
    });

    it("the migration adds requires_funding to events", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260820000000_budget_approval_workflow.sql"),
            "utf-8"
        );
        expect(sql).toContain("ADD COLUMN IF NOT EXISTS requires_funding BOOLEAN");
    });

    it("the migration creates the submit and approve RPCs", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260820000000_budget_approval_workflow.sql"),
            "utf-8"
        );
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.submit_budget_request");
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.approve_budget_request");
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.reject_budget_request");
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.request_budget_changes");
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.approve_line_item");
    });

    it("the migration creates the publication guard trigger", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const sql = fs.readFileSync(
            path.resolve(__dirname, "../supabase/migrations/20260820000000_budget_approval_workflow.sql"),
            "utf-8"
        );
        expect(sql).toContain("prevent_publish_without_funding_approval");
        expect(sql).toContain("on_event_publish_check");
    });
});
