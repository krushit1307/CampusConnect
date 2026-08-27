import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import EquipmentMarketplace from "./equipment";

// Mock Supabase
const mockRequestRent = vi.fn().mockResolvedValue({ data: "rental-1", error: null });
const mockApproveRent = vi.fn().mockResolvedValue({ data: true, error: null });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }),
      getSession: () => Promise.resolve({ data: { session: { access_token: "token" } } }),
    },
    rpc: (name: string, args: any) => {
      if (name === "request_equipment_rental") return mockRequestRent(args);
      if (name === "approve_equipment_rental") return mockApproveRent(args);
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      if (table === "club_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [{ club_id: "club-1", clubs: { name: "Film Club" } }],
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "inventory_items") {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "item-1",
                      name: "PA System",
                      category: "Audio",
                      condition: "good",
                      daily_rental_rate: 3500, // $35.00
                      owner_club_id: "club-2",
                      clubs: { id: "club-2", name: "Music Club" },
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    },
  }),
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: (opts: any) => {
    if (opts.queryKey[0] === "rentable-gear-catalog") {
      return {
        data: [
          {
            id: "item-1",
            name: "PA System",
            category: "Audio",
            condition: "good",
            daily_rental_rate: 3500,
            owner_club_id: "club-2",
            clubs: { id: "club-2", name: "Music Club" },
          },
        ],
        isLoading: false,
      };
    }
    if (opts.queryKey[0] === "equipment-rentals-logs") {
      return {
        data: [
          {
            id: "rental-1",
            status: "authorized",
            rental_fee_cents: 7000,
            security_deposit_cents: 50000,
            start_date: "2026-08-20T12:00:00Z",
            end_date: "2026-08-22T12:00:00Z",
            item_id: "item-1",
            renter_club_id: "club-1",
            item: { name: "PA System", owner_club_id: "club-2", clubs: { name: "Music Club" } },
            renter: { name: "Film Club" },
            contracts: [
              {
                contract_text:
                  "DIGITAL LIABILITY CONTRACT: Film Club agrees to rent PA System from Music Club.",
              },
            ],
          },
          {
            id: "rental-2",
            status: "requested",
            rental_fee_cents: 3500,
            security_deposit_cents: 50000,
            start_date: "2026-08-23T12:00:00Z",
            end_date: "2026-08-24T12:00:00Z",
            item_id: "item-2",
            renter_club_id: "club-99",
            item: { name: "Stage Mic", owner_club_id: "club-1", clubs: { name: "Film Club" } },
            renter: { name: "Music Club" },
            contracts: [],
          },
        ],
        isLoading: false,
      };
    }
    return { data: null, isLoading: false };
  },
  useMutation: (opts: any) => ({
    mutate: (arg?: any) => opts.mutationFn(arg).then(opts.onSuccess),
    isPending: false,
  }),
}));

describe("P2P Equipment Rental Marketplace UI (#3549)", () => {
  it("renders catalog search input, renting dialogs and triggers DB rpc requests", async () => {
    render(
      <BrowserRouter>
        <EquipmentMarketplace />
      </BrowserRouter>,
    );

    // Verify catalog title, items lists
    expect(await screen.findByText("P2P Equipment Rentals")).toBeInTheDocument();
    expect(screen.getByText("PA System")).toBeInTheDocument();
    expect(screen.getByText("$35.00 / Day")).toBeInTheDocument();

    // Click Rent Gear button
    const rentBtn = screen.getByRole("button", { name: "Rent Gear" });
    fireEvent.click(rentBtn);

    // Open Dialog asserts
    expect(screen.getByText("Total Rental Fee:")).toBeInTheDocument();

    // Click Authorize & Rent
    const authBtn = screen.getByRole("button", { name: "Authorize & Rent" });
    fireEvent.click(authBtn);

    await waitFor(() => {
      expect(mockRequestRent).toHaveBeenCalled();
    });
  });

  it("renders digital contract details and handles peer approval flow", async () => {
    render(
      <BrowserRouter>
        <EquipmentMarketplace />
      </BrowserRouter>,
    );

    // 1. Verify signed digital contract text is displayed
    expect(await screen.findByText("Signed Digital Contract:")).toBeInTheDocument();
    expect(
      screen.getByText(
        "DIGITAL LIABILITY CONTRACT: Film Club agrees to rent PA System from Music Club.",
      ),
    ).toBeInTheDocument();

    // 2. Verify Approve Rental Request button is shown for the lender
    const approveBtn = screen.getByRole("button", { name: "Approve Rental Request" });
    expect(approveBtn).toBeInTheDocument();

    // 3. Click Approve Rental Request
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(mockApproveRent).toHaveBeenCalledWith({ p_rental_id: "rental-2" });
    });
  });
});
