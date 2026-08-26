import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FloatingChat,
  getSnapPosition,
  isInDismissZone,
  BUBBLE_SIZE,
  EDGE_MARGIN,
  DISMISS_ZONE_HEIGHT,
  Z_INDEX_ACTIVE,
  Z_INDEX_LOWERED,
} from "./FloatingChat";
import { ModalProvider, useModal } from "@/components/modal/ModalContext";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "u1", user_metadata: { avatar_url: "https://example.com/a.png" } } },
        error: null,
      }),
    },
  })),
}));

function ModalProbe() {
  const { openModal, closeModal } = useModal();
  return (
    <div>
      <button onClick={() => openModal("LOGIN")}>open</button>
      <button onClick={() => closeModal()}>close</button>
    </div>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderChat() {
  return render(
    <MemoryRouter initialEntries={["/feed"]}>
      <ModalProvider>
        <FloatingChat />
        <ModalProbe />
        <LocationProbe />
      </ModalProvider>
    </MemoryRouter>,
  );
}

describe("FloatingChat geometry helpers", () => {
  const viewport = { width: 1000, height: 800 };

  it("snaps to the left edge when the bubble center is in the left half", () => {
    const pos = getSnapPosition(200, 400, viewport, BUBBLE_SIZE, EDGE_MARGIN, DISMISS_ZONE_HEIGHT);
    expect(pos.x).toBe(EDGE_MARGIN);
  });

  it("snaps to the right edge when the bubble center is in the right half", () => {
    const pos = getSnapPosition(800, 400, viewport, BUBBLE_SIZE, EDGE_MARGIN, DISMISS_ZONE_HEIGHT);
    expect(pos.x).toBe(viewport.width - BUBBLE_SIZE - EDGE_MARGIN);
  });

  it("clamps y above the dismiss zone", () => {
    const pos = getSnapPosition(500, 770, viewport, BUBBLE_SIZE, EDGE_MARGIN, DISMISS_ZONE_HEIGHT);
    expect(pos.y + BUBBLE_SIZE / 2).toBeLessThanOrEqual(viewport.height - DISMISS_ZONE_HEIGHT);
  });

  it("keeps the bubble fully on screen horizontally", () => {
    const pos = getSnapPosition(5, 400, viewport, BUBBLE_SIZE, EDGE_MARGIN, DISMISS_ZONE_HEIGHT);
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.x + BUBBLE_SIZE).toBeLessThanOrEqual(viewport.width);
  });

  it("detects the dismiss zone at the bottom of the viewport", () => {
    expect(isInDismissZone(770, 800, DISMISS_ZONE_HEIGHT)).toBe(true);
    expect(isInDismissZone(700, 800, DISMISS_ZONE_HEIGHT)).toBe(false);
  });
});

describe("FloatingChat component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a clickable bubble with the chat aria-label for authenticated users", async () => {
    renderChat();
    const bubble = await screen.findByTestId("floating-chat");
    expect(bubble).toHaveAttribute("aria-label", "Open chat");
  });

  it("uses a high z-index by default", async () => {
    renderChat();
    const bubble = await screen.findByTestId("floating-chat");
    expect(bubble.style.zIndex).toBe(String(Z_INDEX_ACTIVE));
  });

  it("lowers the z-index while a modal is open and restores it after", async () => {
    renderChat();
    const bubble = await screen.findByTestId("floating-chat");

    fireEvent.click(screen.getByText("open"));
    await waitFor(() => {
      expect(bubble.style.zIndex).toBe(String(Z_INDEX_LOWERED));
    });

    fireEvent.click(screen.getByText("close"));
    await waitFor(() => {
      expect(bubble.style.zIndex).toBe(String(Z_INDEX_ACTIVE));
    });
  });

  it("navigates to /messages on a clean click", async () => {
    renderChat();
    const bubble = await screen.findByTestId("floating-chat");
    fireEvent.click(bubble);
    await waitFor(() => {
      expect(screen.getByTestId("location-probe")).toHaveTextContent("/messages");
    });
  });

  it("hides on the /messages route", async () => {
    render(
      <MemoryRouter initialEntries={["/messages"]}>
        <ModalProvider>
          <FloatingChat />
        </ModalProvider>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.queryByTestId("floating-chat")).not.toBeInTheDocument();
    });
  });

  it("does not render after being dismissed via localStorage", async () => {
    localStorage.setItem("floating_chat_dismissed", "1");
    renderChat();
    await waitFor(() => {
      expect(screen.queryByTestId("floating-chat")).not.toBeInTheDocument();
    });
  });
});
