// tests/eventWizard.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  useEventWizardStore,
  validateStep,
  validateMaster,
} from "../src/store/useEventWizardStore";
import {
  basicsStepSchema,
  dateLocationStepSchema,
  ticketingStepSchema,
  customizationsStepSchema,
  eventWizardMasterSchema,
  DEFAULT_EVENT_WIZARD_DATA,
  WIZARD_STEPS,
} from "../src/lib/eventWizardSchema";

describe("Event Wizard — Step Schemas", () => {
  it("basicsStepSchema requires title >= 3 chars and description >= 20 chars", () => {
    const invalid = basicsStepSchema.safeParse({
      title: "ab",
      description: "short",
      category: "",
      tags: [],
    });
    expect(invalid.success).toBe(false);

    const valid = basicsStepSchema.safeParse({
      title: "Tech Talk",
      description: "A deep dive into modern web architecture.",
      category: "Technology",
      tags: ["web", "architecture"],
    });
    expect(valid.success).toBe(true);
  });

  it("dateLocationStepSchema requires endDate > startDate", () => {
    const invalid = dateLocationStepSchema.safeParse({
      startDate: "2026-08-10T10:00",
      endDate: "2026-08-09T10:00", // before start
      location: "Room 101",
      isVirtual: false,
      meetingUrl: "",
      capacity: 50,
    });
    expect(invalid.success).toBe(false);

    const valid = dateLocationStepSchema.safeParse({
      startDate: "2026-08-09T10:00",
      endDate: "2026-08-10T10:00",
      location: "Room 101",
      isVirtual: false,
      meetingUrl: "",
      capacity: 50,
    });
    expect(valid.success).toBe(true);
  });

  it("dateLocationStepSchema requires meetingUrl for virtual events", () => {
    const invalid = dateLocationStepSchema.safeParse({
      startDate: "2026-08-09T10:00",
      endDate: "2026-08-10T10:00",
      location: "Online",
      isVirtual: true,
      meetingUrl: "",
      capacity: 100,
    });
    expect(invalid.success).toBe(false);
  });

  it("ticketingStepSchema requires at least one tier for paid events", () => {
    const invalid = ticketingStepSchema.safeParse({
      isPaid: true,
      tickets: [],
    });
    expect(invalid.success).toBe(false);

    const valid = ticketingStepSchema.safeParse({
      isPaid: false,
      tickets: [],
    });
    expect(valid.success).toBe(true);
  });

  it("ticketingStepSchema enforces unique tier names", () => {
    const invalid = ticketingStepSchema.safeParse({
      isPaid: true,
      tickets: [
        { name: "Early Bird", price: 10, capacity: 50, isEarlyBird: false, isActive: true },
        { name: "early bird", price: 20, capacity: 50, isEarlyBird: false, isActive: true },
      ],
    });
    expect(invalid.success).toBe(false);
  });

  it("customizationsStepSchema validates banner color hex", () => {
    const invalid = customizationsStepSchema.safeParse({
      coverImageUrl: "",
      bannerColor: "not-a-hex",
      isFeatured: false,
      allowWaitlist: true,
      sendReminderEmails: true,
    });
    expect(invalid.success).toBe(false);

    const valid = customizationsStepSchema.safeParse({
      coverImageUrl: "",
      bannerColor: "#6366f1",
      isFeatured: false,
      allowWaitlist: true,
      sendReminderEmails: true,
    });
    expect(valid.success).toBe(true);
  });
});

