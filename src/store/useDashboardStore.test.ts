import { describe, it, expect, beforeEach } from "vitest";
import { useDashboardStore } from "./useDashboardStore";

describe("useDashboardStore (#1434)", () => {
  beforeEach(() => {
    useDashboardStore.getState().resetDashboardState();
  });

  it("initializes with default dashboard state", () => {
    const state = useDashboardStore.getState();
    expect(state.activeTab).toBe("overview");
    expect(state.layoutViewMode).toBe("grid");
    expect(state.analyticsTimeframe).toBe("month");
    expect(state.welcomeDismissed).toBe(false);
  });

  it("updates active tab correctly", () => {
    useDashboardStore.getState().setActiveTab("rsvps");
    expect(useDashboardStore.getState().activeTab).toBe("rsvps");
  });

  it("toggles layout view mode", () => {
    useDashboardStore.getState().setLayoutViewMode("list");
    expect(useDashboardStore.getState().layoutViewMode).toBe("list");
  });

  it("sets welcome dismissed state", () => {
    useDashboardStore.getState().setWelcomeDismissed(true);
    expect(useDashboardStore.getState().welcomeDismissed).toBe(true);
  });

  it("resets state back to initial default values", () => {
    useDashboardStore.getState().setActiveTab("bookmarks");
    useDashboardStore.getState().setLayoutViewMode("list");
    useDashboardStore.getState().resetDashboardState();

    expect(useDashboardStore.getState().activeTab).toBe("overview");
    expect(useDashboardStore.getState().layoutViewMode).toBe("grid");
  });
});
