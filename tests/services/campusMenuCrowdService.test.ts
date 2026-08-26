import { describe, it, expect, beforeEach } from "vitest";
import {
  CampusMenuCrowdService,
  RedisCacheStore,
  MenuItem,
} from "../../src/services/campusMenuCrowdService";

class MockRedisClient implements RedisCacheStore {
  public store = new Map<string, { val: string; ttl: number }>();
  public getCount = 0;
  public setCount = 0;

  async get(key: string): Promise<string | null> {
    this.getCount++;
    const item = this.store.get(key);
    return item ? item.val : null;
  }

  async set(key: string, value: string, _mode?: string, ttlSeconds = 86400): Promise<boolean> {
    this.setCount++;
    this.store.set(key, { val: value, ttl: ttlSeconds });
    return true;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

describe("CampusMenuCrowdService (#3933)", () => {
  let mockRedis: MockRedisClient;

  beforeEach(() => {
    mockRedis = new MockRedisClient();
    CampusMenuCrowdService.setRedisClient(mockRedis);
    CampusMenuCrowdService.resetState();
  });

  it("should fetch dining halls correctly", () => {
    const halls = CampusMenuCrowdService.getDiningHalls();
    expect(halls.length).toBeGreaterThanOrEqual(3);
    expect(halls[0]).toHaveProperty("name");
    expect(halls[0]).toHaveProperty("capacity");
  });

  it("should scrape/fetch daily menu and cache in Redis with 24h TTL", async () => {
    const hallId = "hall-south-02";
    const date = "2026-08-25";

    // 1st request -> cache miss, calls scraper and sets Redis
    const menu1 = await CampusMenuCrowdService.getDailyMenu(hallId, date, "lunch");
    expect(menu1).toBeDefined();
    expect(menu1.items.length).toBeGreaterThan(0);
    expect(mockRedis.setCount).toBe(1);

    // 2nd request -> cache hit from Redis
    const menu2 = await CampusMenuCrowdService.getDailyMenu(hallId, date, "lunch");
    expect(menu2.isCached).toBe(true);
    expect(mockRedis.getCount).toBe(2);
  });

  it("should calculate crowd votes and Bayesian ratings dynamically", async () => {
    const menu = await CampusMenuCrowdService.getDailyMenu("hall-south-02", "2026-08-25", "lunch");
    const item = menu.items[0];
    const initialUpvotes = item.upvotesCount;

    const { item: updatedItem, userVote } = await CampusMenuCrowdService.voteMenuItem(
      item.id,
      "user-test-123",
      "UP",
      "Delicious crispiness!",
    );

    expect(updatedItem.upvotesCount).toBe(initialUpvotes + 1);
    expect(userVote.voteType).toBe("UP");
    expect(userVote.comment).toBe("Delicious crispiness!");
    expect(updatedItem.crowdRating).toBeGreaterThan(0);
  });

  it("should filter menu items by dietary flags and allergen exclusion", async () => {
    const menu = await CampusMenuCrowdService.getDailyMenu("hall-south-02", "2026-08-25", "lunch");

    // Vegan filter
    const veganItems = CampusMenuCrowdService.filterMenuItems(menu.items, {
      dietaryFlags: ["Vegan"],
    });
    expect(veganItems.every((i) => i.dietaryFlags.includes("Vegan"))).toBe(true);

    // Gluten exclusion
    const glutenFree = CampusMenuCrowdService.filterMenuItems(menu.items, {
      excludeAllergens: ["Gluten"],
    });
    expect(glutenFree.every((i) => !i.allergens.includes("Gluten"))).toBe(true);
  });

  it("should create and manage informal dining meetups linked to menu items", async () => {
    const menu = await CampusMenuCrowdService.getDailyMenu("hall-south-02", "2026-08-25", "lunch");
    const item = menu.items[0];

    const meetup = await CampusMenuCrowdService.createInformalMeetup({
      menuItemId: item.id,
      menuItemName: item.name,
      diningHallId: "hall-south-02",
      hostUserId: "user-host-1",
      hostName: "Samantha Reed",
      title: "Chicken Nugget Wednesday Squad",
      description: "Gathering for nuggets and study break!",
      meetupTime: new Date(Date.now() + 3600000).toISOString(),
      maxParticipants: 4,
      tableLocation: "Center Booth 5",
    });

    expect(meetup.id).toBeDefined();
    expect(meetup.currentParticipants).toBe(1);
    expect(meetup.attendees[0].userName).toBe("Samantha Reed");

    // RSVP secondary user
    const updated = await CampusMenuCrowdService.rsvpToMeetup(
      meetup.id,
      "user-attendee-2",
      "Bob Miller",
    );
    expect(updated.currentParticipants).toBe(2);
    expect(updated.attendees.some((a) => a.userId === "user-attendee-2")).toBe(true);

    // Filter active meetups
    const active = CampusMenuCrowdService.getActiveMeetups("hall-south-02", item.id);
    expect(active.length).toBe(1);
    expect(active[0].title).toBe("Chicken Nugget Wednesday Squad");
  });

  it("should handle waitlisting when meetup reaches maximum capacity", async () => {
    const menu = await CampusMenuCrowdService.getDailyMenu("hall-south-02", "2026-08-25", "lunch");
    const item = menu.items[0];

    const meetup = await CampusMenuCrowdService.createInformalMeetup({
      menuItemId: item.id,
      menuItemName: item.name,
      diningHallId: "hall-south-02",
      hostUserId: "user-host-1",
      hostName: "Host 1",
      title: "Small table",
      description: "2 people max table",
      meetupTime: new Date().toISOString(),
      maxParticipants: 2,
    });

    // 2nd person confirms
    await CampusMenuCrowdService.rsvpToMeetup(meetup.id, "user-2", "User 2");
    // 3rd person gets waitlisted
    const withWaitlist = await CampusMenuCrowdService.rsvpToMeetup(meetup.id, "user-3", "User 3");

    expect(withWaitlist.currentParticipants).toBe(2);
    const user3 = withWaitlist.attendees.find((a) => a.userId === "user-3");
    expect(user3?.rsvpStatus).toBe("WAITLIST");

    // When user-2 leaves, user-3 gets auto-promoted
    const afterLeave = await CampusMenuCrowdService.leaveMeetup(meetup.id, "user-2");
    const promotedUser3 = afterLeave.attendees.find((a) => a.userId === "user-3");
    expect(promotedUser3?.rsvpStatus).toBe("CONFIRMED");
  });
});
