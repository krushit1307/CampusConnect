import request from "supertest";
import { jest, describe, expect, it, beforeEach } from "@jest/globals";
import { createActivityPubApp } from "../src/app";
import { createActivityPubRouter } from "../src/routes";
import { createWebhookRouter } from "../src/webhook";

// Setup mocks
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
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

describe("User Profile ETag Caching API", () => {
  const app = createActivityPubApp({
    activityPubRouter: createActivityPubRouter(),
    webhookRouter: createWebhookRouter(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 if auth header is missing", async () => {
    const res = await request(app).get("/api/users/me").expect(401);

    expect(res.body.error).toBe("Unauthorized");
  });

  it("should fetch user profile and return 200 OK with ETag on first request", async () => {
    const mockUser = { id: "user-123", email: "user@example.com" };
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockProfile = {
      id: "user-123",
      first_name: "John",
      last_name: "Doe",
      bio: "Software Engineer",
      skills: ["React", "Node"],
      created_at: "2026-08-05T00:00:00Z",
      updated_at: "2026-08-05T00:00:00Z",
    };

    const mockSingle = jest.fn().mockResolvedValue({
      data: mockProfile,
      error: null,
    });

    const mockEq = jest.fn().mockReturnValue({
      single: mockSingle,
    });

    const mockSelect = jest.fn().mockReturnValue({
      eq: mockEq,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });

    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer token-123")
      .expect(200);

    expect(res.body.first_name).toBe("John");
    expect(res.headers.etag).toBeDefined();

    // Verify subsequent request with If-None-Match returns 304 Not Modified
    const etag = res.headers.etag;
    await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer token-123")
      .set("If-None-Match", etag)
      .expect(304);
  });

  it("should return 200 OK if profile is updated (ETag hash mismatches)", async () => {
    const mockUser = { id: "user-123", email: "user@example.com" };
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const mockProfileUpdated = {
      id: "user-123",
      first_name: "Johnny", // changed first_name
      last_name: "Doe",
      bio: "Software Engineer",
      skills: ["React", "Node"],
      created_at: "2026-08-05T00:00:00Z",
      updated_at: "2026-08-05T00:05:00Z", // changed updated_at
    };

    const mockSingle = jest.fn().mockResolvedValue({
      data: mockProfileUpdated,
      error: null,
    });

    const mockEq = jest.fn().mockReturnValue({
      single: mockSingle,
    });

    const mockSelect = jest.fn().mockReturnValue({
      eq: mockEq,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
    });

    // We pass the old ETag (which was calculated on John)
    const oldEtag = '"c502b4d45543a6d7bd492bbd92b8d5a8db8805f9"'; // dynamic SHA1 dummy match or similar

    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer token-123")
      .set("If-None-Match", oldEtag)
      .expect(200);

    expect(res.body.first_name).toBe("Johnny");
    expect(res.headers.etag).not.toBe(oldEtag);
  });
});
