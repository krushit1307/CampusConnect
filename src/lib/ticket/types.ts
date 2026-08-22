/**
 * Shared types for the PDF ticket generator (issue #1913).
 *
 * Kept in its own module so the layout helper, the download helper, and
 * any future renderers can all import from a single source of truth.
 */

/** Minimal event shape the ticket needs to render. */
export interface TicketEventData {
  title: string;
  /** ISO timestamp of when the event starts. */
  startDate?: string | null;
  /** ISO timestamp of when the event ends. */
  endDate?: string | null;
  /** Venue / address. */
  location?: string | null;
  /** Host club's display name. */
  clubName?: string | null;
  /** Public URL for the event detail page (printed as a QR code below). */
  eventUrl?: string | null;
}

/** Minimal attendee shape the ticket needs to render. */
export interface TicketUserData {
  fullName?: string | null;
  /** Email or handle — used as a fallback if no fullName is set. */
  email?: string | null;
}

/** Top-level input to generateTicketPDF / downloadTicketPDF. */
export interface TicketPdfInput {
  event: TicketEventData;
  attendee: TicketUserData;
  /** The 6-character ticket id printed in the header. */
  ticketId: string;
  /**
   * Base64 data URL of the QR code image to embed in the ticket.
   * Caller is responsible for generating it (e.g. via qrcode.react
   * -> toDataURL() or a server endpoint).
   */
  qrCodeDataUrl?: string | null;
  /** Whether the attendee declined event photography or filming. */
  noMediaConsent?: boolean;
}
