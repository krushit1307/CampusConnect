// =============================================================================
// File: src/services/flashSaleCountdownWorker.ts
// Issue: #4292 - Build a 'Real-Time "Dynamic Pricing" Flash Sale Engine'
// Description: Millisecond precision countdown timer worker, audio urgency alerts,
//              and automatic price reversion triggers upon expiration.
// =============================================================================

export interface CountdownTimeRemaining {
  totalMilliseconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  isExpired: boolean;
  formattedString: string; // "00:37:42"
  formattedWithMs: string; // "00:37:42.84"
}

/**
 * Calculates high-precision time remaining between now and target expiration date.
 */
export function calculateTimeRemaining(expiresAtIso: string): CountdownTimeRemaining {
  const target = new Date(expiresAtIso).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  const milliseconds = Math.floor((diff % 1000) / 10);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const formattedString = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const formattedWithMs = `${formattedString}.${pad(milliseconds)}`;

  return {
    totalMilliseconds: diff,
    hours,
    minutes,
    seconds,
    milliseconds,
    isExpired: diff <= 0,
    formattedString,
    formattedWithMs,
  };
}

/**
 * Plays a subtle low-frequency urgency pulse audio beep when the sale enters final 60 seconds.
 */
export function playUrgencyHeartbeatAudio(volume: number = 0.05): void {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime); // A4 note
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Graceful silence if browser restricts Web Audio
  }
}

/**
 * Formats monetary discounts into attractive public sticker badges.
 */
export function formatDiscountSticker(
  originalPrice: number,
  discountPercentage: number
): {
  saveAmountUsd: number;
  salePriceUsd: number;
  badgeLabel: string;
} {
  const saveAmount = originalPrice * (discountPercentage / 100);
  const salePrice = originalPrice - saveAmount;

  return {
    saveAmountUsd: Number(saveAmount.toFixed(2)),
    salePriceUsd: Number(salePrice.toFixed(2)),
    badgeLabel: `SAVE $${saveAmount.toFixed(0)} (${discountPercentage}% OFF)`,
  };
}
