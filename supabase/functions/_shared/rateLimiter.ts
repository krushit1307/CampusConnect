import { Ratelimit } from "npm:@upstash/ratelimit";
import { redis } from "./redis.ts";

export const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "login-limit",
});

// Allows bursts of 10 search requests and refills one token every second.
export const globalSearchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(10, "1 s", 1),
  analytics: true,
  prefix: "global-search-limit",
});

// Dedicated rate limiter for outbound communication endpoints (emails, SMS)
export const outboundCommunicationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "outbound-comm-limit",
});

export const rsvpIpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "rsvp-ip-limit",
});

export const rsvpUserLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 s"),
  analytics: true,
  prefix: "rsvp-user-limit",
});
