import DOMPurify from "dompurify";

// Add a hook to enforce safe link attributes, preventing Reverse Tabnabbing attacks
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/**
 * Sanitizes an HTML string by stripping dangerous tags and attributes.
 * Only the explicitly allowed tags are permitted through.
 * All anchor tags will automatically include `target="_blank"` and
 * `rel="noopener noreferrer"` to prevent Reverse Tabnabbing.
 */
export function sanitizeHtml(dirtyString: string | null | undefined): string {
  if (!dirtyString) return "";

  return DOMPurify.sanitize(dirtyString, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    FORBID_TAGS: ["iframe", "script", "style", "object"],
  });
}
