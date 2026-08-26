import request from "supertest";
import { jest, describe, expect, it, beforeEach } from "@jest/globals";
import { createActivityPubApp } from "../src/app";
import { createActivityPubRouter } from "../src/routes";
import { createWebhookRouter } from "../src/webhook";

// Mock Supabase client in db.ts
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  rpc: jest.fn(),
};

jest.mock("../src/db", () => {
  return {
    getSupabase: () => mockSupabase,
    getClubBySlug: jest.fn(),
    getOrCreateClubKeys: jest.fn(),
    getFollowers: jest.fn(),
    getClubEvents: jest.fn(),
    saveInboxItem: jest.fn(),
  };
});

describe("Cosine Similarity Recommendations API", () => {
  const app = createActivityPubApp({
    activityPubRouter: createActivityPubRouter(),
    webhookRouter: createWebhookRouter(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fail with 401 if authorization header is missing", async () => {
    const res = await request(app).get("/api/activitypub/users/me/recommendations").expect(401);

    expect(res.body.error).toBe("Unauthorized");
  });

  it("should fail with 401 if authorization header format is invalid", async () => {
    const res = await request(app)
      .get("/api/activitypub/users/me/recommendations")
      .set("Authorization", "InvalidFormat token123")
      .expect(401);

    expect(res.body.error).toBe("Unauthorized");
  });

  it("should fail with 401 if getUser returns authentication error", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid user token", status: 401 } as any,
    });

    const res = await request(app)
      .get("/api/activitypub/users/me/recommendations")
      .set("Authorization", "Bearer token-invalid")
      .expect(401);

    expect(res.body.error).toBe("Unauthorized");
  });

  it("should successfully fetch cosine recommendations for authenticated user", async () => {
    const mockUser = { id: "user-uuid-123", email: "test@example.com" };
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockRecommendations = [
      {
        id: "club-uuid-a",
        name: "Club A (Tech & Coding)",
        description: "Focuses on tech and programming",
        logo_url: "logo_a.png",
        club_tags: ["Technology", "Programming"],
        score: 0.816,
      },
      {
        id: "club-uuid-b",
        name: "Club B (Music & Art)",
        description: "Focuses on music and arts",
        logo_url: "logo_b.png",
        club_tags: ["Music", "Art"],
        score: 0.0,
      },
    ];

    mockSupabase.rpc.mockResolvedValue({
      data: mockRecommendations,
      error: null,
    });

    const res = await request(app)
      .get("/api/activitypub/users/me/recommendations")
      .set("Authorization", "Bearer token-valid")
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe("club-uuid-a");
    expect(res.body[0].score).toBeGreaterThan(0.8);
    expect(res.body[1].id).toBe("club-uuid-b");
    expect(res.body[1].score).toBe(0.0);

    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_cosine_recommendations", {
      p_user_id: "user-uuid-123",
      p_limit: 5,
    });
  });
});
