import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VendorRfpManager } from "./VendorRfpManager";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockRfps = [
  {
    id: "rfp-1",
    club_id: "club-1",
    title: "Catering for 300-Person Annual Gala Banquet",
    category: "catering",
    description: "Need dinner catering.",
    budget_max: 2000,
    deadline: "2024-12-01T00:00:00.000Z",
    status: "open",
  },
];

const mockBids = [
  {
    id: "bid-1",
    rfp_id: "rfp-1",
    vendor_name: "TacoCorp Catering",
    vendor_email: "events@tacocorp.com",
    quoted_price: 1650,
    status: "pending",
  },
];

vi.mock("@/hooks/useReactQueryReplacement", async () => {
  const actual = (await vi.importActual("@/hooks/useReactQueryReplacement")) as any;
  return {
    ...actual,
    useQuery: vi.fn(({ queryKey }) => {
      if (queryKey[0] === "vendor_rfps") return { data: mockRfps, isLoading: false };
      if (queryKey[0] === "rfp_bids") return { data: mockBids, isLoading: false };
      return { data: [], isLoading: false };
    }),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  };
});

window.confirm = vi.fn(() => true);

describe("VendorRfpManager Component (#4225)", () => {
  const queryClient = new QueryClient();

  const renderWithClient = (ui: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it("renders Vendor RFP Manager header and submitted vendor proposals", async () => {
    renderWithClient(<VendorRfpManager clubName="Engineering Society" />);

    expect(
      screen.getAllByText("Catering for 300-Person Annual Gala Banquet").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("TacoCorp Catering")).toBeInTheDocument();
    expect(screen.getByText(/Saves \$350/i)).toBeInTheDocument();
  });

  it("opens create RFP modal", async () => {
    renderWithClient(<VendorRfpManager clubName="Engineering Society" />);

    const postBtn = screen.getByRole("button", { name: /Post New RFP/i });
    fireEvent.click(postBtn);

    expect(screen.getByRole("heading", { name: /Post Procurement RFP/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Procurement Job Title \*/i)).toBeInTheDocument();
  });

  it("opens submit vendor quote modal (Vendor View)", async () => {
    renderWithClient(<VendorRfpManager clubName="Engineering Society" isVendorView={true} />);

    const quoteBtn = screen.getByRole("button", { name: /Submit Vendor Quote/i });
    fireEvent.click(quoteBtn);

    expect(screen.getByRole("heading", { name: /Submit Vendor Quote/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Vendor \/ Business Name \*/i)).toBeInTheDocument();
  });

  it("renders Accept Bid button on Organizer view and accepts click", async () => {
    renderWithClient(<VendorRfpManager clubName="Engineering Society" />);

    const acceptButtons = screen.getAllByRole("button", { name: /Accept Bid/i });
    fireEvent.click(acceptButtons[0]);
    expect(window.confirm).toHaveBeenCalled();
  });
});
