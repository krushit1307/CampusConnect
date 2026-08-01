import { describe, it, expect, beforeEach, vi } from "vitest";
import { useExperimentStore } from "./useExperimentStore";

describe("useExperimentStore", () => {
  beforeEach(() => {
    // Clear localStorage and reset Zustand store state
    localStorage.clear();
    useExperimentStore.setState({ variant: null });
  });

  it("assigns a random variant ('A' or 'B') on first initialization", () => {
    const store = useExperimentStore.getState();
    expect(store.variant).toBeNull();

    const assigned = store.initializeVariant();
    expect(assigned).toMatch(/^[AB]$/);
    expect(useExperimentStore.getState().variant).toBe(assigned);
  });

  it("returns existing variant on subsequent initializations without re-rolling", () => {
    const firstAssigned = useExperimentStore.getState().initializeVariant();
    const secondAssigned = useExperimentStore.getState().initializeVariant();

    expect(secondAssigned).toBe(firstAssigned);
    expect(useExperimentStore.getState().variant).toBe(firstAssigned);
  });

  it("dispatches telemetry registration event with correct variant", async () => {
    const mockDispatchEvent = vi.spyOn(window, "dispatchEvent");

    // Assign variant
    const assigned = useExperimentStore.getState().initializeVariant();

    // Track registration conversion
    useExperimentStore.getState().trackRegistration();

    // Wait for the analytics queue to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
    const lastCallArg = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
    expect(lastCallArg.type).toBe("experiment_registration");
    expect(lastCallArg.detail).toEqual({ variant: assigned });

    mockDispatchEvent.mockRestore();
  });
});
