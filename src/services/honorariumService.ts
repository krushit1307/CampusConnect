import { supabase } from "@/lib/supabase";
import {
  buildYearEndPack,
  evaluatePayment,
  type HonorariumPayee,
  type HonorariumPayment,
  type PaymentEvaluation,
  type PaymentStatus,
  type ResidencyStatus,
  type TaxFormType,
  type YearEndPack,
} from "@/lib/honorariumCompliance";

export interface LedgerRow {
  payment: HonorariumPayment;
  payee: HonorariumPayee;
  evaluation: PaymentEvaluation;
  eventTitle: string | null;
}

export interface ClubLedger {
  rows: LedgerRow[];
  pack: YearEndPack;
}

export interface NewPayeeInput {
  fullName: string;
  email?: string;
  residency: ResidencyStatus;
  formType: TaxFormType;
  formSignedOn: string | null;
  treatyRatePercent?: number;
}

export interface NewPaymentInput {
  payeeId: string;
  clubId: string;
  eventId?: string | null;
  grossCents: number;
  engagementDate: string;
  memo?: string;
}

function toPayee(row: any): HonorariumPayee {
  return {
    id: row.id,
    fullName: row.full_name,
    residency: row.residency,
    formType: row.form_type,
    formSignedOn: row.form_signed_on,
    treatyRatePercent:
      row.treaty_rate_percent === null || row.treaty_rate_percent === undefined
        ? undefined
        : Number(row.treaty_rate_percent),
  };
}

function toPayment(row: any): HonorariumPayment {
  return {
    id: row.id,
    payeeId: row.payee_id,
    clubId: row.club_id,
    grossCents: Number(row.gross_cents),
    engagementDate: row.engagement_date,
    status: row.status as PaymentStatus,
  };
}

export const honorariumService = {
  /**
   * Ledger for one club and tax year.
   *
   * The year-end pack is deliberately built from every payment made to the
   * club's payees, not just this club's, because the reporting threshold is a
   * per-payee figure that spans clubs.
   */
  async getClubLedger(clubId: string, taxYear: number): Promise<ClubLedger> {
    const { data: paymentRows, error: paymentError } = await supabase
      .from("honorarium_payments")
      .select("*, honorarium_payees(*), events(title)")
      .eq("club_id", clubId)
      .gte("engagement_date", `${taxYear}-01-01`)
      .lte("engagement_date", `${taxYear}-12-31`)
      .order("engagement_date", { ascending: false });

    if (paymentError) throw paymentError;

    const payees = new Map<string, HonorariumPayee>();
    const rows: LedgerRow[] = [];

    for (const row of paymentRows ?? []) {
      const payee = toPayee((row as any).honorarium_payees);
      const payment = toPayment(row);
      payees.set(payee.id, payee);

      rows.push({
        payment,
        payee,
        evaluation: evaluatePayment(payee, payment),
        eventTitle: (row as any).events?.title ?? null,
      });
    }

    const payeeIds = [...payees.keys()];
    const allPayments =
      payeeIds.length > 0 ? await this.getPaymentsForPayees(payeeIds, taxYear) : [];
    const pack = buildYearEndPack([...payees.values()], allPayments, taxYear);

    return { rows, pack };
  },

  /** Every payment made to the given payees in a tax year, across all clubs. */
  async getPaymentsForPayees(payeeIds: string[], taxYear: number): Promise<HonorariumPayment[]> {
    if (payeeIds.length === 0) return [];

    const { data, error } = await supabase
      .from("honorarium_payments")
      .select("id, payee_id, club_id, gross_cents, engagement_date, status")
      .in("payee_id", payeeIds)
      .gte("engagement_date", `${taxYear}-01-01`)
      .lte("engagement_date", `${taxYear}-12-31`);

    if (error) throw error;
    return (data ?? []).map(toPayment);
  },

  /** Registers a speaker as a payee along with whatever paperwork they returned. */
  async createPayee(input: NewPayeeInput): Promise<string> {
    const { data: session } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("honorarium_payees")
      .insert({
        full_name: input.fullName,
        email: input.email ?? null,
        residency: input.residency,
        form_type: input.formType,
        form_signed_on: input.formSignedOn,
        treaty_rate_percent: input.treatyRatePercent ?? null,
        created_by: session?.user?.id ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;
    return (data as { id: string }).id;
  },

  /** Records the paperwork a payee has since returned. */
  async updatePayeeForm(
    payeeId: string,
    formType: TaxFormType,
    formSignedOn: string | null,
  ): Promise<void> {
    const { error } = await supabase
      .from("honorarium_payees")
      .update({ form_type: formType, form_signed_on: formSignedOn })
      .eq("id", payeeId);

    if (error) throw error;
  },

  /** Books an honorarium against a club and, optionally, an event. */
  async createPayment(input: NewPaymentInput): Promise<void> {
    const { error } = await supabase.from("honorarium_payments").insert({
      payee_id: input.payeeId,
      club_id: input.clubId,
      event_id: input.eventId ?? null,
      gross_cents: input.grossCents,
      engagement_date: input.engagementDate,
      memo: input.memo ?? null,
      status: "draft",
    });

    if (error) throw error;
  },

  /**
   * Releases a payment, freezing the withholding that applied at that moment.
   * The compliance check runs again here so a payment cannot be released just
   * because the dashboard was stale.
   */
  async releasePayment(payment: HonorariumPayment, payee: HonorariumPayee): Promise<void> {
    const evaluation = evaluatePayment(payee, payment);
    if (!evaluation.releasable) {
      throw new Error(evaluation.explanation);
    }

    const { data: session } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("honorarium_payments")
      .update({
        status: "paid",
        withheld_cents: evaluation.withholdingCents,
        released_at: new Date().toISOString(),
        released_by: session?.user?.id ?? null,
      })
      .eq("id", payment.id);

    if (error) throw error;
  },

  /** Cancels a payment without deleting it, so the ledger stays auditable. */
  async cancelPayment(paymentId: string): Promise<void> {
    const { error } = await supabase
      .from("honorarium_payments")
      .update({ status: "cancelled" })
      .eq("id", paymentId);

    if (error) throw error;
  },
};
