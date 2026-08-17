import { supabase } from "@/lib/supabase";
import {
  evaluateTransfer,
  type ResalePolicy,
  type SellerContext,
  type TicketContext,
  type TransferAssessment,
  type TransferRequest,
} from "@/lib/resaleGuard";

export interface TransferContext {
  policy: ResalePolicy;
  ticket: TicketContext;
  seller: SellerContext;
}

/** Policy applied when an organiser has not configured one. */
export const DEFAULT_RESALE_POLICY: Omit<ResalePolicy, "eventId"> = {
  capMode: "face_value",
  capValue: 0,
  cooldownHours: 24,
  maxTransfersPerTicket: 2,
  maxResalesPerSeller: 2,
  reviewRiskThreshold: 50,
  finalHoursReviewWindow: 6,
};

function toPolicy(eventId: string, row: any | null): ResalePolicy {
  if (!row) return { eventId, ...DEFAULT_RESALE_POLICY };

  return {
    eventId,
    capMode: row.cap_mode,
    capValue: Number(row.cap_value),
    cooldownHours: Number(row.cooldown_hours),
    maxTransfersPerTicket: Number(row.max_transfers_per_ticket),
    maxResalesPerSeller: Number(row.max_resales_per_seller),
    reviewRiskThreshold: Number(row.review_risk_threshold),
    finalHoursReviewWindow: Number(row.final_hours_review_window),
  };
}

export const ticketResaleService = {
  /** Resale policy for an event, falling back to the platform default. */
  async getPolicy(eventId: string): Promise<ResalePolicy> {
    const { data, error } = await supabase
      .from("event_resale_policies")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    if (error) throw error;
    return toPolicy(eventId, data);
  },

  /**
   * Face value of a ticket for an event, taken from the dearest ticket tier.
   * Events with no tiers are free, and a free ticket may not be sold on.
   */
  async getFaceValueCents(eventId: string): Promise<number> {
    const { data, error } = await supabase
      .from("ticket_tiers")
      .select("price")
      .eq("event_id", eventId)
      .order("price", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return Math.max(0, Number((data as any)?.price ?? 0));
  },

  /**
   * Assembles everything the guard needs about a ticket and its holder.
   *
   * The counters come from the database rather than the client so a seller
   * cannot improve their own risk score by editing what the page sends.
   */
  async getTransferContext(
    eventId: string,
    ticketId: string,
    sellerId: string,
    faceValueCents?: number,
  ): Promise<TransferContext> {
    const resolvedFaceValue = faceValueCents ?? (await this.getFaceValueCents(eventId));

    const [policy, historyResult, attemptsResult, statsResult, profileResult] = await Promise.all([
      this.getPolicy(eventId),
      supabase.from("ticket_holder_history").select("holder_id").eq("ticket_id", ticketId),
      supabase
        .from("ticket_transfer_attempts")
        .select("completed_at")
        .eq("ticket_id", ticketId)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false }),
      supabase.rpc("seller_transfer_stats", { p_seller_id: sellerId, p_event_id: eventId }),
      supabase.from("profiles").select("created_at, no_show_rate").eq("id", sellerId).maybeSingle(),
    ]);

    if (historyResult.error) throw historyResult.error;
    if (attemptsResult.error) throw attemptsResult.error;
    if (statsResult.error) throw statsResult.error;

    const completedTransfers = attemptsResult.data ?? [];
    const stats = (Array.isArray(statsResult.data) ? statsResult.data[0] : statsResult.data) ?? {};

    const ticket: TicketContext = {
      ticketId,
      faceValueCents: resolvedFaceValue,
      transferCount: completedTransfers.length,
      lastTransferAt: (completedTransfers[0] as any)?.completed_at ?? null,
      previousHolderIds: (historyResult.data ?? []).map((row: any) => row.holder_id),
    };

    const seller: SellerContext = {
      sellerId,
      accountAgeDays: daysSince((profileResult.data as any)?.created_at ?? null),
      priorNoShowRate: Number((profileResult.data as any)?.no_show_rate ?? 0),
      ticketsHeldForEvent: Number((stats as any).tickets_held_for_event ?? 1),
      resalesThisEvent: Number((stats as any).resales_this_event ?? 0),
      transfersLast24h: Number((stats as any).transfers_last_24h ?? 0),
    };

    return { policy, ticket, seller };
  },

  /**
   * Evaluates a transfer and records the attempt, whatever the outcome. The
   * assessment is returned so the caller can show the seller exactly which rule
   * stopped them.
   */
  async requestTransfer(
    context: TransferContext,
    request: TransferRequest,
  ): Promise<TransferAssessment> {
    const assessment = evaluateTransfer(context.policy, context.ticket, context.seller, request);

    const { error } = await supabase.from("ticket_transfer_attempts").insert({
      event_id: context.policy.eventId,
      ticket_id: context.ticket.ticketId,
      seller_id: request.sellerId,
      buyer_id: request.buyerId,
      asking_price_cents: Math.max(0, Math.round(request.askingPriceCents)),
      decision: assessment.decision,
      risk_score: assessment.riskScore,
      violations: assessment.violations.map((violation) => violation.code),
      completed_at: assessment.decision === "allow" ? new Date().toISOString() : null,
    });

    if (error) throw error;
    return assessment;
  },

  /** Moves a ticket between holders once a transfer has been cleared. */
  async recordHolderChange(
    ticketId: string,
    fromHolderId: string,
    toHolderId: string,
  ): Promise<void> {
    const now = new Date().toISOString();

    const { error: closeError } = await supabase
      .from("ticket_holder_history")
      .update({ held_until: now })
      .eq("ticket_id", ticketId)
      .eq("holder_id", fromHolderId)
      .is("held_until", null);

    if (closeError) throw closeError;

    const { error: openError } = await supabase.from("ticket_holder_history").insert({
      ticket_id: ticketId,
      holder_id: toHolderId,
      held_from: now,
    });

    if (openError) throw openError;
  },

  /** Attempts an organiser can review, newest first. */
  async listAttemptsForEvent(eventId: string, limit = 50) {
    const { data, error } = await supabase
      .from("ticket_transfer_attempts")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  },
};

function daysSince(isoTimestamp: string | null): number {
  if (!isoTimestamp) return 0;
  const then = Date.parse(isoTimestamp);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}
