import { describe, it, expect, vi, beforeEach } from "vitest";
import { pubsub, RedisPubSub } from "../../graphql/resolvers";

// Mock ioredis completely
vi.mock("ioredis", () => {
  const mockPublish = vi.fn().mockResolvedValue(1);
  const mockSubscribe = vi.fn().mockResolvedValue(undefined);
  const mockDisconnect = vi.fn();
  const mockOn = vi.fn();

  class MockRedis {
    publish = mockPublish;
    subscribe = mockSubscribe;
    disconnect = mockDisconnect;
    on = mockOn;
  }

  return {
    default: MockRedis,
  };
});

describe("RedisPubSub Integration", () => {
  let ps: RedisPubSub;

  beforeEach(() => {
    vi.clearAllMocks();
    ps = new RedisPubSub();
  });

  it("publishes serialized payloads to the constructed channels", async () => {
    await ps.publish("TEST_EVENT", "topic-1", { foo: "bar" });
    const ioredis = await import("ioredis");
    expect(vi.mocked(ioredis.default.prototype.publish)).toHaveBeenCalledWith(
      "TEST_EVENT:topic-1",
      JSON.stringify({ foo: "bar" }),
    );
  });

  it("subscribes and yields messages correctly", async () => {
    const ioredis = await import("ioredis");
    const subGenerator = ps.subscribe("ANNOUNCEMENT_CREATED", "club-123");

    // Simulate incoming messages via emitter
    let messageCallback: ((chan: string, msg: string) => void) | null = null;
    vi.mocked(ioredis.default.prototype.on).mockImplementation((event: string, cb: any) => {
      if (event === "message") {
        messageCallback = cb;
      }
      return {} as any;
    });

    const nextPromise = subGenerator.next();

    // Trigger the callback
    expect(messageCallback).toBeNull(); // Wait: beforeEach ran, let's trigger next() which starts generator

    // We start the generator execution, which triggers subscribe
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(messageCallback).toBeDefined();
    messageCallback!(
      "ANNOUNCEMENT_CREATED:club-123",
      JSON.stringify({ id: "123", content: "hello" }),
    );

    const res = await nextPromise;
    expect(res.value).toEqual({ id: "123", content: "hello" });
    expect(res.done).toBe(false);
  });
});
