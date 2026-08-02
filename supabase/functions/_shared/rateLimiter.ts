import { Ratelimit } from "npm:@upstash/ratelimit";
import { redis } from "./redis.ts";

export const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),

  analytics: true,

  prefix: "login-limit",
});
