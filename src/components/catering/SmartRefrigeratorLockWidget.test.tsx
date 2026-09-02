import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SmartRefrigeratorLockWidget } from "./SmartRefrigeratorLockWidget";

describe("SmartRefrigeratorLockWidget Component (#4986)", () => {
  it("renders Smart Refrigerator Lock header, food staging info, and unlock hash card", () => {
    render(
      <SmartRefrigeratorLockWidget
        fridgeLocation="Student Union Staging Rm 102"
        dietaryType="Halal / Kosher / Vegan Special Staging"
      />
    );

    expect(screen.getByText(/"Dietary Restriction" Smart Refrigerator Lock — Student Union Staging Rm 102/i)).toBeInTheDocument();
    expect(screen.getByText(/Halal \/ Kosher \/ Vegan Special Staging/i)).toBeInTheDocument();
    expect(screen.getByText("ONE-TIME UNLOCK HASH")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Scan Fridge QR Code to Deposit Food/i })).toBeInTheDocument();
  });

  it("executes Caterer QR deposit scan and drops lock for food deposit", () => {
    render(<SmartRefrigeratorLockWidget />);

    const qrBtn = screen.getByRole("button", { name: /Scan Fridge QR Code to Deposit Food/i });
    fireEvent.click(qrBtn);

    expect(screen.getByText(/Caterer QR Scan Verified! Lock dropped for food deposit\./i)).toBeInTheDocument();
  });

  it("executes Organizer Bluetooth BLE unlock and fires onFridgeUnlocked callback", () => {
    const handleUnlocked = vi.fn();
    render(<SmartRefrigeratorLockWidget onFridgeUnlocked={handleUnlocked} />);

    const bleBtn = screen.getByRole("button", { name: /Bluetooth BLE Unlock Staging Fridge/i });
    fireEvent.click(bleBtn);

    expect(handleUnlocked).toHaveBeenCalledWith(
      expect.objectContaining({
        unlockedByRole: "organizer",
        newLockState: "organizer_unlocked",
      })
    );

    expect(screen.getByText(/Organizer Bluetooth BLE Unlock Verified!/i)).toBeInTheDocument();
  });
});
