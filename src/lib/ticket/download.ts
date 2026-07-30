import type { TicketPdfInput } from "./types";
import { buildTicketDocDefinition } from "./layout";

/**
 * Dynamically import pdfmake + standard fonts and trigger a browser
 * download of the ticket PDF. Returns when the download has been
 * initiated.
 *
 * Issue #1913 spec step 5: pdfmake is heavy (~1MB minified). We use a
 * dynamic import() so the cost is only paid when the user actually
 * clicks the download button — the main JS bundle stays slim.
 *
 * Why we re-build the document definition every time: pdfmake mutates
 * internal state once a document has been rendered, so a cached
 * TDocumentDefinitions can produce a corrupt PDF on the second call.
 * Re-building is cheap (pure data) and avoids that footgun.
 */
export async function downloadTicketPDF(input: TicketPdfInput): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("downloadTicketPDF can only run in the browser");
  }

  const [{ default: pdfMake }, fontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);

  // pdfmake's published types expose vfs as either a property of the
  // default export or via the legacy `pdfMake.vfs` assignment. We
  // support both shapes defensively because @types/pdfmake has lagged
  // the runtime API across versions.
  const vfs =
    (fontsModule as { default?: { vfs?: unknown }; pdfMakeVfs?: unknown }).default?.vfs ??
    (fontsModule as { default?: { pdfMakeVfs?: unknown } }).default?.pdfMakeVfs ??
    (fontsModule as { pdfMakeVfs?: unknown }).pdfMakeVfs ??
    (pdfMake as unknown as { vfs?: unknown }).vfs;

  if (vfs && typeof vfs === "object") {
    (pdfMake as unknown as { vfs: unknown }).vfs = vfs;
  }

  const filename = buildTicketFilename(input);
  const docDefinition = buildTicketDocDefinition(input);
  pdfMake.createPdf(docDefinition).download(filename);
}

/**
 * Build the filename the user sees in their downloads folder.
 *
 * Slugifies the event title, prefixes with the ticket id, and always
 * ends with .pdf. Example:
 *   "Campus Hackathon 2026" + "AB12CD" -> "ticket-AB12CD-campus-hackathon-2026.pdf"
 *
 * Falls back to "ticket-<id>.pdf" if the title is empty or only
 * punctuation.
 */
export function buildTicketFilename(input: TicketPdfInput): string {
  const slug = (input.event.title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const base = slug ? `ticket-${input.ticketId}-${slug}.pdf` : `ticket-${input.ticketId}.pdf`;
  return base;
}
