import type { TDocumentDefinitions } from "pdfmake/interfaces";
import type { TicketPdfInput } from "./types";
import { formatTicketDate, formatTicketDateRange } from "./format";

/**
 * Build the pdfmake document definition for an event ticket
 * (issue #1913). Pure function: no side effects, no dynamic imports.
 *
 * The shape follows pdfmake's TDocumentDefinitions contract. We use the
 * standard Helvetica family so we don't have to ship a custom font VFS
 * (issue's Font Loading edge case).
 *
 * Layout:
 *   - Top band: CampusConnect brand + ticket id
 *   - Title block: event title (large), club name (small)
 *   - When / Where: formatted date range + venue
 *   - Attendee row: name + email
 *   - QR code (right side, ~120px square)
 *   - Footer: small print with the event URL if provided
 */
export function buildTicketDocDefinition(input: TicketPdfInput): TDocumentDefinitions {
  const { event, attendee, ticketId, qrCodeDataUrl } = input;

  const attendeeName = attendee.fullName?.trim() || attendee.email?.trim() || "Guest";

  const when = formatTicketDateRange(event.startDate, event.endDate);
  const singleDate = formatTicketDate(event.startDate);

  return {
    pageSize: "LETTER",
    pageMargins: [40, 40, 40, 60],
    defaultStyle: {
      font: "Helvetica",
      fontSize: 11,
      color: "#0a0a0f",
    },
    content: [
      // Brand band
      {
        canvas: [
          {
            type: "rect",
            x: 0,
            y: 0,
            w: 532,
            h: 36,
            color: "#0a0a0f",
          },
        ],
      },
      {
        text: "CampusConnect Ticket",
        absolutePosition: { x: 40, y: 12 },
        fontSize: 12,
        bold: true,
        color: "#f5c66b",
        characterSpacing: 2,
      },
      {
        text: `#${ticketId}`,
        absolutePosition: { x: 470, y: 12 },
        fontSize: 12,
        bold: true,
        color: "#ffffff",
      },

      // Title block
      {
        text: event.title,
        style: "title",
        margin: [0, 30, 0, 4],
      },
      event.clubName
        ? {
            text: event.clubName,
            style: "subtitle",
            margin: [0, 0, 0, 18],
          }
        : { text: "", margin: [0, 0, 0, 18] as [number, number, number, number] },

      // When / Where
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "WHEN", style: "label" },
              {
                text: when === "TBA" ? singleDate : when,
                style: "value",
                margin: [0, 2, 0, 12],
              },
              { text: "WHERE", style: "label" },
              {
                text: event.location?.trim() || "TBA",
                style: "value",
              },
            ],
          },
          qrCodeDataUrl
            ? {
                width: 130,
                stack: [
                  { text: "SCAN TO VERIFY", style: "label", alignment: "center" },
                  {
                    image: qrCodeDataUrl,
                    width: 120,
                    height: 120,
                    margin: [5, 4, 0, 0],
                    alignment: "center",
                  },
                ],
              }
            : { width: 0, text: "" },
        ],
        margin: [0, 8, 0, 16],
      },

      // Attendee
      { text: "ATTENDEE", style: "label" },
      {
        text: attendeeName,
        style: "value",
        margin: [0, 2, 0, 4],
      },
      attendee.email
        ? {
            text: attendee.email,
            fontSize: 9,
            color: "#666666",
          }
        : { text: "" },

      // Footer divider
      {
        margin: [0, 24, 0, 0] as [number, number, number, number],
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 532,
            y2: 0,
            lineWidth: 0.5,
            lineColor: "#cccccc",
          },
        ],
      },
      {
        text: "Present this ticket at the door for check-in. Keep it safe — the QR code is your proof of registration.",
        fontSize: 8,
        color: "#888888",
        margin: [0, 6, 0, 0],
      },
      event.eventUrl
        ? {
            text: event.eventUrl,
            fontSize: 7,
            color: "#aaaaaa",
            margin: [0, 2, 0, 0],
          }
        : { text: "" },
    ],
    styles: {
      title: {
        fontSize: 22,
        bold: true,
        color: "#0a0a0f",
      },
      subtitle: {
        fontSize: 12,
        color: "#444444",
        italics: true,
      },
      label: {
        fontSize: 9,
        bold: true,
        color: "#0a0a0f",
        characterSpacing: 1.5,
      },
      value: {
        fontSize: 13,
        bold: true,
        color: "#0a0a0f",
      },
    },
  };
}
