import { describe, it, expect } from "vitest";
import {
  generateAuditZipFilename,
  compileIrsAuditTrailPackage,
  AuditExportRequest,
} from "./taxExemptIrsAuditExporter";

describe("Tax-Exempt IRS Audit Trail Exporter Utility (#4667)", () => {
  const sampleRequest: AuditExportRequest = {
    clubId: "club-cs-1",
    clubName: "Computer Science Society",
    fiscalYear: 2025,
    requesterId: "u-treasurer-101",
    requesterEmail: "treasurer@cs-society.edu",
  };

  it("formats structured ZIP archive filename for legal discovery", () => {
    const filename = generateAuditZipFilename("Computer Science Society", 2025);
    expect(filename).toBe("Computer_Science_Society_IRS_Audit_Pack_FY2025.zip");
  });

  it("compiles multi-asset IRS audit package with ledger CSV, Form 990-EZ PDF, and OCR receipts", () => {
    const result = compileIrsAuditTrailPackage(sampleRequest);

    expect(result.status).toBe("completed");
    expect(result.exportZipFilename).toContain("Computer_Science_Society");
    expect(result.assetSummary.ledgerCsvIncluded).toBe(true);
    expect(result.assetSummary.form990EzPdfIncluded).toBe(true);
    expect(result.assetSummary.ocrReceiptsCount).toBe(24);
  });

  it("generates 7-day expiring download URL for secure delivery", () => {
    const result = compileIrsAuditTrailPackage(sampleRequest);

    expect(result.downloadUrl).toContain("https://cdn.campus.edu/financials/audit-exports/");
    expect(result.downloadExpiresAt).toBeDefined();

    const expiresDate = new Date(result.downloadExpiresAt);
    const now = new Date();
    const diffDays = Math.round((expiresDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    expect(diffDays).toBe(7);
  });
});
