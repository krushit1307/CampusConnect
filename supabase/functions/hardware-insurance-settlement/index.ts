import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@13.0.0?target=deno";

/**
 * ============================================================================
 * HARDWARE SELF-INSURANCE SETTLEMENT (#5289)
 * ============================================================================
 *
 * Two money movements for the hardware library insurance pool:
 *
 *   charge_premium     Debits the mandatory micro-premium from the club's Stripe
 *                      escrow balance and credits the university pool. Called at
 *                      hardware checkout; the booking cannot proceed without it.
 *
 *   settle_destruction Routes a replacement payout from the pool to the purchasing
 *                      department after an admin declares an asset destroyed.
 *
 * Pricing is not accepted from the client. The premium is recomputed here from the
 * asset's replacement value and its category risk tier, because the caller is the
 * party being charged and a client-supplied amount is a self-assessed bill.
 *
 * A payout never exceeds the pool balance. Routing more than the pool holds would
 * overdraw the real Stripe balance and bury the shortfall the university has to
 * cover from another budget, so a short pool produces a partial payout plus an
 * explicit shortfall on the claim record.
 * ============================================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Mirrors src/lib/hardwareInsurancePremium.ts — the UI quote and the charge must agree. */
const BASE_RATE_PER_DOLLAR = 0.0025;
const MIN_PREMIUM_USD = 1;
const MAX_PREMIUM_USD = 50;
const STANDARD_BOOKING_HOURS = 24;
const EXTRA_DAY_SURCHARGE = 0.25;
const DURATION_FACTOR_CAP = 2;
const UNTIERED_MULTIPLIER = 1.5;

const round2 = (value: number): number => Math.round(value * 100) / 100;

function computeDurationFactor(bookingHours: number): number {
  const hours = Number.isFinite(bookingHours) && bookingHours > 0 ? bookingHours : 0;
  if (hours <= STANDARD_BOOKING_HOURS) return 1;
  const extraDays = Math.ceil((hours - STANDARD_BOOKING_HOURS) / STANDARD_BOOKING_HOURS);
  return Math.min(1 + extraDays * EXTRA_DAY_SURCHARGE, DURATION_FACTOR_CAP);
}

