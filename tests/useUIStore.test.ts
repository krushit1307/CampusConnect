import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "@/store/useUIStore";

describe("useUIStore", () => {
  beforeEach(() => {
    useUIStore.getState().resetUI();
    useUIStore.persist?.clearStorage?.();
  });

  it("starts with sidebar open, activeTab=overview, palette closed", () => {
    const s = useUIStore.getState();
    expect(s.sidebarOpen).toBe(true);
    expect(s.activeTab).toBe("overview");
    expect(s.commandPaletteOpen).toBe(false);
  });

  it("toggleSidebar flips the boolean", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it("setSidebarOpen sets an explicit value", () => {
    useUIStore.getState().setSidebarOpen(false);
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it("setActiveTab updates the active tab", () => {
    useUIStore.getState().setActiveTab("events");
    expect(useUIStore.getState().activeTab).toBe("events");
  });

  it("command palette actions open/close/toggle", () => {
    useUIStore.getState().openCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);

    useUIStore.getState().closeCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);

    useUIStore.getState().toggleCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
  });

  it("resetUI restores initial state", () => {
    useUIStore.getState().setActiveTab("settings");
    useUIStore.getState().setSidebarOpen(false);
    useUIStore.getState().openCommandPalette();

    useUIStore.getState().resetUI();

    const s = useUIStore.getState();
    expect(s.sidebarOpen).toBe(true);
    expect(s.activeTab).toBe("overview");
    expect(s.commandPaletteOpen).toBe(false);
  });
});
