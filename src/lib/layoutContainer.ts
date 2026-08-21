export interface LayoutContainerOptions {
  maxWidthClass?: string;
  paddingClass?: string;
  additionalClasses?: string;
}

export const DEFAULT_CONTAINER_CLASSES = "max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8";

/**
 * Resolves Tailwind CSS class string for the global page container wrapper on ultra-wide screens.
 */
export function getMainContainerCssClass(options: LayoutContainerOptions = {}): string {
  const maxWidth = options.maxWidthClass || "max-w-7xl";
  const padding = options.paddingClass || "px-4 sm:px-6 lg:px-8";
  const base = `${maxWidth} mx-auto w-full ${padding}`;

  const combined = `${base} ${options.additionalClasses || ""}`.trim();
  return Array.from(new Set(combined.split(/\s+/))).join(" ");
}
