/**
 * ticket-pdf.worker.ts
 *
 * Web Worker that generates a PDF event ticket entirely off the main thread,
 * preventing UI freezes on lower-end devices (Issue #2631).
 *
 * Input (via postMessage):
 *   {
 *     token: string;          // signed JWT — encoded into the QR code
 *     eventTitle: string;
 *     eventDate: string;      // ISO string
 *     eventEndDate?: string;  // ISO string, optional
 *     eventLocation: string;
 *     attendeeName: string;
 *     rsvpId: string;         // for the human-readable ticket ID footer
 *   }
 *
 * Output (via postMessage):
 *   { success: true; pdfBytes: Uint8Array }
 *   { success: false; error: string }
 */

import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import QRCode from "qrcode";

export interface TicketWorkerInput {
  token: string;
  eventTitle: string;
  eventDate: string;
  eventEndDate?: string;
  eventLocation: string;
  attendeeName: string;
  noMediaConsent?: boolean;
  rsvpId: string;
}

/** Format a date ISO string into a readable "Sat, 10 Aug 2026 · 3:00 PM" style. */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Wrap long text into lines that fit within maxWidth (in PDF points). */
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

self.onmessage = async (event: MessageEvent<TicketWorkerInput>) => {
  try {
    const {
      token,
      eventTitle,
      eventDate,
      eventEndDate,
      eventLocation,
      attendeeName,
      noMediaConsent,
      rsvpId,
    } = event.data;

    // ─────────────────────────────────────────────────────────────
    // 1. Generate QR code as a PNG data-URI (Error Correction: H)
    // ─────────────────────────────────────────────────────────────
    const qrDataUrl: string = await QRCode.toDataURL(token, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 300,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    // Strip the "data:image/png;base64," prefix → raw base64
    const qrBase64 = qrDataUrl.split(",")[1];
    const qrBytes = Uint8Array.from(atob(qrBase64), (c) => c.charCodeAt(0));

    // ─────────────────────────────────────────────────────────────
    // 2. Build the PDF (A4: 595 × 842 pt)
    // ─────────────────────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Colour palette (CampusConnect neo-brutalist palette)
    const black = rgb(0, 0, 0);
    const white = rgb(1, 1, 1);
    const lime = rgb(0.796, 1, 0.2); // #CBFF33
    const darkGray = rgb(0.15, 0.15, 0.15);
    const midGray = rgb(0.45, 0.45, 0.45);
    const warningRed = rgb(0.72, 0.11, 0.11);

    // ── Header bar ───────────────────────────────────────────────
    const headerH = 100;
    page.drawRectangle({
      x: 0,
      y: height - headerH,
      width,
      height: headerH,
      color: black,
    });

    // CampusConnect wordmark (left)
    page.drawText("CampusConnect", {
      x: 28,
      y: height - 44,
      size: 22,
      font: boldFont,
      color: white,
    });
    page.drawText("Event Ticket", {
      x: 28,
      y: height - 68,
      size: 11,
      font: regularFont,
      color: rgb(0.6, 0.6, 0.6),
    });

    // Lime accent block (top-right)
    page.drawRectangle({
      x: width - 110,
      y: height - headerH,
      width: 110,
      height: headerH,
      color: lime,
    });
    page.drawText("ADMIT", {
      x: width - 97,
      y: height - 48,
      size: 16,
      font: boldFont,
      color: black,
    });
    page.drawText("ONE", {
      x: width - 86,
      y: height - 68,
      size: 16,
      font: boldFont,
      color: black,
    });

    // ── Body area ────────────────────────────────────────────────
    const bodyTop = height - headerH - 28;
    const leftMargin = 28;
    const contentWidth = width - 210; // leave 185pt for QR block on right

    // Section label
    page.drawText("EVENT", {
      x: leftMargin,
      y: bodyTop,
      size: 9,
      font: boldFont,
      color: midGray,
    });

    // Event title (wraps up to 3 lines)
    const titleLines = wrapText(eventTitle, boldFont, 22, contentWidth);
    let titleY = bodyTop - 22;
    for (const line of titleLines.slice(0, 3)) {
      page.drawText(line, { x: leftMargin, y: titleY, size: 22, font: boldFont, color: darkGray });
      titleY -= 28;
    }

    // Horizontal rule
    const ruleY = titleY - 10;
    page.drawLine({
      start: { x: leftMargin, y: ruleY },
      end: { x: width - 28, y: ruleY },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });

    // Date / Time block
    const detailTop = ruleY - 22;
    page.drawText("DATE & TIME", {
      x: leftMargin,
      y: detailTop,
      size: 8,
      font: boldFont,
      color: midGray,
    });
    const dateStr = formatDate(eventDate);
    const timeStr = formatTime(eventDate);
    const endTimeStr = eventEndDate ? ` – ${formatTime(eventEndDate)}` : "";
    page.drawText(`${dateStr}`, {
      x: leftMargin,
      y: detailTop - 14,
      size: 12,
      font: boldFont,
      color: darkGray,
    });
    page.drawText(`${timeStr}${endTimeStr}`, {
      x: leftMargin,
      y: detailTop - 28,
      size: 11,
      font: regularFont,
      color: darkGray,
    });

    // Location block
    const locTop = detailTop - 52;
    page.drawText("LOCATION", {
      x: leftMargin,
      y: locTop,
      size: 8,
      font: boldFont,
      color: midGray,
    });
    const locationLines = wrapText(
      eventLocation || "To Be Announced",
      regularFont,
      11,
      contentWidth,
    );
    let locY = locTop - 14;
    for (const line of locationLines.slice(0, 2)) {
      page.drawText(line, { x: leftMargin, y: locY, size: 11, font: regularFont, color: darkGray });
      locY -= 15;
    }

    // Attendee block
    const attTop = locY - 14;
    page.drawText("ATTENDEE", {
      x: leftMargin,
      y: attTop,
      size: 8,
      font: boldFont,
      color: midGray,
    });
    const attendeeDisplayName = attendeeName || "Guest";
    const nameLines = wrapText(attendeeDisplayName, boldFont, 14, contentWidth);
    let nameY = attTop - 16;
    for (const line of nameLines.slice(0, 2)) {
      page.drawText(line, { x: leftMargin, y: nameY, size: 14, font: boldFont, color: darkGray });
      nameY -= 18;
    }

    if (noMediaConsent) {
      const warningY = nameY - 52;
      page.drawRectangle({
        x: leftMargin,
        y: warningY,
        width: contentWidth,
        height: 44,
        color: warningRed,
      });
      page.drawText("NO PHOTOGRAPHY / FILMING", {
        x: leftMargin + 10,
        y: warningY + 27,
        size: 11,
        font: boldFont,
        color: white,
      });
      page.drawText("Issue a red wristband at the door. Do not photograph or film this attendee.", {
        x: leftMargin + 10,
        y: warningY + 12,
        size: 6.5,
        font: regularFont,
        color: white,
      });
    }

    // ── QR Code block (right column) ─────────────────────────────
    const qrImage = await pdfDoc.embedPng(qrBytes);
    const qrSize = 150;
    const qrX = width - qrSize - 28;
    const qrY = height - headerH - qrSize - 50;

    // QR background card
    page.drawRectangle({
      x: qrX - 8,
      y: qrY - 8,
      width: qrSize + 16,
      height: qrSize + 40,
      color: rgb(0.97, 0.97, 0.97),
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1,
    });

    page.drawText("SCAN TO VERIFY", {
      x: qrX + 2,
      y: qrY + qrSize + 6,
      size: 7,
      font: boldFont,
      color: midGray,
    });

    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    // ── Perforated-edge divider ────────────────────────────────────
    const tearY = 130;
    // Dashed line
    let dashX = 0;
    while (dashX < width) {
      page.drawLine({
        start: { x: dashX, y: tearY },
        end: { x: Math.min(dashX + 10, width), y: tearY },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
        dashArray: [5, 5],
        dashPhase: 0,
      });
      dashX += 15;
    }
    // Scissors icon approximation using text
    page.drawText("✂", { x: 4, y: tearY - 6, size: 14, font: regularFont, color: midGray });

    // ── Ticket stub (bottom panel) ────────────────────────────────
    // Stub background (lime)
    page.drawRectangle({ x: 0, y: 0, width, height: tearY - 2, color: lime });
    // Black top border of stub
    page.drawLine({
      start: { x: 0, y: tearY - 2 },
      end: { x: width, y: tearY - 2 },
      thickness: 2,
      color: black,
    });

    // Ticket ID (human readable)
    const shortId = rsvpId.slice(0, 8).toUpperCase();
    page.drawText("TICKET ID", { x: leftMargin, y: 100, size: 8, font: boldFont, color: darkGray });
    page.drawText(shortId, { x: leftMargin, y: 82, size: 18, font: boldFont, color: black });
    page.drawText(`Full ID: ${rsvpId}`, {
      x: leftMargin,
      y: 64,
      size: 7,
      font: regularFont,
      color: darkGray,
    });

    // Event name in stub
    const stubTitleLines = wrapText(eventTitle, boldFont, 10, contentWidth);
    page.drawText(stubTitleLines[0] ?? eventTitle, {
      x: leftMargin,
      y: 42,
      size: 10,
      font: boldFont,
      color: darkGray,
    });
    page.drawText(attendeeDisplayName, {
      x: leftMargin,
      y: 26,
      size: 9,
      font: regularFont,
      color: darkGray,
    });

    // CampusConnect watermark in stub (rotated, right side)
    page.drawText("CampusConnect", {
      x: width - 30,
      y: 20,
      size: 8,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
      rotate: degrees(90),
    });

    // ── Finalise PDF ──────────────────────────────────────────────
    pdfDoc.setTitle(`${eventTitle} — Ticket`);
    pdfDoc.setAuthor("CampusConnect");
    pdfDoc.setSubject("Event Ticket");
    pdfDoc.setKeywords(["ticket", "event", "campusconnect"]);

    const pdfBytes = await pdfDoc.save();
    self.postMessage({ success: true, pdfBytes });
  } catch (error) {
    console.error("Ticket PDF worker error:", error);
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error generating ticket PDF",
    });
  }
};
