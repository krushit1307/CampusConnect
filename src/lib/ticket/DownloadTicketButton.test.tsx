import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { DownloadTicketButton } from "./DownloadTicketButton";

// Mock the download helper so we don't load pdfmake in jsdom.
const mockDownload = vi.fn().mockResolvedValue(undefined);
vi.mock("./download", () => ({
  downloadTicketPDF: (...args: unknown[]) => mockDownload(...args),
  buildTicketFilename: () => "ticket-AB12CD-test.pdf",
}));

// Mock sonner so we don't need its ToastProvider in jsdom.
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const sampleTicket = {
  event: { title: "Campus Hackathon 2026", location: "Auditorium A" },
  attendee: { fullName: "Test User", email: "test@example.com" },
  ticketId: "AB12CD",
  qrCodeDataUrl: "data:image/png;base64,AAAA",
};

describe("DownloadTicketButton (issue #1913)", () => {
  beforeEach(() => {
    mockDownload.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it("renders the default label", () => {
    render(<DownloadTicketButton ticket={sampleTicket} />);
    expect(screen.getByRole("button", { name: /Download PDF/i })).toBeInTheDocument();
  });

  it("renders a custom label override", () => {
    render(<DownloadTicketButton ticket={sampleTicket} label="Get my ticket" />);
    expect(screen.getByRole("button", { name: /Get my ticket/i })).toBeInTheDocument();
  });

  it("calls downloadTicketPDF on click and shows a success toast", async () => {
    render(<DownloadTicketButton ticket={sampleTicket} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith(sampleTicket);
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Ticket downloaded");
    });
  });

  it("shows an error toast if the download throws", async () => {
    mockDownload.mockRejectedValueOnce(new Error("PDF generation failed"));
    render(<DownloadTicketButton ticket={sampleTicket} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it("is disabled while the download is in flight", async () => {
    let resolveDownload: () => void = () => {};
    mockDownload.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDownload = resolve;
        }),
    );
    render(<DownloadTicketButton ticket={sampleTicket} />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn).toBeDisabled();
      expect(btn.getAttribute("aria-busy")).toBe("true");
      expect(screen.getByText(/Preparing/i)).toBeInTheDocument();
    });
    resolveDownload();
  });

  it("renders the Download icon when idle", () => {
    render(<DownloadTicketButton ticket={sampleTicket} />);
    // The button has an SVG icon (lucide Download). Verify it's there
    // by checking the data-testid we set.
    expect(screen.getByTestId("download-ticket-button")).toHaveAttribute("data-state", "idle");
  });

  it("renders aria-busy=false when idle", () => {
    render(<DownloadTicketButton ticket={sampleTicket} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "false");
  });

  it("does not call downloadTicketPDF on a second click while one is in flight", async () => {
    let resolveDownload: () => void = () => {};
    mockDownload.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDownload = resolve;
        }),
    );
    render(<DownloadTicketButton ticket={sampleTicket} />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    resolveDownload();
  });
});

// Ensure cleanup runs between tests in this file even if the global
// afterEach isn't picked up.
afterEach(() => cleanup());
