import { supabase } from "@/lib/supabase";
import {
  nextDunningStep,
  outstandingCents,
  periodBoundsFor,
  prorateAmount,
  standingFor,
  summariseCollections,
  toIsoDate,
  type CollectionSummary,
  type DuesInvoice,
  type DuesPlan,
  type DunningStep,
  type MemberStanding,
} from "@/lib/duesDunning";

export interface DuesRosterEntry {
  invoice: DuesInvoice;
  memberName: string;
  standing: MemberStanding;
  outstandingCents: number;
  dueStep: DunningStep | null;
}

export interface ClubDuesView {
  plan: DuesPlan | null;
  roster: DuesRosterEntry[];
  summary: CollectionSummary | null;
}

function toPlan(row: any): DuesPlan {
  return {
    id: row.id,
    clubId: row.club_id,
    amountCents: Number(row.amount_cents),
    billingPeriod: row.billing_period,
    cycleAnchor: row.cycle_anchor,
    graceDays: Number(row.grace_days),
    suspendAfterDays: Number(row.suspend_after_days),
    proration: row.proration,
    dunningSteps: Array.isArray(row.dunning_steps) ? (row.dunning_steps as DunningStep[]) : [],
  };
}

function toInvoice(row: any): DuesInvoice {
  return {
    id: row.id,
    memberId: row.member_id,
    planId: row.plan_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    dueDate: row.due_date,
    amountDueCents: Number(row.amount_due_cents),
    amountPaidCents: Number(row.amount_paid_cents),
    status: row.status,
    sentStepKeys: row.sent_step_keys ?? [],
  };
}

/** Today as an ISO calendar date, which is what the dues rules work in. */
function today(): string {
  return toIsoDate(new Date());
}

export const duesService = {
  /** The club's active dues plan, or null when the club does not charge dues. */
  async getActivePlan(clubId: string): Promise<DuesPlan | null> {
    const { data, error } = await supabase
      .from("club_dues_plans")
      .select("*")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    return data ? toPlan(data) : null;
  },

  /**
   * Roster for the treasurer: every member's invoice for the current period,
   * their standing and the reminder that is due next.
   */
  async getClubDuesView(clubId: string, asOf: string = today()): Promise<ClubDuesView> {
    const plan = await this.getActivePlan(clubId);
    if (!plan) return { plan: null, roster: [], summary: null };

    const { periodStart } = periodBoundsFor(plan, asOf);

    const { data, error } = await supabase
      .from("club_dues_invoices")
      .select("*, profiles!club_dues_invoices_member_id_fkey(full_name)")
      .eq("club_id", clubId)
      .eq("period_start", periodStart)
      .order("due_date", { ascending: true });

    if (error) throw error;

    const roster: DuesRosterEntry[] = (data ?? []).map((row: any) => {
      const invoice = toInvoice(row);
      return {
        invoice,
        memberName: row.profiles?.full_name ?? "Unnamed member",
        standing: standingFor(plan, invoice, asOf),
        outstandingCents: outstandingCents(invoice),
        dueStep: nextDunningStep(plan, invoice, asOf),
      };
    });

    return {
      plan,
      roster,
      summary: summariseCollections(
        plan,
        roster.map((entry) => entry.invoice),
        asOf,
      ),
    };
  },

  /**
   * Issues invoices for the current period to members who do not have one yet.
   * The amount is prorated from the member's join date, so a member who joined
   * in April is not billed for January.
   */
  async issueInvoicesForPeriod(
    clubId: string,
    asOf: string = today(),
  ): Promise<{ issued: number; skipped: number }> {
    const plan = await this.getActivePlan(clubId);
    if (!plan) throw new Error("This club does not have an active dues plan.");

    const { periodStart, periodEnd } = periodBoundsFor(plan, asOf);

    const [membersResult, existingResult] = await Promise.all([
      supabase
        .from("club_members")
        .select("user_id, joined_at")
        .eq("club_id", clubId)
        .eq("status", "approved"),
      supabase
        .from("club_dues_invoices")
        .select("member_id")
        .eq("plan_id", plan.id)
        .eq("period_start", periodStart),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (existingResult.error) throw existingResult.error;

    const alreadyInvoiced = new Set((existingResult.data ?? []).map((row: any) => row.member_id));
    const rows = (membersResult.data ?? [])
      .filter((member: any) => !alreadyInvoiced.has(member.user_id))
      .map((member: any) => {
        const joinDate = (member.joined_at ?? periodStart).slice(0, 10);
        return {
          plan_id: plan.id,
          club_id: clubId,
          member_id: member.user_id,
          period_start: periodStart,
          period_end: periodEnd,
          due_date: periodStart,
          amount_due_cents: prorateAmount(plan, joinDate, periodStart, periodEnd),
        };
      });

    if (rows.length === 0) {
      return { issued: 0, skipped: alreadyInvoiced.size };
    }

    const { error } = await supabase.from("club_dues_invoices").insert(rows);
    if (error) throw error;

    return { issued: rows.length, skipped: alreadyInvoiced.size };
  },

  /** Records a payment. The database rolls it up onto the invoice. */
  async recordPayment(invoiceId: string, amountCents: number, method?: string): Promise<void> {
    if (amountCents <= 0) throw new Error("A payment has to be greater than zero.");

    const { data: session } = await supabase.auth.getUser();
    const { error } = await supabase.from("club_dues_payments").insert({
      invoice_id: invoiceId,
      amount_cents: Math.round(amountCents),
      method: method ?? null,
      recorded_by: session?.user?.id ?? null,
    });

    if (error) throw error;
  },

  /** Waives an invoice, which takes the member out of dunning entirely. */
  async waiveInvoice(invoiceId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from("club_dues_invoices")
      .update({ status: "waived", waived_reason: reason, updated_at: new Date().toISOString() })
      .eq("id", invoiceId);

    if (error) throw error;
  },

  /**
   * Marks a dunning step as sent. Returns false when the step had already been
   * recorded, which is how a retried reminder job avoids chasing twice.
   */
  async markDunningStepSent(invoiceId: string, stepKey: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("record_dunning_step", {
      p_invoice_id: invoiceId,
      p_step_key: stepKey,
    });

    if (error) throw error;
    return Boolean(data);
  },
};
