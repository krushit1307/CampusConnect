import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoiseComplaintWidget } from "./NoiseComplaintWidget";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: { success: true, event_title: "Grandfathered Party", complaint_count: 3 },
          error: null,
        }),
      },
    }),
  };
});

describe("NoiseComplaintWidget", () => {
  it("renders the floating button and opens the modal on click", async () => {
    render(<NoiseComplaintWidget />);

    const reportBtn = screen.getByTestId("noise-complaint-btn");
    expect(reportBtn).toBeInTheDocument();
    expect(reportBtn).toHaveTextContent(/Report Noise/i);

    // Modal is initially not present
    expect(screen.queryByTestId("noise-complaint-modal")).not.toBeInTheDocument();

    // Click to open modal
    fireEvent.click(reportBtn);

    expect(await screen.findByTestId("noise-complaint-modal")).toBeInTheDocument();
    expect(screen.getByText(/Report Noise \/ Disturbance/i)).toBeInTheDocument();
    expect(screen.getByTestId("submit-noise-complaint-btn")).toBeInTheDocument();
  });
});
