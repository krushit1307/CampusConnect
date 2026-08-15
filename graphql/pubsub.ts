/**
 * Redis-backed PubSub for GraphQL Subscriptions.
 *
 * Edge / Node server instances are stateless, so an in-memory PubSub cannot
 * deliver events to clients connected to *other* instances. Redis (Upstash)
 * acts as the cross-instance broker: publishers `PUBLISH` to a topic channel
 * and every server instance's subscriber connection receives the event and
 * forwards it to its connected WebSocket/SSE clients.
 *
 * Channel layout: `${channel}:${topic}` — e.g. `MESSAGE_ADDED:<eventId>`.
 *
 * When `REDIS_URL` is not configured (local dev, unit tests) a fallback
 * in-memory `createPubSub` is used so the feature still works without Redis.
 */

import IORedis, { type Redis, type RedisOptions } from "ioredis";
import { createPubSub, Repeater } from "@graphql-yoga/subscription";

/** Minimal PubSub surface shared by the in-memory and Redis implementations. */
export interface PubSubLike {
  publish(channel: string, topic?: string | null, payload?: unknown): Promise<void> | void;
  subscribe<T>(channel: string, topic?: string | null): AsyncIterableIterator<T>;
}

/** Builds the Redis channel key from a PubSub channel + optional topic. */
export function channelKey(channel: string, topic?: string | null): string {
  return topic ? `${channel}:${topic}` : channel;
}

const DEFAULT_REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

/**
 * Cross-process PubSub implementation backed by Redis.
 *
 * Uses two connections: one dedicated to publishing and one that stays in
 * subscribe mode. Messages are JSON-serialized on publish and parsed on
 * delivery. Redis may be unavailable (e.g. Upstash out-of-memory); the class
 * still works locally when a local Redis is running.
 */
export class RedisPubSub implements PubSubLike {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private disconnected = false;

  constructor(redisUrl: string = DEFAULT_REDIS_URL, options?: RedisOptions) {
    const opts: RedisOptions = { maxRetriesPerRequest: 1, ...options };
    this.publisher = new IORedis(redisUrl, opts);
    this.subscriber = new IORedis(redisUrl, opts);
  }

  /** Serializes the payload and publishes it to the topic channel. */
  async publish(channel: string, topic?: string | null, payload?: unknown): Promise<void> {
    await this.publisher.publish(channelKey(channel, topic), JSON.stringify(payload));
  }

  /**
   * Returns an async iterable that yields each message published to the
   * channel while the consumer is iterating. Cleans up its Redis
   * subscription when the iterator is returned (disposed).
   *
   * Implemented with Repeater because a plain async generator blocked on an
   * unresolved await cannot be cancelled: calling `.return()` would only run
   * the `finally` block after the pending promise settles, leaking the Redis
   * subscription when a client disconnects. Repeater resolves this by
   * resolving `stop` on disposal so the `await stop` below resumes and runs
   * cleanup.
   */
  subscribe<T>(channel: string, topic?: string | null): AsyncIterableIterator<T> {
    const key = channelKey(channel, topic);

    return new Repeater<T>(async (push, stop) => {
      const onMessage = (_chan: string, message: string) => {
        try {
          push(JSON.parse(message) as T);
        } catch {
          // Ignore non-JSON payloads on this channel.
        }
      };

      this.subscriber.on("message", onMessage);

      try {
        await this.subscriber.subscribe(key);
      } catch {
        // Redis is unavailable; this subscription simply yields nothing.
      }

      await stop;

      this.subscriber.off("message", onMessage);
      try {
        await this.subscriber.unsubscribe(key);
      } catch {
        // The connection may already be closing.
      }
    }) as AsyncIterableIterator<T>;
  }

  /** Close both Redis connections (used on graceful shutdown / in tests). */
  disconnect(): void {
    if (this.disconnected) return;
    this.disconnected = true;
    this.publisher.disconnect();
    this.subscriber.disconnect();
  }
}

/**
 * Singleton PubSub used across all resolvers and server-side bridges.
 *
 * - With `REDIS_URL` set → Redis-backed, so events fan out across instances.
 * - Without it → in-memory fallback (local dev / tests). `publish` still
 *   returns a Promise so callers can `.catch()` uniformly.
 */
const inMemoryPubSub = createPubSub<Record<string, [string, unknown]>>();

export const pubsub: PubSubLike =
  process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
    ? new RedisPubSub()
    : {
        publish: (channel, topic, payload) => {
          inMemoryPubSub.publish(channel as never, topic as never, payload as never);
          return Promise.resolve();
        },
        subscribe: <T>(channel: string, topic?: string | null) =>
          inMemoryPubSub.subscribe(channel as never, topic as never) as AsyncIterableIterator<T>,
      };