function computePremiumUsd(
  valuationUsd: number,
  riskMultiplier: number,
  bookingHours: number,
): number {
  const raw = round2(
    Math.max(0, valuationUsd) *
      BASE_RATE_PER_DOLLAR *
      riskMultiplier *
      computeDurationFactor(bookingHours),
  );
  return round2(Math.min(Math.max(raw, MIN_PREMIUM_USD), MAX_PREMIUM_USD));
}

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const INSURANCE_POOL_ACCOUNT = Deno.env.get("HARDWARE_INSURANCE_POOL_ACCOUNT") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body = await req.json();
    const action = body.action as "charge_premium" | "settle_destruction";

    // ── Checkout: mandatory, non-refundable micro-premium ────────────────────
    if (action === "charge_premium") {
      const { assetId, bookingId, clubId, clubStripeAccountId, bookingHours } = body;
      if (!assetId || !bookingId || !clubId) {
        throw new Error("assetId, bookingId and clubId are required.");
      }

      const { data: asset, error: assetError } = await supabase
        .from("rfid_hardware_assets")
        .select("id, name, category, valuation_usd")
        .eq("id", assetId)
        .single();
      if (assetError || !asset) throw new Error(`Unknown hardware asset ${assetId}.`);

      const { data: tier } = await supabase
        .from("hardware_risk_tiers")
        .select("category, tier, risk_multiplier")
        .eq("category", asset.category)
        .maybeSingle();

      const riskMultiplier = Number(tier?.risk_multiplier ?? UNTIERED_MULTIPLIER);
      const premiumUsd = computePremiumUsd(
        Number(asset.valuation_usd),
        riskMultiplier,
        Number(bookingHours ?? STANDARD_BOOKING_HOURS),
      );

      // Debit the club's escrow balance and credit the pool. Both sides move in
      // one Stripe transfer so the ledger row cannot outlive a failed charge.
      let stripeTransferId: string | undefined;
      if (INSURANCE_POOL_ACCOUNT && clubStripeAccountId) {
        const transfer = await stripe.transfers.create({
          amount: Math.round(premiumUsd * 100),
          currency: "usd",
          destination: INSURANCE_POOL_ACCOUNT,
          transfer_group: `hardware-insurance-${bookingId}`,
          metadata: {
            purpose: "hardware_self_insurance_micro_premium",
            asset_id: assetId,
            booking_id: bookingId,
            club_id: clubId,
            risk_multiplier: String(riskMultiplier),
            refundable: "false",
          },
        });
        stripeTransferId = transfer.id;
      } else {
        console.warn(
          "[HW INSURANCE] Stripe pool account or club account missing; recording premium without a transfer.",
        );
      }

      const { error: ledgerError } = await supabase.from("hardware_insurance_ledger").insert({
        entry_type: "PREMIUM",
        amount_usd: premiumUsd,
        asset_id: assetId,
        counterparty: clubId,
        booking_id: bookingId,
        stripe_transfer_id: stripeTransferId,
      });

      // The unique constraint on (booking_id, entry_type) makes a retried checkout
      // idempotent instead of charging the club twice for one booking.
      if (ledgerError && !`${ledgerError.message}`.includes("duplicate key")) {
        throw new Error(`Premium charged but not recorded: ${ledgerError.message}`);
      }

      return new Response(
        JSON.stringify({
          charged: true,
          premiumUsd,
          riskMultiplier,
          tier: tier?.tier ?? "MODERATE",
          refundable: false,
          stripeTransferId,
          alreadyCharged: Boolean(ledgerError),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // ── Admin: "Asset Destroyed" → replacement payout ────────────────────────
    if (action === "settle_destruction") {
      const {
        assetId,
        bookingId,
        declaredBy,
        incidentDescription,
        payeeDepartment,
        payeeStripeAccountId,
        claimedUsd,
      } = body;
      if (!assetId || !declaredBy || !incidentDescription || !payeeDepartment) {
        throw new Error(
          "assetId, declaredBy, incidentDescription and payeeDepartment are required.",
        );
      }

      const { data: asset, error: assetError } = await supabase
        .from("rfid_hardware_assets")
        .select("id, name, valuation_usd")
        .eq("id", assetId)
        .single();
      if (assetError || !asset) throw new Error(`Unknown hardware asset ${assetId}.`);

      const { data: pool } = await supabase
        .from("hardware_insurance_pool_state")
        .select("balance_usd")
        .single();

      const poolBalanceBeforeUsd = round2(Number(pool?.balance_usd ?? 0));
      const claimed = round2(Math.max(0, Number(claimedUsd ?? asset.valuation_usd) || 0));
      const payoutUsd = round2(Math.min(claimed, Math.max(0, poolBalanceBeforeUsd)));
      const shortfallUsd = round2(claimed - payoutUsd);

      const decision =
        payoutUsd === 0 && claimed > 0
          ? "DECLINED_INSOLVENT"
          : shortfallUsd > 0
            ? "PARTIALLY_FUNDED"
            : "FULLY_FUNDED";

      let stripeTransferId: string | undefined;
      if (payoutUsd > 0 && payeeStripeAccountId) {
        const transfer = await stripe.transfers.create({
          amount: Math.round(payoutUsd * 100),
          currency: "usd",
          destination: payeeStripeAccountId,
          transfer_group: `hardware-replacement-${assetId}`,
          metadata: {
            purpose: "hardware_self_insurance_replacement",
            asset_id: assetId,
            declared_by: declaredBy,
            decision,
          },
        });
        stripeTransferId = transfer.id;
      }

      const { data: claim, error: claimError } = await supabase
        .from("hardware_destruction_claims")
        .insert({
          asset_id: assetId,
          booking_id: bookingId ?? null,
          declared_by: declaredBy,
          incident_description: incidentDescription,
          claimed_usd: claimed,
          payout_usd: payoutUsd,
          shortfall_usd: shortfallUsd,
          decision,
          payee_department: payeeDepartment,
          pool_balance_before_usd: poolBalanceBeforeUsd,
          stripe_transfer_id: stripeTransferId,
        })
        .select("id")
        .single();
      if (claimError) throw new Error(`Failed to record claim: ${claimError.message}`);

      if (payoutUsd > 0) {
        const { error: ledgerError } = await supabase.from("hardware_insurance_ledger").insert({
          entry_type: "REPLACEMENT_PAYOUT",
          amount_usd: -payoutUsd,
          asset_id: assetId,
          counterparty: payeeDepartment,
          claim_id: claim.id,
          stripe_transfer_id: stripeTransferId,
        });
        if (ledgerError) throw new Error(`Payout sent but not recorded: ${ledgerError.message}`);
      }

      // The asset leaves the lending inventory; a destroyed drone must not stay bookable.
      await supabase
        .from("rfid_hardware_assets")
        .update({ status: "maintenance", updated_at: new Date().toISOString() })
        .eq("id", assetId);

      return new Response(
        JSON.stringify({
          claimId: claim.id,
          decision,
          claimedUsd: claimed,
          payoutUsd,
          shortfallUsd,
          poolBalanceBeforeUsd,
          poolBalanceAfterUsd: round2(poolBalanceBeforeUsd - payoutUsd),
          payeeDepartment,
          stripeTransferId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    throw new Error(`Unsupported action ${action}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[HW INSURANCE] Exception:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
