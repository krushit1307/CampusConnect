import { ConnectionOptions } from "bullmq";

const redisUrl = process.env.REDIS_URL;

export const redisConnection: ConnectionOptions = redisUrl
  ? { url: redisUrl }
  : {
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT || 6379),
    };
