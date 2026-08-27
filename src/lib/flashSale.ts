export type ActiveFlashSale = {
  id: string;
  event_id: string;
  ticket_tier_id: string | null;
  discount_percent: number;
  original_price_cents: number;
  sale_price_cents: number;
  starts_at: string;
  expires_at: string;
  status: "active";
};

export type FlashSaleRealtimePayload = {
  eventId: string;
  saleId: string;
  discountPercent?: number;
  salePriceCents?: number;
  expiresAt?: string;
};

export function getRemainingSeconds(expiresAt: string, nowMs = Date.now()): number {
  const expiryMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiryMs)) return 0;
  return Math.max(0, Math.ceil((expiryMs - nowMs) / 1000));
}

export function formatFlashSaleCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
}

export function isFlashSaleRealtimePayload(value: unknown): value is FlashSaleRealtimePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.eventId === "string" && typeof payload.saleId === "string";
}
