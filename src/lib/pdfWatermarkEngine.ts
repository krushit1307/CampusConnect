// =============================================================================
// Library: pdfWatermarkEngine
// Issue: #3343 - Secure Document Watermarking Pipeline
// Description: Forensic PDF watermarking engine using pdf-lib. Burns authenticated
// user email, timestamp, and confidentiality banner diagonally across every page
// with 20% opacity for leak traceability.
// =============================================================================

import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

export interface WatermarkOptions {
  userEmail: string;
  timestamp?: Date;
  customNote?: string;
  opacity?: number; // Default 0.2 (20% opacity)
}

/**
 * Applies a forensic diagonal watermark to every page of a PDF document.
 * Burns user email, ISO timestamp, and confidentiality notice.
 */
export async function applyForensicWatermark(
  pdfInput: ArrayBuffer | Uint8Array,
  options: WatermarkOptions,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfInput);
  const pages = pdfDoc.getPages();

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const timestampStr = (options.timestamp || new Date()).toISOString();
  const opacityVal = options.opacity !== undefined ? options.opacity : 0.2; // 20% opacity spec

  const watermarkText = `${options.userEmail} · ${timestampStr}`;
  const bannerNotice = "CONFIDENTIAL - INTERNAL USE ONLY - LEAK TRACEABLE";

  // Color palette for watermark overlay
  const darkRed = rgb(0.8, 0.15, 0.15);
  const darkGray = rgb(0.2, 0.2, 0.2);

  for (const page of pages) {
    const { width, height } = page.getSize();

    // 1. Primary diagonal watermark text across center of page
    const fontSize = Math.min(width, height) / 25;
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);

    // Center coordinates
    const centerX = width / 2 - (textWidth / 2) * Math.cos(Math.PI / 4);
    const centerY = height / 2;

    page.drawText(watermarkText, {
      x: Math.max(30, centerX - 40),
      y: centerY,
      size: fontSize,
      font,
      color: darkRed,
      opacity: opacityVal,
      rotate: degrees(-45),
    });

    // 2. Secondary confidentiality banner line
    page.drawText(bannerNotice, {
      x: Math.max(30, centerX - 50),
      y: centerY - 25,
      size: fontSize * 0.75,
      font: regularFont,
      color: darkGray,
      opacity: opacityVal,
      rotate: degrees(-45),
    });

    // 3. Header & Footer micro forensic stamps (top and bottom margins)
    page.drawText(`LICENSED TO: ${options.userEmail} | TS: ${timestampStr}`, {
      x: 20,
      y: height - 15,
      size: 7,
      font: regularFont,
      color: darkGray,
      opacity: opacityVal * 1.5,
    });

    page.drawText(`CAMPUSCONNECT SECURE VAULT - WATERMARKED FOR ${options.userEmail}`, {
      x: 20,
      y: 10,
      size: 7,
      font: regularFont,
      color: darkGray,
      opacity: opacityVal * 1.5,
    });
  }

  // Update PDF metadata
  pdfDoc.setKeywords(["confidential", "watermarked", options.userEmail]);

  return await pdfDoc.save();
}

/**
 * Creates a sample PDF document in memory for testing or demonstration.
 */
export async function createSamplePDF(
  title: string = "Club Strategic Plan 2026",
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText(title, { x: 50, y: 780, size: 24, font, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("Internal Board Document — Strictly Confidential", {
    x: 50,
    y: 750,
    size: 12,
    font: regular,
    color: rgb(0.4, 0.4, 0.4),
  });

  page.drawText("1. Executive Summary & Financial Allocations", {
    x: 50,
    y: 700,
    size: 14,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
  page.drawText(
    "This document contains sensitive budget allocations and strategy notes for club operations.",
    { x: 50, y: 675, size: 10, font: regular, color: rgb(0.3, 0.3, 0.3) },
  );

  return await pdfDoc.save();
}
