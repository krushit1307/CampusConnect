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

  page.drawText("Certificate of Attendance", {
    x: 120,
    y: 320,
    size: 26,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  page.drawText("This certifies that", { x: 230, y: 270, size: 14, font: fontNormal });

  const nameText = options.studentName || "Distinguished Student";
  page.drawText(nameText, { x: 180, y: 230, size: 22, font: fontBold });

  page.drawText("has successfully participated in", { x: 190, y: 190, size: 14, font: fontNormal });

  const titleText = options.eventTitle || "CampusConnect Event";
  page.drawText(titleText, { x: 150, y: 150, size: 18, font: fontBold });

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
