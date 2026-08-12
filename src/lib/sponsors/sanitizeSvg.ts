// =============================================================================
// Utility: SVG Sanitizer
// Issue: #2808 - Implement 'Sponsorship' Tiers and Dynamic Banners for Events
// Description: Strips potentially malicious elements from SVG files to prevent
// XSS attacks when rendering user - uploaded sponsor logos.Removes < script > tags,
// on * event handlers, and javascript: URIs.
// =============================================================================

/**
 * Sanitizes an SVG string by removing dangerous elements and attributes.
 *
 * @param svgString - The raw SVG markup
 * @returns The sanitized SVG string safe for rendering
 */
export function sanitizeSvgString(svgString: string): string {
  // Parse the SVG string into a DOM document
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");

  // Check for parsing errors
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid SVG markup");
  }

  // 1. Remove all <script> tags
  const scripts = doc.getElementsByTagName("script");
  while (scripts.length > 0) {
    scripts[0].parentNode?.removeChild(scripts[0]);
  }

  // 2. Remove all <iframe>, <object>, <embed>, <video>, <audio> tags
  const dangerousTags = ["iframe", "object", "embed", "video", "audio", "foreignObject"];
  dangerousTags.forEach((tag) => {
    const elements = doc.getElementsByTagName(tag);
    while (elements.length > 0) {
      elements[0].parentNode?.removeChild(elements[0]);
    }
  });

  // 3. Remove all on* event handler attributes (onclick, onload, onmouseover, etc.)
  const allElements = doc.getElementsByTagName("*");
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    const attributes = el.attributes;

    // Iterate backwards to safely remove attributes while iterating
    for (let j = attributes.length - 1; j >= 0; j--) {
      const attr = attributes[j];

      // Remove any attribute starting with 'on'
      if (attr.name.toLowerCase().startsWith("on")) {
        el.removeAttribute(attr.name);
      }

      // Remove javascript: URIs from href/xlink:href attributes
      if (attr.name === "href" || attr.name === "xlink:href") {
        if (attr.value.toLowerCase().trim().startsWith("javascript:")) {
          el.removeAttribute(attr.name);
        }
      }

      // Remove data: URIs that might contain scripts (less common in SVG but possible)
      if (attr.name === "href" || attr.name === "xlink:href") {
        if (attr.value.toLowerCase().trim().startsWith("data:text/html")) {
          el.removeAttribute(attr.name);
        }
      }
    }

    // 4. Remove <style> tags that might contain malicious CSS (e.g., behavior: url())
    // We allow <style> but strip dangerous properties if needed. For simplicity,
    // we'll remove <style> tags entirely to be safe, as sponsor logos shouldn't need them.
    if (el.tagName.toLowerCase() === "style") {
      el.parentNode?.removeChild(el);
    }
  }

  // 5. Ensure the root element is actually an SVG
  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== "svg") {
    throw new Error("Root element is not an SVG");
  }

  // 6. Add necessary xmlns if missing (helps with rendering in some browsers)
  if (!root.getAttribute("xmlns")) {
    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  // Serialize back to string
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

/**
 * Validates if a file is a safe SVG before processing.
 */
export async function validateSvgFile(file: File): Promise<boolean> {
  if (file.type !== "image/svg+xml") {
    return false;
  }

  try {
    const text = await file.text();
    sanitizeSvgString(text); // Will throw if invalid or dangerous
    return true;
  } catch {
    return false;
  }
}
