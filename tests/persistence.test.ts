import { describe, it, expect, beforeEach } from "vitest";
import {
  saveWizardState,
  loadWizardState,
  clearWizardState,
} from "../src/utils/sessionPersistence";

describe("session persistence", () => {
  beforeEach(() => {
    clearWizardState();
  });

  it("saves and loads state correctly", () => {
    const mockContext = {
      formData: {
        title: "Test",
        description: "",
        category: "",
        isPaid: false,
        startDate: "",
        endDate: "",
        tags: [],
      },
      validationErrors: {},
      currentStep: 0,
    };

    saveWizardState("location", mockContext);

    const loaded = loadWizardState();
    expect(loaded?.stateValue).toBe("location");
    expect(loaded?.context.formData.title).toBe("Test");
  });

  it("returns null if empty", () => {
    expect(loadWizardState()).toBeNull();
  });
});
