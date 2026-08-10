import request from "supertest";
import { jest, describe, expect, it } from "@jest/globals";
import { createActivityPubApp } from "../src/app";
import { createActivityPubRouter, type ActivityPubRepository } from "../src/routes";
import { createWebhookRouter, type WebhookBroadcasters } from "../src/webhook";
import type { ClubRecord, EventRecord, FollowerRecord, KeyRecord } from "../src/types";

const club: ClubRecord = {
  id: "club-1",
  name: "Robotics Club",
  slug: "robotics",
  description: "Building tomorrow's robots.",
  banner_url: null,
  logo_url: "https://cdn.example.test/robotics.png",
  visibility: "public",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  activitypub_enabled: true,
  activitypub_follower_count: 1,
};

const keys: KeyRecord = {
  id: "key-1",
  club_id: club.id,
  private_key: "private-key",
  public_key: "public-key",
};

const event: EventRecord = {
  id: "event-1",
  club_id: club.id,
  title: "Robot Build Night",
  description: "Bring your best ideas.",
  banner_url: null,
  start_date: "2026-08-01T18:00:00.000Z",
  end_date: "2026-08-01T20:00:00.000Z",
  event_date: "2026-08-01T18:00:00.000Z",
  location: "Engineering Lab",
  status: "published",
  created_at: "2026-07-01T12:00:00.000Z",
};

const follower: FollowerRecord = {
  id: "follower-1",
  club_id: club.id,
  actor_id: "https://remote.example/actors/student",
  inbox_url: "https://remote.example/inbox",
  shared_inbox_url: null,
  username: "student",
  domain: "remote.example",
  followed_at: "2026-07-01T00:00:00.000Z",
};

function createTestApp() {
  const repository: ActivityPubRepository = {
    getClubBySlug: jest.fn(async () => club),
    getOrCreateClubKeys: jest.fn(async () => keys),
    getFollowers: jest.fn(async () => [follower]),
    getClubEvents: jest.fn(async () => [event]),
    saveInboxItem: jest.fn(async () => undefined),
  };
  const broadcasters: WebhookBroadcasters = {
    broadcastEventCreate: jest.fn(async () => undefined),
    broadcastEventUpdate: jest.fn(async () => undefined),
    broadcastEventDelete: jest.fn(async () => undefined),
  };

  return {
    app: createActivityPubApp({
      activityPubRouter: createActivityPubRouter(repository),
      webhookRouter: createWebhookRouter(broadcasters),
    }),
    broadcasters,
  };
}

describe("ActivityPub API contracts", () => {
  it("returns the health contract", async () => {
    const { app } = createTestApp();

    const response = await request(app).get("/health").expect(200);

    expect(response.body).toEqual({ status: "ok", service: "activitypub" });
  });

  it("returns the actor contract", async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .get("/api/activitypub/actors/robotics")
      .expect("Content-Type", /activity\+json/)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: "Group",
        preferredUsername: "robotics",
        name: expect.any(String),
        inbox: expect.any(String),
        outbox: expect.any(String),
        followers: expect.any(String),
        publicKey: expect.objectContaining({ publicKeyPem: expect.any(String) }),
      }),
    );
  });

  it("returns event objects with the agreed outbox contract", async () => {
    const { app } = createTestApp();

    const response = await request(app).get("/api/activitypub/actors/robotics/outbox").expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        type: "OrderedCollection",
        totalItems: expect.any(Number),
        orderedItems: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            type: "Create",
            object: expect.objectContaining({
              id: expect.any(String),
              type: "Event",
              name: expect.any(String),
              startTime: expect.any(String),
              endTime: expect.any(String),
            }),
          }),
        ]),
      }),
    );
  });

  it("returns the followers collection contract", async () => {
    const { app } = createTestApp();

    const response = await request(app)
      .get("/api/activitypub/actors/robotics/followers")
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        type: "OrderedCollection",
        totalItems: expect.any(Number),
        items: expect.arrayContaining([expect.any(String)]),
      }),
    );
  });

  it("accepts the event-created webhook contract", async () => {
    const { app, broadcasters } = createTestApp();

    const response = await request(app)
      .post("/api/activitypub/webhook/event-created")
      .send({ type: "INSERT", record: event })
      .expect(202);

    expect(response.body).toEqual({ status: "accepted" });
    expect(broadcasters.broadcastEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        club_id: expect.any(String),
        title: expect.any(String),
        start_date: expect.any(String),
      }),
    );
  });
});
