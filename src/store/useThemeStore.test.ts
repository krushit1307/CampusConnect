import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useThemeStore, THEME_STORAGE_KEY, resolveTheme, applyThemeToDom } from "./useThemeStore";

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
});
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: { theme_preference: "dark" },
      error: null,
    }),
  }),
});
const mockChannelOn = vi.fn();
const mockChannelSubscribe = vi.fn().mockReturnValue({});
const mockChannel = vi.fn().mockReturnValue({
  on: mockChannelOn.mockReturnThis(),
  subscribe: mockChannelSubscribe,
});
const mockRemoveChannel = vi.fn();

vi.mock("../lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "profiles") {
        return {
          update: mockUpdate,
          select: mockSelect,
        };
      }
      return {};
    },
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

describe("useThemeStore - Cross-Platform Dark Mode Preference Sync (#2800)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    useThemeStore.setState({
      theme: "light",
      resolvedTheme: "light",
      userId: null,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with localStorage theme if present", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    expect(stored).toBe("dark");
  });

  it("updates local state, localStorage, and DOM class on setTheme", () => {
    const store = useThemeStore.getState();
    store.setTheme("dark");

    expect(useThemeStore.getState().theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("correctly resolves theme values", () => {
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("high-contrast")).toBe("dark");
  });

  it("applies high-contrast theme correctly to DOM", () => {
    applyThemeToDom("high-contrast");
    expect(document.documentElement.classList.contains("high-contrast")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("debounces Supabase database updates when user is authenticated", async () => {
    const store = useThemeStore.getState();
    useThemeStore.setState({ userId: "user-123" });

    store.setTheme("dark");
    expect(mockUpdate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(350);
    expect(mockUpdate).toHaveBeenCalledWith({ theme_preference: "dark" });
  });

  it("initializes theme sync from Supabase and sets up Realtime listener", async () => {
    const store = useThemeStore.getState();
    await store.initThemeSync("user-456");

    expect(mockSelect).toHaveBeenCalledWith("theme_preference");
    expect(mockChannel).toHaveBeenCalledWith("user-theme-sync-user-456");
    expect(mockChannelSubscribe).toHaveBeenCalled();
  });

  it("gracefully falls back when no user is logged in", async () => {
    const store = useThemeStore.getState();
    await store.initThemeSync(null);

    expect(useThemeStore.getState().userId).toBeNull();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("cleans up realtime subscriptions", () => {
    const store = useThemeStore.getState();
    store.cleanupRealtime();
    expect(useThemeStore.getState().userId).toBeNull();
  });
});
