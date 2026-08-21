// src/lib/__tests__/pdfWatermarkEngine.test.ts
import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { applyForensicWatermark, createSamplePDF } from "../pdfWatermarkEngine";

describe("pdfWatermarkEngine", () => {
  it("creates a sample PDF buffer", async () => {
    const pdfBytes = await createSamplePDF("Test Strategy Document");
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(100);
  });

  it("applies forensic watermark with user email and 20% opacity without throwing errors", async () => {
    const rawPdf = await createSamplePDF("Financial Report");
    const watermarkedPdfBytes = await applyForensicWatermark(rawPdf, {
      userEmail: "jdoe@univ.edu",
      timestamp: new Date("2026-08-18T12:00:00Z"),
      opacity: 0.2,
    });

    expect(watermarkedPdfBytes).toBeInstanceOf(Uint8Array);
    expect(watermarkedPdfBytes.length).toBeGreaterThan(rawPdf.length);

    // Reload modified PDF with pdf-lib to verify structural integrity
    const doc = await PDFDocument.load(watermarkedPdfBytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
