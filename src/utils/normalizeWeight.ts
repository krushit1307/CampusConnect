/**
 * Normalizes RSVP count to a weight between 0.0 and 1.0.
 * Example thresholds:
 * 10 RSVPs   -> 0.10
 * 50 RSVPs   -> 0.30
 * 100 RSVPs  -> 0.50
 * 250 RSVPs  -> 0.80
 * 500+ RSVPs -> 1.00
 */
export function normalizeWeight(rsvpCount: number): number {
  if (rsvpCount <= 0) return 0;
  if (rsvpCount >= 500) return 1.0;
  if (rsvpCount >= 250) return 0.8;
  if (rsvpCount >= 100) return 0.5;
  if (rsvpCount >= 50) return 0.3;
  if (rsvpCount >= 10) return 0.1;

  // Linear interpolation for values between 1 and 10
  return parseFloat(((rsvpCount / 10) * 0.1).toFixed(2));
}
