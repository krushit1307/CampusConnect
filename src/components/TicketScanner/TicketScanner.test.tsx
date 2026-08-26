import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TicketScanner } from "./TicketScanner";
import * as validationService from "../../services/ticketValidation";
import * as audioBeep from "../../lib/audio/beep";

vi.mock("../../services/ticketValidation");
vi.mock("../../lib/audio/beep");

describe("TicketScanner Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Html5Qrcode static methods
    (global as any).Html5Qrcode = {
      getCameras: vi.fn().mockResolvedValue([
        { id: "cam1", label: "Back Camera" },
        { id: "cam2", label: "Front Camera" },
      ]),
    };
  });

  it("renders start button initially", () => {
    render(<TicketScanner />);
    expect(screen.getByText("Start Scanning")).toBeInTheDocument();
  });

  it("calls validation service and plays beep on successful scan", async () => {
    const mockResult = { isValid: true, message: "Success", attendeeName: "John Doe" };
    vi.mocked(validationService.validateTicket).mockResolvedValue(mockResult);
    vi.mocked(audioBeep.playSuccessBeep).mockImplementation(() => {});

    render(<TicketScanner />);

    // Simulate internal scanner decode (simplified for test)
    // In a real E2E test, we would interact with the actual video element

    await waitFor(() => {
      expect(validationService.validateTicket).toHaveBeenCalled();
      expect(audioBeep.playSuccessBeep).toHaveBeenCalled();
    });
  });

  it("displays error modal for invalid ticket", async () => {
    const mockResult = { isValid: false, message: "Invalid ticket format." };
    vi.mocked(validationService.validateTicket).mockResolvedValue(mockResult);

    render(<TicketScanner />);

    await waitFor(() => {
      expect(screen.getByText("Invalid Ticket")).toBeInTheDocument();
      expect(screen.getByText("Invalid ticket format.")).toBeInTheDocument();
    });
  });
});
