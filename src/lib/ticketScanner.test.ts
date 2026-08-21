import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseTicketQrCode, processTicketScan, triggerHapticFeedback } from "./ticketScanner";

describe("Admin Ticket Scanner Suite (#2672)", () => {
  const validQrData = JSON.stringify({
    ticketId: "t_101",
    eventId: "e_202",
    attendeeId: "u_303",
    timestamp: 1712345678,
  });

  let scannedTicketIds: Set<string>;

  beforeEach(() => {
    scannedTicketIds = new Set<string>();
    vi.stubGlobal("navigator", {
      vibrate: vi.fn(),
    });
  });

  it("parses valid QR codes correctly", () => {
    const payload = parseTicketQrCode(validQrData);
    expect(payload).not.toBeNull();
    expect(payload?.ticketId).toBe("t_101");
    expect(payload?.eventId).toBe("e_202");
  });

  it("returns INVALID for corrupt QR code strings", () => {
    const result = processTicketScan("invalid_json_string", scannedTicketIds);
    expect(result.status).toBe("INVALID");
  });

  it("returns VALID on first scan and DUPLICATE on second scan", () => {
    // First scan -> VALID
    const firstScan = processTicketScan(validQrData, scannedTicketIds);
    expect(firstScan.status).toBe("VALID");
    expect(scannedTicketIds.has("t_101")).toBe(true);

    // Second scan -> DUPLICATE
    const secondScan = processTicketScan(validQrData, scannedTicketIds);
    expect(secondScan.status).toBe("DUPLICATE");
  });

  it("triggers haptic feedback on scan events", () => {
    triggerHapticFeedback("success");
    expect(navigator.vibrate).toHaveBeenCalledWith([100, 50, 100]);

    triggerHapticFeedback("error");
    expect(navigator.vibrate).toHaveBeenCalledWith([300, 100, 300]);
  });
});
