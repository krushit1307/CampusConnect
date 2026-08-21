// src/lib/budgetWorkflow.ts
//
// Frontend client for the Budget Request and Approval Workflow (Issue #2897).

import { supabase } from "./supabase/client";

export interface BudgetLineItemInput {
    description: string;
    category: string;
    requested_amount: number;
    quote_pdf_url?: string;
}

export interface BudgetLineItem extends BudgetLineItemInput {
    id: string;
    budget_request_id: string;
    approved_amount: number | null;
    status: "pending" | "approved" | "rejected" | "modified";
}

export interface BudgetRequest {
    id: string;
    event_id: string;
    club_id: string;
    requested_by: string;
    status: "pending" | "approved" | "rejected" | "changes_requested";
    total_requested: number;
    total_approved: number;
    admin_comment: string | null;
    created_at: string;
    line_items?: BudgetLineItem[];
}

/**
 * Submit a new budget request with itemized line items.
 * Calls the `submit_budget_request` RPC.
 */
export async function submitBudgetRequest(
    eventId: string,
    clubId: string,
    userId: string,
    lineItems: BudgetLineItemInput[]
): Promise<{ success: boolean; requestId?: string; error?: string }> {
    const { data, error } = await supabase.rpc("submit_budget_request", {
        p_event_id: eventId,
        p_club_id: clubId,
        p_requested_by: userId,
        p_line_items: lineItems,
    });

    if (error || !data) {
        return {
            success: false,
            error: error?.message ?? "Failed to submit budget request.",
        };
    }
    return { success: true, requestId: data };
}

/**
 * Fetch a budget request (with line items) for a specific event.
 */
export async function fetchBudgetRequest(eventId: string): Promise<BudgetRequest | null> {
    const { data: request, error: reqError } = await supabase
        .from("budget_requests")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (reqError || !request) return null;

    const { data: items, error: itemsError } = await supabase
        .from("budget_line_items")
        .select("*")
        .eq("budget_request_id", request.id);

    if (itemsError || !items) return request as BudgetRequest;

    return { ...request, line_items: items } as BudgetRequest;
}

/**
 * Fetch all pending budget requests (for the Student Union admin dashboard).
 */
export async function fetchPendingBudgetRequests(): Promise<BudgetRequest[]> {
    const { data, error } = await supabase
        .from("budget_requests")
        .select("*")
        .in("status", ["pending", "changes_requested"])
        .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data as BudgetRequest[];
}

/**
 * Approve an entire budget request.
 */
export async function approveBudgetRequest(
    requestId: string,
    adminId: string,
    comment?: string
): Promise<{ success: boolean; totalApproved?: number; error?: string }> {
    const { data, error } = await supabase.rpc("approve_budget_request", {
        p_request_id: requestId,
        p_admin_id: adminId,
        p_comment: comment ?? null,
    });

    if (error || !data || data.success === false) {
        return { success: false, error: data?.error ?? error?.message };
    }
    return { success: true, totalApproved: data.total_approved };
}

/**
 * Reject an entire budget request.
 */
export async function rejectBudgetRequest(
    requestId: string,
    adminId: string,
    comment?: string
): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc("reject_budget_request", {
        p_request_id: requestId,
        p_admin_id: adminId,
        p_comment: comment ?? null,
    });

    if (error || !data || data.success === false) {
        return { success: false, error: data?.error ?? error?.message };
    }
    return { success: true };
}

/**
 * Request changes to a budget request.
 */
export async function requestBudgetChanges(
    requestId: string,
    adminId: string,
    comment: string
): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc("request_budget_changes", {
        p_request_id: requestId,
        p_admin_id: adminId,
        p_comment: comment,
    });

    if (error || !data || data.success === false) {
        return { success: false, error: data?.error ?? error?.message };
    }
    return { success: true };
}

/**
 * Approve, reject, or modify a single line item (partial approval).
 */
export async function reviewLineItem(
    lineItemId: string,
    adminId: string,
    action: "approve" | "reject" | "modify",
    approvedAmount?: number
): Promise<{ success: boolean; newStatus?: string; error?: string }> {
    const { data, error } = await supabase.rpc("approve_line_item", {
        p_line_item_id: lineItemId,
        p_admin_id: adminId,
        p_action: action,
        p_approved_amount: approvedAmount ?? null,
    });

    if (error || !data || data.success === false) {
        return { success: false, error: data?.error ?? error?.message };
    }
    return { success: true, newStatus: data.new_status };
}
