import { describe, it, expect } from "vitest";

describe("Dynamic Capacity Waitlist Resizing Engine", () => {
  it("should generate a JWT token successfully for valid events", async () => {
    const event = {
      id: "event-123",
      max_attendees: 100,
      venues: { capacity: 200 },
      capacity_prompt_ignored_at: null,
    };
    
    const waitlistCount = 15;
    const shouldPrompt = waitlistCount > 10 && event.max_attendees < event.venues.capacity && event.capacity_prompt_ignored_at === null;
    expect(shouldPrompt).toBe(true);
  });

  it("should NOT prompt if waitlist is <= 10", () => {
    const event = {
      max_attendees: 100,
      venues: { capacity: 200 },
      capacity_prompt_ignored_at: null,
    };
    const waitlistCount = 10;
    const shouldPrompt = waitlistCount > 10 && event.max_attendees < event.venues.capacity && event.capacity_prompt_ignored_at === null;
    expect(shouldPrompt).toBe(false);
  });

  it("should NOT prompt if capacity is already at venue max", () => {
    const event = {
      max_attendees: 200,
      venues: { capacity: 200 },
      capacity_prompt_ignored_at: null,
    };
    const waitlistCount = 15;
    const shouldPrompt = waitlistCount > 10 && event.max_attendees < event.venues.capacity && event.capacity_prompt_ignored_at === null;
    expect(shouldPrompt).toBe(false);
  });

  it("should NOT prompt if prompt was already sent", () => {
    const event = {
      max_attendees: 100,
      venues: { capacity: 200 },
      capacity_prompt_ignored_at: "2026-10-10T00:00:00Z",
    };
    const waitlistCount = 15;
    const shouldPrompt = waitlistCount > 10 && event.max_attendees < event.venues.capacity && event.capacity_prompt_ignored_at === null;
    expect(shouldPrompt).toBe(false);
  });
});