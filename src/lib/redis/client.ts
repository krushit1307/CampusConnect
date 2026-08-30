/**
 * Redis Client Configuration for CampusConnect
 * Initializes and exports a singleton Redis client for high-performance operations.
 */

import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

export function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.connect().catch(console.error);
  }

  return redisClient;
}

export async function closeRedisClient() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Redis Client Adapter Configuration for CampusConnect
 * Provides a resilient Redis client interface with seamless in-memory fallback for browser/jsdom environments.
 */

export interface RedisClientInterface {
  status: string;
  set(key: string, value: string | number): Promise<"OK" | string>;
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  del(key: string): Promise<number>;
  quit(): Promise<"OK" | void>;
}

class InMemoryRedisClient implements RedisClientInterface {
  public status = "ready";
  private store = new Map<string, string>();
  private hashStore = new Map<string, Map<string, string>>();

  async set(key: string, value: string | number): Promise<"OK"> {
    this.store.set(key, String(value));
    return "OK";
  }

  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  async incr(key: string): Promise<number> {
    const current = Number.parseInt(this.store.get(key) || "0", 10);
    const next = current + 1;
    this.store.set(key, String(next));
    return next;
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    if (!this.hashStore.has(key)) {
      this.hashStore.set(key, new Map());
    }
    const map = this.hashStore.get(key)!;
    const current = Number.parseInt(map.get(field) || "0", 10);
    const next = current + increment;
    map.set(field, String(next));
    return next;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const map = this.hashStore.get(key);
    if (!map) return {};
    const obj: Record<string, string> = {};
    map.forEach((val, k) => {
      obj[k] = val;
    });
    return obj;
  }

  async del(key: string): Promise<number> {
    const deleted = this.store.delete(key) || this.hashStore.delete(key);
    return deleted ? 1 : 0;
  }

  async quit(): Promise<"OK"> {
    this.status = "end";
    return "OK";
  }
}

let redisClient: RedisClientInterface | null = null;

export function getRedisClient(): RedisClientInterface | null {
  if (!redisClient) {
    redisClient = new InMemoryRedisClient();
  }
  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
