// src/components/EventScheduler/EventScheduler.cy.tsx
import React from "react";
import { EventScheduler, ScheduledEvent } from "./EventScheduler";
import { addDays, setHours, setMinutes, addHours, format } from "date-fns";

describe("<EventScheduler />", () => {
  const baseDate = setMinutes(setHours(addDays(new Date(), 1), 10), 0);

  const mockEvents: ScheduledEvent[] = [
    {
      id: "evt-1",
      title: "React Workshop",
      startTime: baseDate,
      endTime: addHours(baseDate, 2),
      color: "#3b82f6",
    },
    {
      id: "evt-2",
      title: "Design Review",
      startTime: addHours(baseDate, 4),
      endTime: addHours(baseDate, 5),
      color: "#10b981",
    },
  ];

  let onSaveSpy: Cypress.Agent<sinon.SinonSpy>;
  let onErrorSpy: Cypress.Agent<sinon.SinonSpy>;

  beforeEach(() => {
    onSaveSpy = cy.spy().as("onSaveSpy");
    onErrorSpy = cy.spy().as("onErrorSpy");

    cy.mount(<EventScheduler initialEvents={mockEvents} onSave={onSaveSpy} onError={onErrorSpy} />);
  });

  it("renders the scheduler container and header correctly", () => {
    cy.get('[data-testid="event-scheduler"]').should("be.visible");
    cy.contains("Weekly Schedule").should("be.visible");
    cy.contains("React Workshop").should("be.visible");
    cy.contains("Design Review").should("be.visible");
  });

  it("renders events at the correct visual vertical offset based on start time", () => {
    // evt-1 starts at 10:00. 10 * 64px = 640px top offset
    cy.get('[data-testid="event-block-evt-1"]').should("have.css", "top", "640px");

    // evt-2 starts at 14:00. 14 * 64px = 896px top offset
    cy.get('[data-testid="event-block-evt-2"]').should("have.css", "top", "896px");
  });

  it("calculates and applies correct height based on event duration", () => {
    // evt-1 is 2 hours long. 2 * 64px = 128px
    cy.get('[data-testid="event-block-evt-1"]').should("have.css", "height", "128px");

    // evt-2 is 1 hour long. 1 * 64px = 64px
    cy.get('[data-testid="event-block-evt-2"]').should("have.css", "height", "64px");
  });

  it("updates internal state and fires onSave callback when an event is dragged to a new time slot", () => {
    const targetDay = format(baseDate, "yyyy-MM-dd");

    // Drag evt-1 from 10:00 down by 2 hours (to 12:00)
    // 2 hours = 128px offset
    cy.get('[data-testid="event-block-evt-1"]').dragAndDrop(0, 128);

    // Verify the callback was fired exactly once
    cy.get("@onSaveSpy").should("have.been.calledOnce");

    // Verify the payload contains the updated timestamp
    cy.get("@onSaveSpy").should((spy) => {
      const calls = (spy as any).getCalls();
      const updatedEvents = calls[0].args[0];
      const movedEvent = updatedEvents.find((e: ScheduledEvent) => e.id === "evt-1");

      expect(movedEvent.startTime.getHours()).to.equal(12);
      expect(movedEvent.endTime.getHours()).to.equal(14);
    });
  });

  it("fires onError when attempting to drag an event into the past", () => {
    // This is a complex edge case. We simulate dragging to a slot that represents a past date.
    // Since the UI renders the current week, we'd need to mock the system date or navigate back.
    // For this test, we simulate the internal validation failure.
    cy.get('[data-testid="event-block-evt-1"]')
      .trigger("mousedown", { button: 0, force: true })
      .trigger("mousemove", { clientY: -1000, force: true }) // Drag way up (past)
      .trigger("mouseup", { force: true });

    // Depending on the exact drop zone calculation, onError might fire.
    // If the UI restricts drops to valid future zones, the drop simply won't register.
    cy.get("@onErrorSpy").should("have.been.calledWith", "Cannot schedule events in the past");
  });

  it("navigates to the next week when the forward arrow is clicked", () => {
    const currentWeekText = format(addDays(new Date(), 7), "MMM d"); // Rough approximation

    cy.contains("button", "ChevronRight").parent().click();

    // The header should update to show the next week's dates
    cy.get("header").invoke("text").should("not.include", format(new Date(), "MMM d"));
  });

  it("maintains event duration when dragged to a new day", () => {
    // Drag evt-1 to the next day column (approx 200px right)
    cy.get('[data-testid="event-block-evt-1"]').dragAndDrop(200, 0);

    cy.get("@onSaveSpy").should((spy) => {
      const calls = (spy as any).getCalls();
      const updatedEvents = calls[0].args[0];
      const movedEvent = updatedEvents.find((e: ScheduledEvent) => e.id === "evt-1");

      // Duration should still be 2 hours
      const duration = movedEvent.endTime.getTime() - movedEvent.startTime.getTime();
      expect(duration).to.equal(2 * 60 * 60 * 1000);
    });
  });
});
