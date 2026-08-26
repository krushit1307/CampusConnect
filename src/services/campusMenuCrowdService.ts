/**
 * Campus Menu Crowd Service
 *
 * Provides real-time scraping/API ingestion of university dining hall menus,
 * multi-tier caching (Redis 24-hr TTL + in-memory fallback), crowd-sourced voting,
 * nutritional tracking, and informal menu-linked meetups (#3933).
 */

export interface DiningHall {
  id: string;
  name: string;
  slug: string;
  campusZone: string;
  locationLat: number;
  locationLng: number;
  capacity: number;
  openTime: string;
  closeTime: string;
  isActive: boolean;
}

export type MealPeriod = "breakfast" | "lunch" | "dinner" | "late_night";

export interface MenuItem {
  id: string;
  diningMenuId?: string;
  name: string;
  description: string;
  stationName: string;
  category: "Entree" | "Side" | "Salad" | "Soup" | "Dessert" | "Beverage" | "Special";
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  allergens: string[];
  dietaryFlags: string[];
  upvotesCount: number;
  downvotesCount: number;
  crowdRating: number; // 0 to 5.0 scale
  isAvailable: boolean;
}

export interface DiningMenu {
  id: string;
  diningHallId: string;
  diningHallName?: string;
  menuDate: string; // YYYY-MM-DD
  mealPeriod: MealPeriod;
  scrapedAt: string;
  expiresAt: string;
  isCached: boolean;
  items: MenuItem[];
}

export interface MenuItemVote {
  id: string;
  menuItemId: string;
  userId: string;
  voteType: "UP" | "DOWN";
  comment?: string;
  createdAt: string;
}

export interface InformalDiningMeetup {
  id: string;
  menuItemId: string;
  menuItemName: string;
  diningHallId: string;
  diningHallName: string;
  hostUserId: string;
  hostName: string;
  title: string;
  description: string;
  meetupTime: string;
  maxParticipants: number;
  currentParticipants: number;
  tableLocation: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  attendees: {
    userId: string;
    userName: string;
    rsvpStatus: "CONFIRMED" | "WAITLIST";
    joinedAt: string;
  }[];
  createdAt: string;
}

export interface RedisCacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<unknown>;
  del(key: string): Promise<number>;
}

// In-memory cache fallback simulation
class InMemoryCacheStore implements RedisCacheStore {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, _mode?: string, ttlSeconds = 86400): Promise<boolean> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  clear(): void {
    this.store.clear();
  }
}

export class CampusMenuCrowdService {
  private static redisClient: RedisCacheStore = new InMemoryCacheStore();
  private static CACHE_TTL_SECONDS = 86400; // 24-hour TTL

  // Internal Mock Database for runtime simulation / fallback
  private static diningHalls: DiningHall[] = [
    {
      id: "hall-north-01",
      name: "North Dining Hall",
      slug: "north-dining-hall",
      campusZone: "North Quad",
      locationLat: 41.7032,
      locationLng: -86.2391,
      capacity: 650,
      openTime: "07:00",
      closeTime: "22:00",
      isActive: true,
    },
    {
      id: "hall-south-02",
      name: "South Dining Hall",
      slug: "south-dining-hall",
      campusZone: "South Quad",
      locationLat: 41.6985,
      locationLng: -86.2374,
      capacity: 800,
      openTime: "07:00",
      closeTime: "23:00",
      isActive: true,
    },
    {
      id: "hall-quad-03",
      name: "Quad Commons Bistro",
      slug: "quad-commons-bistro",
      campusZone: "Central Plaza",
      locationLat: 41.7011,
      locationLng: -86.2355,
      capacity: 400,
      openTime: "08:00",
      closeTime: "21:00",
      isActive: true,
    },
  ];

  private static menuDatabase = new Map<string, DiningMenu>();
  private static userVotes = new Map<string, MenuItemVote>();
  private static meetups = new Map<string, InformalDiningMeetup>();

  static setRedisClient(client: RedisCacheStore): void {
    this.redisClient = client;
  }

