export interface NavLinkStyleOptions {
  isActive?: boolean;
  customHoverColorClass?: string;
  additionalClasses?: string;
}

export const BASE_NAV_LINK_CLASSES =
  "text-gray-700 font-medium transition-colors duration-150 ease-in-out";
export const DEFAULT_HOVER_CLASS = "hover:text-blue-600";
export const ACTIVE_NAV_LINK_CLASS = "text-blue-600 font-semibold";

/**
 * Resolves Tailwind CSS class string for main navbar links including brand hover state.
 */
export function getNavLinkCssClass(options: NavLinkStyleOptions = {}): string {
  const hoverClass = options.customHoverColorClass || DEFAULT_HOVER_CLASS;
  const stateClass = options.isActive ? ACTIVE_NAV_LINK_CLASS : BASE_NAV_LINK_CLASSES;

  const combined = `${stateClass} ${hoverClass} ${options.additionalClasses || ""}`.trim();
  return Array.from(new Set(combined.split(/\s+/))).join(" ");
}
