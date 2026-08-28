import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { corsHeaders } from "../_shared/validation.ts";

const SUPPORTED_CURRENCIES = new Set([
  "EUR",
  "INR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
  "CHF",
  "SGD",
  "AED",
  "NZD",
  "HKD",
  "KRW",
  "BRL",
  "ZAR",
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const currency = new URL(req.url).searchParams.get("currency")?.toUpperCase();
    if (!currency || currency === "USD") {
      return json({
        base_currency: "USD",
        quote_currency: "USD",
        rate: 1,
        rate_date: null,
        cached: true,
      });
    }
    if (!SUPPORTED_CURRENCIES.has(currency)) {
      return json({ error: "Unsupported currency" }, 400);
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: cached, error: cacheError } = await supabase
      .from("currency_exchange_rates")
      .select("rate, rate_date, cache_date, provider")
      .eq("base_currency", "USD")
      .eq("quote_currency", currency)
      .eq("cache_date", today)
      .maybeSingle();

    if (cacheError) throw cacheError;
    if (cached) {
      return json({
        base_currency: "USD",
        quote_currency: currency,
        rate: Number(cached.rate),
        rate_date: cached.rate_date,
        provider: cached.provider,
        cached: true,
        stale: false,
      });
    }

    try {
      const response = await fetch(`https://api.frankfurter.dev/v2/rate/USD/${currency}`);
      if (!response.ok) throw new Error(`Frankfurter returned ${response.status}`);
      const payload = (await response.json()) as { rate?: number; date?: string };
      if (!payload.rate || !Number.isFinite(payload.rate) || payload.rate <= 0) {
        throw new Error("Frankfurter returned an invalid rate");
      }

      const rateDate = payload.date || today;
      const { error: upsertError } = await supabase.from("currency_exchange_rates").upsert(
        {
          base_currency: "USD",
          quote_currency: currency,
          rate: payload.rate,
          rate_date: rateDate,
          cache_date: today,
          provider: "frankfurter",
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "base_currency,quote_currency,cache_date" },
      );
      if (upsertError) throw upsertError;

      return json({
        base_currency: "USD",
        quote_currency: currency,
        rate: payload.rate,
        rate_date: rateDate,
        provider: "frankfurter",
        cached: false,
        stale: false,
      });
    } catch (providerError) {
      console.warn("[currency-rate] Provider unavailable:", providerError);
      const { data: stale } = await supabase
        .from("currency_exchange_rates")
        .select("rate, rate_date, cache_date, provider")
        .eq("base_currency", "USD")
        .eq("quote_currency", currency)
        .order("cache_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (stale) {
        return json({
          base_currency: "USD",
          quote_currency: currency,
          rate: Number(stale.rate),
          rate_date: stale.rate_date,
          provider: stale.provider,
          cached: true,
          stale: true,
        });
      }
      return json({ error: "Exchange rate temporarily unavailable" }, 503);
    }
  } catch (error: unknown) {
    console.error("[currency-rate] Error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
