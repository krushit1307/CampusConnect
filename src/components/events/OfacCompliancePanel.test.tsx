import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfacCompliancePanel } from "./OfacCompliancePanel";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      from: () => ({
        select: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: "alert-123",
                  vendor_name: "Al-Qaeda Front Corp",
                  owner_name: "Terry Terrorism",
                  matched_entity: "Al-Qaeda Front Corp",
                  similarity_score: 1.0,
                  created_at: new Date().toISOString(),
                },
              ],
              error: null,
            }),
        }),
      }),
    }),
  };
});

describe("OfacCompliancePanel", () => {
  it("renders scan form and lists logged sanctions alerts", async () => {
    render(<OfacCompliancePanel />);

    expect(screen.getByTestId("ofac-compliance-panel")).toBeInTheDocument();
    expect(screen.getByTestId("ofac-vendor-input")).toBeInTheDocument();
    expect(screen.getByTestId("ofac-owner-input")).toBeInTheDocument();
    expect(screen.getByTestId("run-ofac-scan-btn")).toBeInTheDocument();

    // Verify mock alert renders
    expect(await screen.findByText(/Al-Qaeda Front Corp/i)).toBeInTheDocument();
    expect(screen.getByText(/Terry Terrorism/i)).toBeInTheDocument();
  });
});
