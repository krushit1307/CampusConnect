import request from "supertest";
import { jest, describe, expect, it, beforeEach } from "@jest/globals";
import { createActivityPubApp } from "../src/app";
import { createActivityPubRouter } from "../src/routes";
import { createWebhookRouter } from "../src/webhook";

// Mock BullMQ Queue and Worker
jest.mock("bullmq", () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: "job-1" }),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
    })),
  };
});

// Mock Supabase client in db.ts
const mockSupabase = {
  from: jest.fn(),
  storage: {
    from: jest.fn(),
  },
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

describe("Photo Upload Background processing API", () => {
  const app = createActivityPubApp({
    activityPubRouter: createActivityPubRouter(),
    webhookRouter: createWebhookRouter(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fail if no file is uploaded", async () => {
    const res = await request(app)
      .post("/api/activitypub/events/event-123/upload-photos")
      .expect(400);

    expect(res.body.error).toBe("No ZIP file uploaded");
  });

  it("should fail if uploaded file is not a ZIP archive", async () => {
    const res = await request(app)
      .post("/api/activitypub/events/event-123/upload-photos")
      .attach("file", Buffer.from("not-a-zip"), "test.txt")
      .expect(400);

    expect(res.body.error).toBe("Uploaded file must be a ZIP archive");
  });

  it("should successfully accept a ZIP archive and add job to queue", async () => {
    // Mock the db tracking row insert
    const singleMock = jest.fn().mockResolvedValue({
      data: { id: "job-uuid-123", status: "PENDING" },
      error: null,
    } as any);

    const selectMock = jest.fn().mockReturnValue({
      single: singleMock,
    });

    const insertMock = jest.fn().mockReturnValue({
      select: selectMock,
    });

    mockSupabase.from.mockImplementation((table) => {
      if (table === "photo_upload_jobs") {
        return { insert: insertMock };
      }
      return {};
    });

    const res = await request(app)
      .post("/api/activitypub/events/event-123/upload-photos")
      .attach("file", Buffer.from("mock-zip-content"), "photos.zip")
      .expect(202);

    expect(res.body).toEqual({
      message: "File accepted for background processing",
      jobId: "job-uuid-123",
      status: "PENDING",
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "event-123",
        status: "PENDING",
      }),
    );
  });
});
