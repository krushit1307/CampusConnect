import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrefetchLink, isSaveDataOrSlowNetwork } from "./PrefetchLink";

describe("PrefetchLink Component (#2802)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    vi.spyOn(queryClient, "prefetchQuery");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it("prefetches query data after 50ms hover debounce", () => {
    const mockQueryFn = vi.fn().mockResolvedValue({ title: "Hackathon 2026" });

    renderWithProviders(
      <PrefetchLink
        to="/events/hackathon-2026"
        queryKey={["event", "hackathon-2026"]}
        queryFn={mockQueryFn}
      >
        View Hackathon
      </PrefetchLink>,
    );

    const link = screen.getByText("View Hackathon");

    // Mouse enter
    fireEvent.mouseEnter(link);
    expect(queryClient.prefetchQuery).not.toHaveBeenCalled();

    // Advance 50ms debounce
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(queryClient.prefetchQuery).toHaveBeenCalledWith({
      queryKey: ["event", "hackathon-2026"],
      queryFn: mockQueryFn,
      staleTime: 60000,
    });
  });

  it("cancels prefetch if user rapidly leaves before debounce finishes", () => {
    const mockQueryFn = vi.fn().mockResolvedValue({});

    renderWithProviders(
      <PrefetchLink
        to="/events/rapid"
        queryKey={["event", "rapid"]}
        queryFn={mockQueryFn}
        debounceMs={50}
      >
        Rapid Card
      </PrefetchLink>,
    );

    const link = screen.getByText("Rapid Card");

    fireEvent.mouseEnter(link);
    act(() => {
      vi.advanceTimersByTime(20); // Only 20ms of hover
    });

    fireEvent.mouseLeave(link); // Cursor moved away

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(queryClient.prefetchQuery).not.toHaveBeenCalled();
  });

  it("prefetches immediately on keyboard focus", () => {
    const mockQueryFn = vi.fn().mockResolvedValue({});

    renderWithProviders(
      <PrefetchLink to="/clubs/robotics" queryKey={["club", "robotics"]} queryFn={mockQueryFn}>
        Robotics Club
      </PrefetchLink>,
    );

    const link = screen.getByText("Robotics Club");
    fireEvent.focus(link);

    expect(queryClient.prefetchQuery).toHaveBeenCalledWith({
      queryKey: ["club", "robotics"],
      queryFn: mockQueryFn,
      staleTime: 60000,
    });
  });

  it("evaluates navigator saveData and slow connection correctly", () => {
    // Default
    expect(isSaveDataOrSlowNetwork()).toBe(false);

    // Save Data enabled
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true, effectiveType: "4g" },
      configurable: true,
      writable: true,
    });
    expect(isSaveDataOrSlowNetwork()).toBe(true);

    // 2G slow network
    Object.defineProperty(navigator, "connection", {
      value: { saveData: false, effectiveType: "2g" },
      configurable: true,
      writable: true,
    });
    expect(isSaveDataOrSlowNetwork()).toBe(true);
  });
});
