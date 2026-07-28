import { describe, it, expect, beforeEach } from "vitest";
import { useNotificationStore, toast } from "./useNotificationStore";

describe("useNotificationStore", () => {
  beforeEach(() => {
    useNotificationStore.getState().clearToasts();
  });

  it("adds a toast to the store", () => {
    const id = toast({ title: "Test Toast", type: "success" });
    const toasts = useNotificationStore.getState().toasts;

    expect(toasts).toHaveLength(1);
    expect(toasts[0].id).toBe(id);
    expect(toasts[0].title).toBe("Test Toast");
  });

  it("removes a toast by ID", () => {
    const id1 = toast({ title: "Toast 1" });
    const id2 = toast({ title: "Toast 2" });

    useNotificationStore.getState().removeToast(id1);
    const toasts = useNotificationStore.getState().toasts;

    expect(toasts).toHaveLength(1);
    expect(toasts[0].id).toBe(id2);
  });

  it("clears all toasts", () => {
    toast({ title: "Toast 1" });
    toast({ title: "Toast 2" });

    useNotificationStore.getState().clearToasts();
    expect(useNotificationStore.getState().toasts).toHaveLength(0);
  });
});
