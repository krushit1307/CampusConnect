import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  globalState,
  userSignal,
  themeSignal,
  notificationsCountSignal,
  unreadMessagesCountSignal,
  activeTabSignal,
  setUser,
  setTheme,
  setNotificationsCount,
  setUnreadMessagesCount,
  setActiveTab,
  resetGlobalState,
} from "./globalState";
import { createEffect } from "../lib/signals";

describe("globalState store", () => {
  beforeEach(() => {
    resetGlobalState();
  });

  it("updates theme fine-grainedly", () => {
    const fn = vi.fn();
    createEffect(() => {
      fn(themeSignal());
    });

    expect(fn).toHaveBeenLastCalledWith("light");
    expect(globalState.theme).toBe("light");

    setTheme("dark");
    expect(fn).toHaveBeenLastCalledWith("dark");
    expect(themeSignal()).toBe("dark");
    expect(globalState.theme).toBe("dark");
  });

  it("updates user profile fine-grainedly", () => {
    const fn = vi.fn();
    createEffect(() => {
      fn(userSignal());
    });

    expect(fn).toHaveBeenLastCalledWith(null);

    const mockUser = {
      id: "u1",
      name: "Alex",
      email: "alex@example.com",
      role: "student",
    };

    setUser(mockUser);
    expect(fn).toHaveBeenLastCalledWith(mockUser);
    expect(globalState.user).toEqual(mockUser);
  });

  it("updates notification counts and active tab fine-grainedly", () => {
    const notifFn = vi.fn();
    const tabFn = vi.fn();

    createEffect(() => {
      notifFn(notificationsCountSignal());
    });

    createEffect(() => {
      tabFn(activeTabSignal());
    });

    setNotificationsCount(5);
    expect(notifFn).toHaveBeenLastCalledWith(5);
    expect(tabFn).toHaveBeenCalledTimes(1);

    setActiveTab("events");
    expect(tabFn).toHaveBeenLastCalledWith("events");
    expect(notifFn).toHaveBeenCalledTimes(2);

    setUnreadMessagesCount(3);
    expect(unreadMessagesCountSignal()).toBe(3);
    expect(globalState.unreadMessagesCount).toBe(3);
  });

  it("resets global state to initial values", () => {
    setTheme("dark");
    setNotificationsCount(12);
    setActiveTab("settings");

    expect(globalState.theme).toBe("dark");
    expect(globalState.notificationsCount).toBe(12);

    resetGlobalState();

    expect(globalState.theme).toBe("light");
    expect(globalState.notificationsCount).toBe(0);
    expect(globalState.activeTab).toBe("overview");
    expect(globalState.user).toBeNull();
  });
});
