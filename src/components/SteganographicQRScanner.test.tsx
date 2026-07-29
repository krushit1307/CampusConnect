import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SteganographicQRScanner } from "./SteganographicQRScanner";

const mockVerifyTicketPayload = vi.fn();
const mockExtractLSBData = vi.fn();

vi.mock("@/lib/steganography", () => ({
  extractLSBData: (imageData: unknown) => mockExtractLSBData(imageData),
  verifyTicketPayload: (payload: unknown) => mockVerifyTicketPayload(payload),
}));

class MockFileReader {
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  result: string | ArrayBuffer | null = null;
  readAsDataURL() {
    this.result = "data:image/png;base64,abc";
    this.onload?.({ target: this } as ProgressEvent<FileReader>);
  }
}

class MockImage {
  onload: (() => void) | null = null;
  width = 200;
  height = 200;
  src = "";
  set src(value: string) {
    this.onload?.();
  }
}

describe("SteganographicQRScanner", () => {
  beforeEach(() => {
    vi.stubGlobal("FileReader", MockFileReader);
    vi.stubGlobal("Image", MockImage);
    mockVerifyTicketPayload.mockReset();
    mockExtractLSBData.mockReset();
  });

  it("reports a verified payload to the parent when a ticket image is uploaded", async () => {
    const onVerificationSuccess = vi.fn();
    const payload = {
      rsvpId: "rsvp-123",
      timestamp: 1700000000000,
      signature: "abc",
      publicKey: "def",
    };

    mockExtractLSBData.mockReturnValue(JSON.stringify(payload));
    mockVerifyTicketPayload.mockResolvedValue({
      valid: true,
      rsvpId: payload.rsvpId,
      timestamp: payload.timestamp,
    });

    render(<SteganographicQRScanner onVerificationSuccess={onVerificationSuccess} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["ticket"], "ticket.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onVerificationSuccess).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({ valid: true }),
      );
    });

    expect(screen.getByText(/Authentic Ticket Verified/i)).toBeInTheDocument();
  });
});
