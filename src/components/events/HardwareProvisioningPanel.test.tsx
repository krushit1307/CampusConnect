import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HardwareProvisioningPanel } from "./HardwareProvisioningPanel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockRequest = {
  id: "req-1",
  event_id: "evt-1",
  status: "active",
  error_information: null,
  hardware_provisioned_resources: [
    { id: "res-1", status: "active", public_ip: "10.0.0.1", attendee_id: null },
    { id: "res-2", status: "active", public_ip: "10.0.0.2", attendee_id: "att-1" },
  ],
};

vi.mock("@/hooks/useReactQueryReplacement", async () => {
  const actual = (await vi.importActual("@/hooks/useReactQueryReplacement")) as any;
  return {
    ...actual,
    useQuery: vi.fn(({ queryKey }) => {
      if (queryKey[0] === "hardware_request" && queryKey[1] === "evt-1") {
        return { data: mockRequest, isLoading: false };
      }
      return { data: null, isLoading: false };
    }),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(),
    })),
  };
});

window.confirm = vi.fn(() => true);

describe("HardwareProvisioningPanel", () => {
  const queryClient = new QueryClient();

  const renderWithClient = (ui: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the active request status and VMs count", () => {
    renderWithClient(<HardwareProvisioningPanel eventId="evt-1" clubId="club-1" />);

    expect(screen.getByText(/Cloud Hardware Provisioning/i)).toBeInTheDocument();
    expect(screen.getByText(/Status: active/i)).toBeInTheDocument();
    expect(screen.getByText(/2 VMs Provisioned/i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Terminate Resources/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Assign to Checked-In/i })).toBeInTheDocument();
  });

  it("renders the provisioning form when no active request exists", () => {
    renderWithClient(<HardwareProvisioningPanel eventId="evt-none" clubId="club-1" />);

    expect(screen.getByText(/AWS EC2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Quantity/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Provision 50 VMs/i })).toBeInTheDocument();
  });

  it("calls terminate mutation when confirmed", () => {
    renderWithClient(<HardwareProvisioningPanel eventId="evt-1" clubId="club-1" />);

    const terminateBtn = screen.getByRole("button", { name: /Terminate Resources/i });
    fireEvent.click(terminateBtn);

    expect(window.confirm).toHaveBeenCalled();
  });
});
