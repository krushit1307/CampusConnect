import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaxExemptIrsAuditExporterWidget } from "./TaxExemptIrsAuditExporterWidget";

describe("TaxExemptIrsAuditExporterWidget Component (#4667)", () => {
  it("renders IRS Audit Exporter header, fiscal year selector, and asset checklist", () => {
    render(
      <TaxExemptIrsAuditExporterWidget
        clubName="Computer Science Society"
        requesterEmail="treasurer@cs-society.edu"
      />
    );

    expect(screen.getByText(/Automated "Tax-Exempt" IRS Audit Trail Exporter — Computer Science Society/i)).toBeInTheDocument();
    expect(screen.getByText("Select Audit Fiscal Year *")).toBeInTheDocument();
    expect(screen.getByText("Ledger Transactions CSV")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Compile & Export IRS Audit Package/i })).toBeInTheDocument();
  });

  it("compiles IRS audit package and displays download ZIP card with expiry notice", async () => {
    vi.useFakeTimers();
    const handleExport = vi.fn();

    render(
      <TaxExemptIrsAuditExporterWidget
        clubName="Computer Science Society"
        requesterEmail="treasurer@cs-society.edu"
        onExportCompleted={handleExport}
      />
    );

    const compileBtn = screen.getByRole("button", { name: /Compile & Export IRS Audit Package/i });
    fireEvent.click(compileBtn);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(handleExport).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        exportZipFilename: "Computer_Science_Society_IRS_Audit_Pack_FY2025.zip",
      })
    );

    expect(screen.getByText(/Computer_Science_Society_IRS_Audit_Pack_FY2025.zip/i)).toBeInTheDocument();
    expect(screen.getByText(/Link Expires in 7 Days/i)).toBeInTheDocument();

    vi.useRealTimers();
  });
});
