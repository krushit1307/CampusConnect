import { describe, expect, it } from "vitest";
import { formatCertificateFilename, generateFallbackCertificatePdf } from "./certificateUtils";

describe("certificateUtils module", () => {
  it("formats certificate filenames cleanly", () => {
    expect(formatCertificateFilename("Annual Hackathon 2026")).toBe(
      "annual-hackathon-2026-certificate.pdf",
    );
    expect(formatCertificateFilename("  Web3 & AI Workshop!! ")).toBe(
      "web3-ai-workshop-certificate.pdf",
    );
    expect(formatCertificateFilename(undefined)).toBe("campusconnect-certificate.pdf");
  });

  it("generates a valid fallback PDF Blob", async () => {
    const blob = await generateFallbackCertificatePdf({
      eventTitle: "Test Workshop",
      studentName: "Jane Doe",
      issuedAt: "2026-07-24T00:00:00.000Z",
      certId: "CERT-12345",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(100);
  });

  it("handles exceptionally long names and event titles without erroring", async () => {
    const blob = await generateFallbackCertificatePdf({
      eventTitle:
        "A very long event title that spans many characters to test the text scaling functionality of our pdf generator",
      studentName: "Hubert Blaine Wolfeschlegelsteinhausenbergerdorff Sr.",
      issuedAt: "2026-07-24T00:00:00.000Z",
      certId: "CERT-LONGNAME-123",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(100);
  });
});
