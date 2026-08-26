/**
 * Redis Client Configuration for CampusConnect
 * Initializes and exports a singleton Redis client for high-performance operations.
 */

import { createClient } from 'redis';

// Singleton pattern to prevent multiple connections in serverless environments
let redisClient: ReturnType<typeof createClient> | null = null;

export function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            socket: {
                reconnectStrategy: (retries) => {
                    // Exponential backoff: 2^retries * 100ms
                    return Math.min(retries * 100, 3000);
                },
            },
        });

        redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        // Connect asynchronously, but don't block module initialization
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
