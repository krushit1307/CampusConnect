import { supabase } from "@/lib/supabase/client";

export type FundingRequestStatus = "pending" | "under_review" | "approved" | "denied";

export interface FundingLineItemInput {
  description: string;
  amount: number;
  quote_url?: string;
}

export interface FundingLineItem extends FundingLineItemInput {
  id: string;
  request_id: string;
}

export interface FundingRequest {
  id: string;
  club_id: string;
  requested_by: string;
  title: string;
  total_amount: number;
  status: FundingRequestStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  funding_line_items?: FundingLineItem[];
  club_name?: string;
}

export function calculateFundingTotal(items: FundingLineItemInput[]) {
  return Number(items.reduce((total, item) => total + item.amount, 0).toFixed(2));
}

export function validateFundingLineItems(items: FundingLineItemInput[]) {
  if (items.length === 0) return "Add at least one line item.";

  for (const item of items) {
    if (!item.description.trim()) return "Every line item needs a description.";
    if (!Number.isFinite(item.amount) || item.amount <= 0) {
      return "Every line item needs a positive amount.";
    }
  }

  return null;
}

export async function submitFundingRequest(
  clubId: string,
  title: string,
  items: FundingLineItemInput[],
) {
  const validationError = validateFundingLineItems(items);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase.rpc("submit_funding_request", {
    p_club_id: clubId,
    p_title: title.trim(),
    p_line_items: items.map((item) => ({
      description: item.description.trim(),
      amount: Number(item.amount.toFixed(2)),
      quote_url: item.quote_url?.trim() || null,
    })),
  });

  if (error) throw error;
  return data as string;
}

async function attachClubNames(requests: FundingRequest[]) {
  const clubIds = [...new Set(requests.map((request) => request.club_id))];
  if (clubIds.length === 0) return requests;

  const { data: clubs, error } = await supabase.from("clubs").select("id, name").in("id", clubIds);
  if (error) throw error;

  const names = new Map((clubs ?? []).map((club) => [club.id, club.name]));
  return requests.map((request) => ({ ...request, club_name: names.get(request.club_id) }));
}

export async function fetchClubFundingRequests(clubId: string) {
  const { data, error } = await supabase
    .from("funding_requests" as never)
    .select("*, funding_line_items(*)")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FundingRequest[];
}

export async function fetchFundingRequestsForReview() {
  const { data, error } = await supabase
    .from("funding_requests" as never)
    .select("*, funding_line_items(*)")
    .in("status", ["pending", "under_review", "approved", "denied"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return attachClubNames((data ?? []) as FundingRequest[]);
}

export async function setFundingRequestStatus(
  requestId: string,
  status: Exclude<FundingRequestStatus, "pending">,
  reviewNotes?: string,
) {
  const { data, error } = await supabase.rpc("set_funding_request_status", {
    p_request_id: requestId,
    p_status: status,
    p_review_notes: reviewNotes?.trim() || null,
  });
  if (error) throw error;
  return data;
}
