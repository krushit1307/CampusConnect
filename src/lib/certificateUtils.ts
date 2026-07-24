/**
 * Certificate Download & Document Stream Utilities
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface DownloadCertOptions {
  certificateUrl?: string;
  eventTitle?: string;
  studentName?: string;
  issuedAt?: string | null;
  certId: string;
}

/**
 * Formats a clean download filename for the certificate PDF.
 */
export function formatCertificateFilename(eventTitle?: string): string {
  const safeTitle = (eventTitle || "campusconnect")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeTitle || "campusconnect"}-certificate.pdf`;
}

/**
 * Generates a client-side fallback PDF blob using pdf-lib when storage PDF fetch fails.
 */
export async function generateFallbackCertificatePdf(options: {
  eventTitle?: string;
  studentName?: string;
  issuedAt?: string | null;
  certId: string;
}): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const drawCenteredScaledText = (
    text: string,
    y: number,
    font: PDFFont,
    defaultSize: number,
    color = rgb(0, 0, 0),
  ) => {
    const maxWidth = 500;
    let size = defaultSize;
    let textWidth = font.widthOfTextAtSize(text, size);

    if (textWidth > maxWidth) {
      size = Math.max(10, (maxWidth / textWidth) * size);
      textWidth = font.widthOfTextAtSize(text, size);
    }

    const x = (page.getWidth() - textWidth) / 2;
    page.drawText(text, { x, y, size, font, color });
  };

  drawCenteredScaledText("Certificate of Attendance", 320, fontBold, 26, rgb(0, 0, 0));
  drawCenteredScaledText("This certifies that", 270, fontNormal, 14);

  const nameText = options.studentName || "Distinguished Student";
  drawCenteredScaledText(nameText, 230, fontBold, 22);

  drawCenteredScaledText("has successfully participated in", 190, fontNormal, 14);

  const titleText = options.eventTitle || "CampusConnect Event";
  drawCenteredScaledText(titleText, 150, fontBold, 18);

  const dateStr = options.issuedAt
    ? new Date(options.issuedAt).toLocaleDateString()
    : new Date().toLocaleDateString();

  page.drawText(`Issued Date: ${dateStr}`, { x: 210, y: 90, size: 12, font: fontNormal });
  page.drawText(`Certificate ID: ${options.certId}`, {
    x: 140,
    y: 60,
    size: 10,
    font: fontNormal,
    color: rgb(0.4, 0.4, 0.4),
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

/**
 * Main certificate PDF download trigger that fetches PDF document blobs
 * and initiates browser stream download.
 */
export async function downloadCertificatePdf(options: DownloadCertOptions): Promise<void> {
  let blob: Blob | null = null;

  // 1. Try fetching PDF blob from certificate storage URL
  if (options.certificateUrl) {
    try {
      const response = await fetch(options.certificateUrl);
      if (response.ok) {
        blob = await response.blob();
      }
    } catch (e) {
      console.warn(
        "[certificateUtils] Direct fetch of certificateUrl failed, generating fallback PDF:",
        e,
      );
    }
  }

  // 2. Fallback PDF generation using pdf-lib if fetch failed
  if (!blob) {
    blob = await generateFallbackCertificatePdf({
      eventTitle: options.eventTitle,
      studentName: options.studentName,
      issuedAt: options.issuedAt,
      certId: options.certId,
    });
  }

  // 3. Initiate browser download stream
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = formatCertificateFilename(options.eventTitle);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    window.URL.revokeObjectURL(blobUrl);
  }, 1000);
}
