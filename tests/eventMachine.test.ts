import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { eventCreationMachine } from "../src/machines/eventCreationMachine";

describe("eventCreationMachine", () => {
  it("starts in basics state", () => {
    const actor = createActor(eventCreationMachine).start();
    expect(actor.getSnapshot().value).toBe("basics");
  });

  it("prevents transition from basics to ticketing if invalid", () => {
    const actor = createActor(eventCreationMachine).start();
    actor.send({ type: "NEXT" });
    // Still basics because formData is empty and invalid
    expect(actor.getSnapshot().value).toBe("basics");
    expect(actor.getSnapshot().context.validationErrors.title).toBe("Title is required");
  });

  it("transitions to ticketing when basics is valid and isPaid is true", () => {
    const actor = createActor(eventCreationMachine).start();
    actor.send({
      type: "UPDATE_FORM",
      payload: {
        title: "Test",
        description: "Test",
        category: "tech",
        startDate: "2024-01-01T10:00",
        endDate: "2024-01-01T12:00",
        isPaid: true,
      },
    });
    actor.send({ type: "NEXT" });
    expect(actor.getSnapshot().value).toBe("ticketing");
  });

  it("skips ticketing when isPaid is false", () => {
    const actor = createActor(eventCreationMachine).start();
    actor.send({
      type: "UPDATE_FORM",
      payload: {
        title: "Test",
        description: "Test",
        category: "tech",
        startDate: "2024-01-01T10:00",
        endDate: "2024-01-01T12:00",
        isPaid: false,
      },
    });
    actor.send({ type: "NEXT" });
    // Should skip ticketing and go directly to location
    expect(actor.getSnapshot().value).toBe("location");
  });
});
