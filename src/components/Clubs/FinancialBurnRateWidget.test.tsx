import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FinancialBurnRateWidget } from "./FinancialBurnRateWidget";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (name: string, args: any) => {
      if (name === "get_club_burn_rate") {
        return Promise.resolve({
          data: [
            {
              ledger_balance: 2500.00,
              average_monthly_burn: 1250.00,
              runway_months: 2.0
            }
          ],
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    }
  })
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: () => ({
    data: {
      ledger_balance: 2500.00,
      average_monthly_burn: 1250.00,
      runway_months: 2.0
    },
    isLoading: false
  })
}));

// Mock ResponsiveContainer to bypass Recharts dimensions check in tests
vi.mock("recharts", () => {
  const original = vi.importActual("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>
  };
});

describe("Interactive Club Financial Burn Rate Calculator Widget (#3556)", () => {
  it("renders burn rate stats, predictive chart metrics and May Banquet warning triggers", async () => {
    render(<FinancialBurnRateWidget clubId="club-1" />);

    // Verify widget title is in document
    expect(screen.getByText("Predictive \"Burn Rate\" Calculator")).toBeInTheDocument();

    // Verify stats text outputs
    expect(screen.getByText("$1,250.00/mo")).toBeInTheDocument();
    expect(screen.getByText("2.0 Months")).toBeInTheDocument();

    // Verify the banquet warning is present due to short runway (2 months < 9 months)
    expect(screen.getByText(/Warning: At your current spending velocity/)).toBeInTheDocument();
  });
});