describe("Event Wizard — Master Schema", () => {
  it("rejects an empty form", () => {
    const result = eventWizardMasterSchema.safeParse(DEFAULT_EVENT_WIZARD_DATA);
    expect(result.success).toBe(false);
  });

  it("accepts a fully valid form", () => {
    const validData = {
      title: "Tech Symposium 2026",
      description: "A full-day symposium on emerging technologies and student research.",
      category: "Technology",
      tags: ["ai", "web"],
      startDate: "2026-08-09T10:00",
      endDate: "2026-08-10T18:00",
      location: "Main Auditorium",
      isVirtual: false,
      meetingUrl: "",
      capacity: 200,
      isPaid: true,
      tickets: [
        {
          name: "Early Bird",
          price: 5,
          capacity: 50,
          isEarlyBird: true,
          earlyBirdEndDate: "2026-08-01T23:59",
          isActive: true,
        },
        { name: "General", price: 10, capacity: 150, isEarlyBird: false, isActive: true },
      ],
      coverImageUrl: "",
      bannerColor: "#6366f1",
      isFeatured: true,
      allowWaitlist: true,
      sendReminderEmails: true,
    };
    const result = eventWizardMasterSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe("Event Wizard — Store", () => {
  beforeEach(() => {
    // Reset the store between tests.
    useEventWizardStore.getState().resetWizard();
  });

  it("starts at step 0 with default form data", () => {
    const state = useEventWizardStore.getState();
    expect(state.step).toBe(0);
    expect(state.formData).toEqual(DEFAULT_EVENT_WIZARD_DATA);
    expect(state.isComplete).toBe(false);
  });

  it("does not advance to next step when current step is invalid", () => {
    const store = useEventWizardStore.getState();
    store.next(); // basics step is invalid (empty title)
    expect(useEventWizardStore.getState().step).toBe(0);
    expect(Object.keys(useEventWizardStore.getState().validationErrors).length).toBeGreaterThan(0);
  });

  it("advances to next step when current step is valid", () => {
    const store = useEventWizardStore.getState();
    store.updateFormData({
      title: "Tech Talk",
      description: "A deep dive into modern web architecture.",
      category: "Technology",
      tags: ["web"],
    });
    store.next();
    expect(useEventWizardStore.getState().step).toBe(1);
  });

  it("goToStep clamps to valid range", () => {
    const store = useEventWizardStore.getState();
    store.goToStep(100);
    expect(useEventWizardStore.getState().step).toBe(WIZARD_STEPS.length - 1);
    store.goToStep(-5);
    expect(useEventWizardStore.getState().step).toBe(0);
  });

  it("resetWizard restores initial state", () => {
    const store = useEventWizardStore.getState();
    store.updateFormData({ title: "Temp" });
    store.goToStep(2);
    store.resetWizard();
    const state = useEventWizardStore.getState();
    expect(state.step).toBe(0);
    expect(state.formData.title).toBe("");
    expect(state.isComplete).toBe(false);
  });

  it("canAdvance returns false when current step is invalid", () => {
    const store = useEventWizardStore.getState();
    expect(store.canAdvance()).toBe(false);
  });

  it("canAdvance returns true when current step is valid", () => {
    const store = useEventWizardStore.getState();
    store.updateFormData({
      title: "Tech Talk",
      description: "A deep dive into modern web architecture.",
      category: "Technology",
      tags: [],
    });
    expect(store.canAdvance()).toBe(true);
  });
});

describe("Event Wizard — validateStep and validateMaster helpers", () => {
  it("validateStep returns no errors for a valid step", () => {
    const formData = {
      ...DEFAULT_EVENT_WIZARD_DATA,
      title: "Tech Talk",
      description: "A deep dive into modern web architecture.",
      category: "Technology",
      tags: [],
    };
    const { errors, isValid } = validateStep(0, formData);
    expect(isValid).toBe(true);
    expect(Object.keys(errors).length).toBe(0);
  });

  it("validateStep returns errors for an invalid step", () => {
    const { errors, isValid } = validateStep(0, DEFAULT_EVENT_WIZARD_DATA);
    expect(isValid).toBe(false);
    expect(errors.title).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.category).toBeDefined();
  });

  it("validateMaster returns errors for empty form", () => {
    const { isValid } = validateMaster(DEFAULT_EVENT_WIZARD_DATA);
    expect(isValid).toBe(false);
  });
});
