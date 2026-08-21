/**
 * Dynamic Early-Bird Pricing Engine Utilities (#3003).
 * Evaluates time-based pricing rules in UTC and formats urgency messaging.
 */

export interface PriceScheduleItem {
  price: number; // Price in cents (e.g. 1000 = $10.00)
  endDate: string | null; // ISO UTC date string or null for standard price
}

export interface ActivePriceResult {
  activePrice: number; // in cents
  isEarlyBird: boolean;
  nextPrice?: number;
  endsInSeconds?: number;
  endDate?: string;
}

/**
 * Calculates the active ticket price for a given timestamp (default current UTC time).
 */
export function getActiveTicketPrice(
  schedule: PriceScheduleItem[],
  defaultPriceCents: number,
  now: Date = new Date(),
): ActivePriceResult {
  if (!schedule || schedule.length === 0) {
    return {
      activePrice: defaultPriceCents,
      isEarlyBird: false,
    };
  }

  const nowMs = now.getTime();

  for (let i = 0; i < schedule.length; i++) {
    const item = schedule[i];
    if (item.endDate) {
      const endMs = new Date(item.endDate).getTime();
      if (nowMs < endMs) {
        const nextItem = schedule[i + 1];
        const nextPrice = nextItem ? nextItem.price : defaultPriceCents;
        const endsInSeconds = Math.max(0, Math.floor((endMs - nowMs) / 1000));

        return {
          activePrice: item.price,
          isEarlyBird: true,
          nextPrice,
          endsInSeconds,
          endDate: item.endDate,
        };
      }
    } else {
      // Final standard price entry
      return {
        activePrice: item.price,
        isEarlyBird: false,
      };
    }
  }

  return {
    activePrice: defaultPriceCents,
    isEarlyBird: false,
  };
}

/**
 * Formats a human-readable urgency message for early bird price deadlines.
 */
export function formatEarlyBirdUrgency(
  schedule: PriceScheduleItem[],
  defaultPriceCents: number,
  now: Date = new Date(),
): string | null {
  const res = getActiveTicketPrice(schedule, defaultPriceCents, now);
  if (!res.isEarlyBird || !res.endsInSeconds || !res.nextPrice) {
    return null;
  }

  const currentFormatted = `$${(res.activePrice / 100).toFixed(0)}`;
  const nextFormatted = `$${(res.nextPrice / 100).toFixed(0)}`;

  const days = Math.floor(res.endsInSeconds / 86400);
  const hours = Math.floor((res.endsInSeconds % 86400) / 3600);

  if (days >= 1) {
    return `Early Bird (${currentFormatted}) ends in ${days} ${days === 1 ? "day" : "days"}! Regular price (${nextFormatted}).`;
  }
  if (hours >= 1) {
    return `Early Bird (${currentFormatted}) ends in ${hours} ${hours === 1 ? "hour" : "hours"}! Regular price (${nextFormatted}).`;
  }

  return `Early Bird (${currentFormatted}) ends soon! Regular price (${nextFormatted}).`;
}

/**
 * Returns Stripe Checkout session duration limit in seconds (15 minutes / 900s)
 * to prevent mid-checkout price locking abuse.
 */
export function getStripeCheckoutSessionDuration(): number {
  return 900; // 15 minutes in seconds
}