  static getDiningHalls(): DiningHall[] {
    return [...this.diningHalls];
  }

  static getDiningHallById(hallId: string): DiningHall | undefined {
    return this.diningHalls.find((h) => h.id === hallId || h.slug === hallId);
  }

  /**
   * Scrapes/Fetches daily menu from the University Dining Portal.
   * Leverages 24-hour Redis caching layer.
   */
  static async getDailyMenu(
    diningHallId: string,
    menuDate: string = new Date().toISOString().split("T")[0],
    mealPeriod: MealPeriod = "lunch",
  ): Promise<DiningMenu> {
    const cacheKey = `campus_menu:${diningHallId}:${menuDate}:${mealPeriod}`;

    // 1. Try Redis cache (24h TTL)
    const cachedData = await this.redisClient.get(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData) as DiningMenu;
        parsed.isCached = true;
        return parsed;
      } catch (err) {
        console.warn("Failed to parse cached menu data, falling back to live fetch:", err);
      }
    }

    // 2. Fetch / Scrape from source
    const menu = this.scrapeUniversityDiningPortal(diningHallId, menuDate, mealPeriod);

    // 3. Store in Redis with 24-hour TTL
    await this.redisClient.set(cacheKey, JSON.stringify(menu), "EX", this.CACHE_TTL_SECONDS);

    return menu;
  }

  /**
   * Simulated University Dining Portal Scraper
   */
  private static scrapeUniversityDiningPortal(
    diningHallId: string,
    menuDate: string,
    mealPeriod: MealPeriod,
  ): DiningMenu {
    const hall = this.getDiningHallById(diningHallId) || this.diningHalls[0];
    const menuId = `menu-${diningHallId}-${menuDate}-${mealPeriod}`;

    const existing = this.menuDatabase.get(menuId);
    if (existing) {
      return existing;
    }

    // Generate realistic scraped campus dishes
    const items: MenuItem[] = [
      {
        id: `item-${diningHallId}-1`,
        diningMenuId: menuId,
        name:
          hall.id === "hall-south-02"
            ? "Crispy Golden Chicken Nuggets"
            : "Artisan Grilled Chicken Breast",
        description:
          "Freshly battered tender chicken with signature house-blend honey mustard dipping sauce.",
        stationName: "Homestyle & Grille",
        category: "Entree",
        calories: 420,
        proteinG: 34.0,
        carbsG: 18.0,
        fatG: 22.0,
        allergens: ["Gluten"],
        dietaryFlags: ["High-Protein", "Halal"],
        upvotesCount: 84,
        downvotesCount: 4,
        crowdRating: 4.77,
        isAvailable: true,
      },
      {
        id: `item-${diningHallId}-2`,
        diningMenuId: menuId,
        name: "Wild Mushroom & Truffle Cream Pasta",
        description:
          "Al dente penne folded in roasted cremini mushrooms, garlic herb cream, and shaved parmesan.",
        stationName: "Trattoria Corner",
        category: "Entree",
        calories: 540,
        proteinG: 16.0,
        carbsG: 68.0,
        fatG: 24.0,
        allergens: ["Gluten", "Dairy"],
        dietaryFlags: ["Vegetarian"],
        upvotesCount: 62,
        downvotesCount: 8,
        crowdRating: 4.43,
        isAvailable: true,
      },
      {
        id: `item-${diningHallId}-3`,
        diningMenuId: menuId,
        name: "Organic Sweet Potato & Black Bean Bowl",
        description:
          "Charred sweet potato wedges, cilantro lime quinoa, avocado salsa, and seasoned black beans.",
        stationName: "Root & Harvest (Plant-Based)",
        category: "Entree",
        calories: 380,
        proteinG: 14.0,
        carbsG: 62.0,
        fatG: 9.0,
        allergens: [],
        dietaryFlags: ["Vegan", "Gluten-Free", "High-Fiber"],
        upvotesCount: 48,
        downvotesCount: 3,
        crowdRating: 4.71,
        isAvailable: true,
      },
      {
        id: `item-${diningHallId}-4`,
        diningMenuId: menuId,
        name: "Waffle Bar with Pure Maple Syrup",
        description:
          "Belgian golden waffles served with berry compote, chocolate chips, and fresh whipped cream.",
        stationName: "Bakery & Sweets",
        category: "Dessert",
        calories: 360,
        proteinG: 6.0,
        carbsG: 52.0,
        fatG: 14.0,
        allergens: ["Gluten", "Dairy", "Egg"],
        dietaryFlags: ["Vegetarian"],
        upvotesCount: 95,
        downvotesCount: 2,
        crowdRating: 4.9,
        isAvailable: true,
      },
    ];

    const menu: DiningMenu = {
      id: menuId,
      diningHallId: hall.id,
      diningHallName: hall.name,
      menuDate,
      mealPeriod,
      scrapedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.CACHE_TTL_SECONDS * 1000).toISOString(),
      isCached: false,
      items,
    };

    this.menuDatabase.set(menuId, menu);
    return menu;
  }

  /**
   * Vote on a menu item (Upvote or Downvote)
   */
  static async voteMenuItem(
    menuItemId: string,
    userId: string,
    voteType: "UP" | "DOWN",
    comment?: string,
  ): Promise<{ item: MenuItem; userVote: MenuItemVote }> {
    const voteKey = `${menuItemId}:${userId}`;
    const previousVote = this.userVotes.get(voteKey);

    // Locate menu item
    let targetItem: MenuItem | null = null;
    for (const menu of this.menuDatabase.values()) {
      const found = menu.items.find((i) => i.id === menuItemId);
      if (found) {
        targetItem = found;
        break;
      }
    }

    if (!targetItem) {
      throw new Error(`Menu item not found: ${menuItemId}`);
    }

    // Adjust counts
    if (previousVote) {
      if (previousVote.voteType === "UP")
        targetItem.upvotesCount = Math.max(0, targetItem.upvotesCount - 1);
      if (previousVote.voteType === "DOWN")
        targetItem.downvotesCount = Math.max(0, targetItem.downvotesCount - 1);
    }

    if (voteType === "UP") {
      targetItem.upvotesCount += 1;
    } else {
      targetItem.downvotesCount += 1;
    }

    // Calculate rating out of 5
    const total = targetItem.upvotesCount + targetItem.downvotesCount;
    if (total > 0) {
      targetItem.crowdRating = Number(((targetItem.upvotesCount / total) * 5.0).toFixed(2));
    }

    const vote: MenuItemVote = {
      id: `vote-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      menuItemId,
      userId,
      voteType,
      comment,
      createdAt: new Date().toISOString(),
    };
    this.userVotes.set(voteKey, vote);

    return { item: targetItem, userVote: vote };
  }

  /**
   * Filter menu items by dietary and allergen preferences
   */
  static filterMenuItems(
    items: MenuItem[],
    filters: {
      dietaryFlags?: string[];
      excludeAllergens?: string[];
      category?: string;
      searchQuery?: string;
    },
  ): MenuItem[] {
    return items.filter((item) => {
      // Search query
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesStation = item.stationName.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesStation) return false;
      }

      // Category
      if (filters.category && filters.category !== "All" && item.category !== filters.category) {
        return false;
      }

      // Dietary Flags (must have all requested dietary flags)
      if (filters.dietaryFlags && filters.dietaryFlags.length > 0) {
        const hasAllDietary = filters.dietaryFlags.every((flag) =>
          item.dietaryFlags.map((d) => d.toLowerCase()).includes(flag.toLowerCase()),
        );
        if (!hasAllDietary) return false;
      }

      // Exclude Allergens (cannot contain any excluded allergen)
      if (filters.excludeAllergens && filters.excludeAllergens.length > 0) {
        const hasExcludedAllergen = filters.excludeAllergens.some((allergen) =>
          item.allergens.map((a) => a.toLowerCase()).includes(allergen.toLowerCase()),
        );
        if (hasExcludedAllergen) return false;
      }

      return true;
    });
  }

  /**
   * Create an informal meetup centered around a specific dish/menu item
   */
  static async createInformalMeetup(params: {
    menuItemId: string;
    menuItemName: string;
    diningHallId: string;
    hostUserId: string;
    hostName: string;
    title: string;
    description: string;
    meetupTime: string;
    maxParticipants?: number;
    tableLocation?: string;
  }): Promise<InformalDiningMeetup> {
    const hall = this.getDiningHallById(params.diningHallId);
    const meetupId = `meetup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const meetup: InformalDiningMeetup = {
      id: meetupId,
      menuItemId: params.menuItemId,
      menuItemName: params.menuItemName,
      diningHallId: params.diningHallId,
      diningHallName: hall ? hall.name : "Dining Hall",
      hostUserId: params.hostUserId,
      hostName: params.hostName,
      title: params.title,
      description: params.description,
      meetupTime: params.meetupTime,
      maxParticipants: params.maxParticipants || 8,
      currentParticipants: 1,
      tableLocation: params.tableLocation || "Main Dining Area",
      status: "ACTIVE",
      attendees: [
        {
          userId: params.hostUserId,
          userName: params.hostName,
          rsvpStatus: "CONFIRMED",
          joinedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    this.meetups.set(meetupId, meetup);
    return meetup;
  }

  /**
   * RSVP to an informal meetup
   */
  static async rsvpToMeetup(
    meetupId: string,
    userId: string,
    userName: string,
  ): Promise<InformalDiningMeetup> {
    const meetup = this.meetups.get(meetupId);
    if (!meetup) {
      throw new Error(`Meetup with id ${meetupId} not found`);
    }

    const existingIndex = meetup.attendees.findIndex((a) => a.userId === userId);
    if (existingIndex >= 0) {
      return meetup; // Already RSVPed
    }

    const isWaitlist = meetup.attendees.length >= meetup.maxParticipants;
    meetup.attendees.push({
      userId,
      userName,
      rsvpStatus: isWaitlist ? "WAITLIST" : "CONFIRMED",
      joinedAt: new Date().toISOString(),
    });

    meetup.currentParticipants = meetup.attendees.filter(
      (a) => a.rsvpStatus === "CONFIRMED",
    ).length;
    return meetup;
  }

  /**
   * Leave / Cancel RSVP to a meetup
   */
  static async leaveMeetup(meetupId: string, userId: string): Promise<InformalDiningMeetup> {
    const meetup = this.meetups.get(meetupId);
    if (!meetup) {
      throw new Error(`Meetup with id ${meetupId} not found`);
    }

    meetup.attendees = meetup.attendees.filter((a) => a.userId !== userId);

    // Promote first waitlisted member if space freed up
    const confirmedCount = meetup.attendees.filter((a) => a.rsvpStatus === "CONFIRMED").length;
    if (confirmedCount < meetup.maxParticipants) {
      const firstWaitlist = meetup.attendees.find((a) => a.rsvpStatus === "WAITLIST");
      if (firstWaitlist) {
        firstWaitlist.rsvpStatus = "CONFIRMED";
      }
    }

    meetup.currentParticipants = meetup.attendees.filter(
      (a) => a.rsvpStatus === "CONFIRMED",
    ).length;
    return meetup;
  }

  /**
   * Get active meetups for a dining hall or menu item
   */
  static getActiveMeetups(diningHallId?: string, menuItemId?: string): InformalDiningMeetup[] {
    return Array.from(this.meetups.values()).filter((m) => {
      if (m.status !== "ACTIVE") return false;
      if (diningHallId && m.diningHallId !== diningHallId) return false;
      if (menuItemId && m.menuItemId !== menuItemId) return false;
      return true;
    });
  }

  /**
   * Reset in-memory cache and state (primarily for test cleanup)
   */
  static resetState(): void {
    this.menuDatabase.clear();
    this.userVotes.clear();
    this.meetups.clear();
    if (this.redisClient instanceof InMemoryCacheStore) {
      this.redisClient.clear();
    }
  }
}
