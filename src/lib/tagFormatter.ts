/**
 * Capitalizes the first letter of each word in a tag string for display on UI badges and pills.
 */
export function formatEventTagLabel(tag: string): string {
  if (!tag || tag.trim().length === 0) return "";

  return tag
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Returns Tailwind CSS class string ensuring proper text-transform capitalization for tag elements.
 */
export function getEventTagCssClass(additionalClasses = ""): string {
  const baseClasses = "capitalize inline-block px-2.5 py-0.5 rounded-full text-xs font-medium";
  return additionalClasses ? `${baseClasses} ${additionalClasses}`.trim() : baseClasses;
}
