import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { MerchStore } from "@/components/Clubs/Merchandise/MerchStore";
import { ManageMerch } from "@/components/Clubs/Merchandise/ManageMerch";

// Mock Supabase
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1", email: "backer@campus.edu" } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({
          data: [
            {
              id: "item-1",
              club_id: "club-1",
              name: "Embroidered Jacket",
              description: "Embroidered premium club jacket",
              funding_goal_count: 50,
              campaign_end_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days left
              campaign_status: "active",
              variants: [
                {
                  id: "var-1",
                  merch_item_id: "item-1",
                  name: "Medium",
                  price: 6000,
                  stock: 100,
                },
              ],
              preorders: [{ quantity: 45 }],
            },
          ],
          error: null,
        }),
      }),
      insert: () => Promise.resolve({ data: { id: "item-new" }, error: null }),
    }),
  },
}));

// Mock hooks
vi.mock("@/hooks/useIdempotentPayment", () => ({
  useIdempotentPayment: () => ({
    processPayment: vi.fn(),
    isProcessing: false,
  }),
}));

vi.mock("@/hooks/useIdempotentPreorder", () => ({
  useIdempotentPreorder: () => ({
    processPreorder: vi.fn(),
    isProcessing: false,
  }),
}));

describe("Merchandise Crowdfunding Module UI (#3453)", () => {
  it("renders crowdfunding campaign widget, progress bar and pre-order buttons on MerchStore", async () => {
    render(
      <BrowserRouter>
        <MerchStore clubId="club-1" />
      </BrowserRouter>
    );

    // Verify item title renders
    expect(await screen.findByText("Embroidered Jacket")).toBeInTheDocument();
    // Verify backing progress metrics render
    expect(screen.getByText("45 / 50 Orders Backed")).toBeInTheDocument();
    expect(screen.getByText("2 Days Left!")).toBeInTheDocument();
    // Verify preorder button text renders
    expect(screen.getByRole("button", { name: "Pre-order Item" })).toBeInTheDocument();
  });

  it("renders campaign goal and end-date input fields inside ManageMerch manager dashboard", async () => {
    render(
      <BrowserRouter>
        <ManageMerch clubId="club-1" />
      </BrowserRouter>
    );

    // Verify creator dashboard input labels render
    expect(await screen.findByText("Crowdfunding Goal Count (Optional, e.g. 50 orders)")).toBeInTheDocument();
    expect(screen.getByText("Campaign End Date (Required if Goal is set)")).toBeInTheDocument();
  });
});
