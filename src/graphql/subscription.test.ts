import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisPubSub, channelKey } from "../../graphql/pubsub";

const { mockPublish, mockSubscribe, mockUnsubscribe, mockDisconnect, mockOn, mockOff } = vi.hoisted(
  () => ({
    mockPublish: vi.fn().mockResolvedValue(1),
    mockSubscribe: vi.fn().mockResolvedValue(1),
    mockUnsubscribe: vi.fn().mockResolvedValue(1),
    mockDisconnect: vi.fn(),
    mockOn: vi.fn(),
    mockOff: vi.fn(),
  }),
);

// Mock ioredis entirely: the class under test only depends on the
// publish/subscribe/disconnect surface, so a stub class is sufficient.
vi.mock("ioredis", () => {
  class MockRedis {
    publish = mockPublish;
    subscribe = mockSubscribe;
    unsubscribe = mockUnsubscribe;
    disconnect = mockDisconnect;
    on = mockOn;
    off = mockOff;
  }
  return { default: MockRedis };
});

describe("channelKey", () => {
  it("namespaces the channel with the topic", () => {
    expect(channelKey("MESSAGE_ADDED", "event-1")).toBe("MESSAGE_ADDED:event-1");
  });

  it("returns the bare channel when no topic is given", () => {
    expect(channelKey("ANNOUNCEMENT_CREATED", null)).toBe("ANNOUNCEMENT_CREATED");
  });
});

describe("RedisPubSub", () => {
  let ps: RedisPubSub;

  beforeEach(() => {
    vi.clearAllMocks();
    ps = new RedisPubSub("redis://test:6379");
  });

  it("publishes JSON-serialized payloads to the topic channel", async () => {
    await ps.publish("MESSAGE_ADDED", "event-1", { id: "m1", content: "hello" });

    expect(mockPublish).toHaveBeenCalledWith(
      "MESSAGE_ADDED:event-1",
      JSON.stringify({ id: "m1", content: "hello" }),
    );
  });

  it("publishes to the bare channel when no topic is provided", async () => {
    await ps.publish("BROADCAST", null, { notice: true });

    expect(mockPublish).toHaveBeenCalledWith("BROADCAST", JSON.stringify({ notice: true }));
  });

  it("subscribes to the channel and yields parsed messages", async () => {
    let messageHandler: ((chan: string, message: string) => void) | null = null;
    mockOn.mockImplementation((event: string, cb: (chan: string, message: string) => void) => {
      if (event === "message") messageHandler = cb;
    });

    const generator = ps.subscribe("MESSAGE_ADDED", "event-1");
    const nextPromise = generator.next();

    // Let the generator run up to its first await (subscriber registration).
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(messageHandler).toBeDefined();
    expect(mockSubscribe).toHaveBeenCalledWith("MESSAGE_ADDED:event-1");

    messageHandler!("MESSAGE_ADDED:event-1", JSON.stringify({ id: "m1", content: "hello" }));

    const res = await nextPromise;
    expect(res.value).toEqual({ id: "m1", content: "hello" });
    expect(res.done).toBe(false);
  });

  it("cleans up the Redis subscription when the iterator is disposed", async () => {
    const generator = ps.subscribe("MESSAGE_ADDED", "event-1");

    // Start iteration without awaiting: the generator blocks until a message
    // arrives, which is the point of a subscription.
    void generator.next();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await generator.return(undefined);

    expect(mockUnsubscribe).toHaveBeenCalledWith("MESSAGE_ADDED:event-1");
    expect(mockOff).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("disconnect closes both the publisher and subscriber connections", () => {
    ps.disconnect();
    ps.disconnect(); // idempotent

    expect(mockDisconnect).toHaveBeenCalledTimes(2);
  });
});
