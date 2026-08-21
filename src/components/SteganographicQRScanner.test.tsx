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
  onload: ((ev: { target: MockFileReader }) => void) | null = null;
  result: string | ArrayBuffer | null = null;
  readAsDataURL() {
    this.result = "data:image/png;base64,abc";
    if (this.onload) {
      this.onload({ target: this });
    }
  }
}

class MockImage {
  onload: (() => void) | null = null;
  width = 200;
  height = 200;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    this.onload?.();
  }
}

describe("SteganographicQRScanner", () => {
  beforeEach(() => {
    vi.stubGlobal("FileReader", MockFileReader);
    vi.stubGlobal("Image", MockImage);
    mockVerifyTicketPayload.mockReset();
    mockExtractLSBData.mockReset();

    // Mock canvas 2D context so JSDOM doesn't fail when creating the image canvas
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(200 * 200 * 4),
        width: 200,
        height: 200,
      }),
      clearRect: vi.fn(),
      putImageData: vi.fn(),
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
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

    const { container } = render(
      <SteganographicQRScanner onVerificationSuccess={onVerificationSuccess} />,
    );

    // Switch to upload mode first (the file input only renders in upload mode)
    const uploadButton = screen.getByText(/Upload Ticket/i);
    fireEvent.click(uploadButton);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();

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
