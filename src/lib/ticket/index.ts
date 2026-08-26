/**
 * Public surface of the ticket module (issue #1913).
 *
 * Re-exports the helpers a consumer of the module needs without
 * exposing the internal layout / format helpers directly. This keeps
 * the module's API stable when we add new renderers (HTML preview,
 * email attachment, etc.) later.
 */

export type { TicketEventData, TicketUserData, TicketPdfInput } from "./types";
export { downloadTicketPDF, buildTicketFilename } from "./download";
export { DownloadTicketButton } from "./DownloadTicketButton";
