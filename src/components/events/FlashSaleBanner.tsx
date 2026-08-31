import { useEffect, useMemo, useState } from "react";
import { Flame, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  formatFlashSaleCountdown,
  getRemainingSeconds,
  isFlashSaleRealtimePayload,
  type ActiveFlashSale,
} from "@/lib/flashSale";

export function FlashSaleBanner({ eventId }: { eventId: string }) {
  const [sale, setSale] = useState<ActiveFlashSale | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let mounted = true;
    const loadSale = async () => {
      const { data, error } = await supabase
        .from("active_event_flash_sales")
        .select(
          "id, event_id, ticket_tier_id, discount_percent, original_price_cents, sale_price_cents, starts_at, expires_at, status",
        )
        .eq("event_id", eventId)
        .maybeSingle();
      if (!mounted || error) return;
      setSale(data as ActiveFlashSale | null);
    };
    void loadSale();

    const channel = supabase
      .channel(`event-flash-sale:${eventId}`)
      .on("broadcast", { event: "flash-sale" }, ({ payload }) => {
        if (!isFlashSaleRealtimePayload(payload) || payload.eventId !== eventId) return;
        setSale((previous) => ({
          id: payload.saleId,
          event_id: eventId,
          ticket_tier_id: previous?.ticket_tier_id ?? null,
          discount_percent: payload.discountPercent ?? previous?.discount_percent ?? 0,
          original_price_cents: previous?.original_price_cents ?? 0,
          sale_price_cents: payload.salePriceCents ?? previous?.sale_price_cents ?? 0,
          starts_at: new Date().toISOString(),
          expires_at: payload.expiresAt ?? previous?.expires_at ?? new Date().toISOString(),
          status: "active",
        }));
      })
      .on("broadcast", { event: "flash-sale-ended" }, ({ payload }) => {
        if (isFlashSaleRealtimePayload(payload) && payload.eventId === eventId) setSale(null);
      })
      .subscribe();

    return () => {
      mounted = false;
      void channel.unsubscribe();
    };
  }, [eventId]);

  useEffect(() => {
    if (!sale) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sale]);

  const remainingSeconds = useMemo(
    () => (sale ? getRemainingSeconds(sale.expires_at, now) : 0),
    [now, sale],
  );

  useEffect(() => {
    if (sale && remainingSeconds === 0) setSale(null);
  }, [remainingSeconds, sale]);

  if (!sale || remainingSeconds <= 0) return null;

  return (
    <div
      className="relative mb-6 overflow-hidden border-4 border-black bg-red-600 p-4 text-white shadow-[6px_6px_0_0_#000]"
      role="status"
      aria-live="polite"
    >
      <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-yellow-300/30 blur-xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Zap className="mt-1 h-8 w-8 shrink-0 animate-pulse text-yellow-200" aria-hidden="true" />
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-widest">
              Flash sale live
            </p>
            <h2 className="font-display text-2xl font-black uppercase">
              {sale.discount_percent}% off tickets
            </h2>
            {sale.original_price_cents > 0 && sale.sale_price_cents > 0 && (
              <p className="font-mono text-sm font-bold">
                Now ${(sale.sale_price_cents / 100).toFixed(2)} USD{" "}
                <span className="ml-2 text-white/70 line-through">
                  ${(sale.original_price_cents / 100).toFixed(2)}
                </span>
              </p>
            )}
          </div>
        </div>
        <div
          className="border-2 border-white bg-black px-4 py-2 text-center font-mono"
          aria-label={`${formatFlashSaleCountdown(remainingSeconds)} remaining`}
        >
          <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-yellow-200">
            <Flame className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" /> Ends in
          </div>
          <div className="text-3xl font-black tabular-nums">
            {formatFlashSaleCountdown(remainingSeconds)}
          </div>
        </div>
      </div>
    </div>
  );
}
