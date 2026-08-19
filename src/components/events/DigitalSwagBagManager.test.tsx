import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DigitalSwagBagManager, MOCK_SWAG_ITEMS } from "./DigitalSwagBagManager";

describe("DigitalSwagBagManager Component (#3535)", () => {
  it("renders Digital Swag Bag Manager header and active swag assets", () => {
    render(
      <DigitalSwagBagManager
        eventName="Gala Ballroom 2026"
        initialItems={MOCK_SWAG_ITEMS}
        totalDeliveries={150}
      />,
    );

    expect(screen.getByText(/Digital Swag Bag Manager — Gala Ballroom 2026/i)).toBeInTheDocument();
    expect(screen.getByText("Free Energy Drink Voucher")).toBeInTheDocument();
    expect(screen.getByText("Student Developer Pack Offer")).toBeInTheDocument();
  });

  it("displays sponsor ROI & Click-Through Rate analytics", () => {
    render(
      <DigitalSwagBagManager
        eventName="Gala Ballroom 2026"
        initialItems={MOCK_SWAG_ITEMS}
        totalDeliveries={100}
      />,
    );

    expect(screen.getByText(/Sponsor ROI & CTR Analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/100 attendees/i)).toBeInTheDocument();
    expect(screen.getByText(/42% CTR/i)).toBeInTheDocument(); // 42 clicks / 100 deliveries
  });

  it("opens live email preview modal", () => {
    render(
      <DigitalSwagBagManager
        eventName="Gala Ballroom 2026"
        initialItems={MOCK_SWAG_ITEMS}
      />,
    );

    const previewBtn = screen.getByRole("button", { name: /Preview Email/i });
    fireEvent.click(previewBtn);

    expect(screen.getByText("Live Swag Bag Email Preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close Preview/i })).toBeInTheDocument();
  });

  it("allows adding a new digital swag asset", () => {
    const handleSave = vi.fn();
    render(
      <DigitalSwagBagManager
        eventName="Gala Ballroom 2026"
        initialItems={MOCK_SWAG_ITEMS}
        onSaveItems={handleSave}
      />,
    );

    const addBtn = screen.getByRole("button", { name: /Add Swag Asset/i });
    fireEvent.click(addBtn);

    fireEvent.change(screen.getByPlaceholderText(/e.g. Red Bull \/ AWS/i), {
      target: { value: "AWS Cloud" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e.g. Free Energy Drink Voucher/i), {
      target: { value: "$100 Cloud Credits" },
    });

    const submitBtn = screen.getByRole("button", { name: /Add to Swag Bag/i });
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalled();
  });
});
