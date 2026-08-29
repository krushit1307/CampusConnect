import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WalletAgendaPushSyncWidget } from "./WalletAgendaPushSyncWidget";

describe("WalletAgendaPushSyncWidget Component (#4671)", () => {
  it("renders Wallet Agenda Push Sync header, itinerary sessions, and APNs log", () => {
    render(
      <WalletAgendaPushSyncWidget
        serialNumber="pass_user101_evt2026"
      />
    );

    expect(screen.getByText(/Interactive "Event Schedule" Custom Agenda Push Sync/i)).toBeInTheDocument();
    expect(screen.getByText("Your Custom Event Itinerary")).toBeInTheDocument();
    expect(screen.getByText("Keynote: Next-Gen AI Infrastructure")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Session/i })).toBeInTheDocument();
  });

  it("removes session from itinerary and triggers silent APNs push notification", () => {
    const handlePassSynced = vi.fn();
    render(
      <WalletAgendaPushSyncWidget
        serialNumber="pass_user101_evt2026"
        onPassSynced={handlePassSynced}
      />
    );

    const removeBtn = screen.getByRole("button", { name: /Remove Keynote: Next-Gen AI Infrastructure/i });
    fireEvent.click(removeBtn);

    expect(handlePassSynced).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "removed",
        status: "synced",
        serialNumber: "pass_user101_evt2026",
      })
    );

    expect(screen.queryByText("Keynote: Next-Gen AI Infrastructure")).toBeNull();
    expect(screen.getByText(/SILENT APNS PUSH PAYLOAD/i)).toBeInTheDocument();
  });

  it("adds new session to itinerary and updates Apple Wallet pass sync log", () => {
    const handlePassSynced = vi.fn();
    render(
      <WalletAgendaPushSyncWidget
        serialNumber="pass_user101_evt2026"
        onPassSynced={handlePassSynced}
      />
    );

    const addBtn = screen.getByRole("button", { name: /Add Session/i });
    fireEvent.click(addBtn);

    expect(handlePassSynced).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "added",
        status: "synced",
      })
    );

    expect(screen.getByText("Networking Fireside Chat & Mixer")).toBeInTheDocument();
  });
});
