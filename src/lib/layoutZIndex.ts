export const Z_INDEX_HIERARCHY = {
  BASE_CONTENT: "z-0",
  DROPDOWN_MENU: "z-10",
  STICKY_HEADER: "z-50",
  MODAL_OVERLAY: "z-100",
} as const;

export interface ElementLayoutOptions {
  isSticky?: boolean;
  isHeader?: boolean;
  isTooltip?: boolean;
  additionalClasses?: string;
}

/**
 * Resolves Tailwind CSS class string ensuring proper z-index stacking order across navigation and overlays.
 */
export function getLayoutZIndexCssClass(options: ElementLayoutOptions = {}): string {
  let zClass = Z_INDEX_HIERARCHY.BASE_CONTENT;

  if (options.isHeader || options.isSticky) {
    zClass = `${options.isSticky ? "sticky top-0 " : ""}${Z_INDEX_HIERARCHY.STICKY_HEADER}`;
  } else if (options.isTooltip) {
    zClass = Z_INDEX_HIERARCHY.DROPDOWN_MENU;
  }

  const combined = `${zClass} ${options.additionalClasses || ""}`.trim();
  return Array.from(new Set(combined.split(/\s+/))).join(" ");
}
