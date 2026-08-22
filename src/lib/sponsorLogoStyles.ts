export interface SponsorLogoStyleOptions {
  customScaleClass?: string;
  additionalClasses?: string;
}

export const DEFAULT_SPONSOR_HOVER_CLASSES =
  "transition-transform duration-200 ease-in-out hover:scale-105 transform-gpu";

/**
 * Resolves Tailwind CSS class string for sponsor logos ensuring smooth hover scaling without flexbox clipping.
 */
export function getSponsorLogoCssClass(options: SponsorLogoStyleOptions = {}): string {
  const hoverClass = options.customScaleClass || DEFAULT_SPONSOR_HOVER_CLASSES;
  const baseClasses = "inline-block object-contain cursor-pointer max-h-12 w-auto";

  const combined = `${baseClasses} ${hoverClass} ${options.additionalClasses || ""}`.trim();
  return Array.from(new Set(combined.split(/\s+/))).join(" ");
}
