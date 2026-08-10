# Rate Limiting Implementation Guide

## Overview

This guide documents the rate limiting system for Supabase Edge Functions to prevent DoS attacks and excessive cloud billing.

**Current Status (Aug 10, 2026):** 34/80+ functions protected (~42% complete)

Recent Changes (PR #1069):

- ✅ Added rate limiting to 26 additional Edge Functions
- ✅ Auth functions: login, webauthn-* (all variants)
- ✅ Content: validate-comment, delete-post, chat-moderation, translate-message
- ✅ Read-heavy: get-feed, nearby-events, link-preview, og-image
- ✅ All high-risk and medium-risk functions now protected

## Architecture

### Components

1. **Redis Backend**: Upstash Redis (centralized, globally distributed)
2. **Lua Scripting**: Atomic sliding-window algorithm in Redis
3. **Identifier Priority**:
   - Authenticated requests: User ID (from JWT `sub`)
   - Unauthenticated requests: Hashed IP address
4. **Latency**: <20ms per request (same-region Upstash)

### Key Design Decisions

- **Fail-open**: If Redis is unavailable, rate limiting is skipped (fail-safe)
- **Atomic operations**: Single Lua `EVAL` prevents race conditions
- **IP hashing**: SHA-256 hash prevents PII storage in Redis
- **User priority**: Authenticated users never blocked by dormitory IP limits

## Generic Rate Limiter

### Function Signature

```typescript
import { rateLimiter } from "../shared/rateLimiter.ts";

const limited = await rateLimiter(req, "function-name", limit, windowSeconds);
if (limited) return limited;
```

### Parameters

- `req`: The incoming `Request` object
- `function-name`: Logical name (used in Redis keys)
- `limit`: Max requests allowed in the window
- `windowSeconds`: Window duration in seconds

### Return Value

- `null`: Request is within limits, proceed normally
- `Response`: 429 Too Many Requests, return immediately

## Recommended Rate Limits

### Authentication (high-risk)

- `login`: 5 requests/minute per user
- `2fa-setup`: 5 requests/minute
- `2fa-verify`: 5 requests/minute
- `webauthn-register`: 5 requests/minute
- `webauthn-authenticate`: 10 requests/minute

### Payment & Commerce

- `buy-ticket`: 10 requests/minute
- `process-payment`: 10 requests/minute
- `payment-webhook`: 30 requests/minute (external webhooks)
- `toggle-rsvp`: Already protected with dual limiters

### Content & Moderation

- `ai-moderation`: 20 requests/minute (compute-heavy)
- `validate-comment`: 20 requests/minute
- `delete-post`: 20 requests/minute
- `chat-moderation`: 20 requests/minute

### Content Delivery

- `get-feed`: 60 requests/minute (read-only, safe)
- `meilisearch-search`: 60 requests/minute
- `nearby-events`: 60 requests/minute
- `link-preview`: 30 requests/minute (external API calls)
- `og-image`: 30 requests/minute

### Batch Operations

- `export-event-rsvps`: 10 requests/minute (database-heavy)
- `export-user-data`: 5 requests/minute (GDPR, sensitive)
- `bulk-invite-members`: Already protected
- `generate-bulk-zip`: limit as needed

### Async & Scheduled

- `weekly-digest`: 5 requests/hour
- `newsletter-worker`: 5 requests/hour
- `purge-dormant-accounts`: 2 requests/hour
- `merge-accounts`: 3 requests/hour

## Implementation Checklist

### Phase 1: Core Infrastructure (✅ DONE)

- [x] `shared/rateLimiter.ts` - Generic sliding-window utility
- [x] `_shared/redis.ts` - Singleton Redis client
- [x] Lua script for atomic operations
- [x] JWT sub extraction (no signature verification needed)
- [x] IP hashing with SHA-256

### Phase 2: High-Risk Functions (✅ DONE)

Functions with **authentication**, **payments**, or **external APIs**:

- [x] `login/index.ts` - 5/minute
- [x] `2fa-setup/index.ts` - 5/minute
- [x] `2fa-verify/index.ts` - 5/minute
- [x] `webauthn-auth-options/index.ts` - 10/minute
- [x] `webauthn-auth-verify/index.ts` - 10/minute
- [x] `webauthn-authenticate/index.ts` - 10/minute
- [x] `webauthn-registration-options/index.ts` - 5/minute
- [x] `webauthn-registration-verify/index.ts` - 5/minute
- [x] `buy-ticket/index.ts` - 10/minute
- [x] `process-payment/index.ts` - 10/minute
- [x] `payment-webhook/index.ts` - 30/minute
- [x] `ai-moderation/index.ts` - 20/minute
- [x] `export-user-data/index.ts` - 5/minute (GDPR)

### Phase 3: Medium-Risk Functions (✅ DONE)

Read-heavy but with external APIs or compute:

- [x] `link-preview/index.ts` - 30/minute
- [x] `nearby-events/index.ts` - 60/minute
- [x] `meilisearch-search/index.ts` - 60/minute
- [x] `translate-message/index.ts` - 20/minute
- [x] `get-feed/index.ts` - 60/minute
- [x] `og-image/index.ts` - 30/minute

### Phase 3b: Content Moderation Functions (✅ DONE)

- [x] `validate-comment/index.ts` - 20/minute
- [x] `delete-post/index.ts` - 20/minute
- [x] `chat-moderation/index.ts` - 20/minute

### Phase 4: Remaining Functions (TODO)

Low-risk batch operations, webhooks, async jobs:

- [ ] `export-event-rsvps/index.ts` - 10/minute (database-heavy)
- [ ] `bulk-invite-members/index.ts` - limit as needed
- [ ] `generate-bulk-zip/index.ts` - limit as needed
- [ ] `weekly-digest/index.ts` - 5/hour
- [ ] `newsletter-worker/index.ts` - 5/hour
- [ ] `purge-dormant-accounts/index.ts` - 2/hour
- [ ] `merge-accounts/index.ts` - 3/hour
- [ ] And 40+ remaining utility/webhook functions

### Phase 5: Monitoring & Tuning

- Monitor Redis latency
- Track 429 response rates
- Adjust limits based on usage patterns
- Document in this guide

## Usage Examples

### Example 1: Simple Function (Unauthenticated)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {/* ... */};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Rate limit: 30 requests per minute
  const limited = await rateLimiter(req, "my-function", 30, 60);
  if (limited) return limited;

  try {
    // Your function logic here
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### Example 2: Authenticated Function

```typescript
import { rateLimiter } from "../shared/rateLimiter.ts";
import { verifyAuth } from "../shared/auth-middleware.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Rate limit: 5 requests per minute (strict for auth)
  const limited = await rateLimiter(req, "sensitive-op", 5, 60);
  if (limited) return limited;

  try {
    const user = await verifyAuth(req, supabase);
    // User-based rate limiting automatically applied above
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }
});
```

## Testing Rate Limiting

### Local Development (Without Redis)

Rate limiting is automatically skipped if `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are not set. Development works normally without rate limiting.

### Production Testing

```bash
# Simulate rapid requests
for i in {1..65}; do
  curl -H "Authorization: Bearer $JWT_TOKEN" \
    https://project-ref.supabase.co/functions/v1/my-function
done

# Should see 429 responses after limit (60 requests/minute)
```

### Monitoring

Check Upstash Redis metrics in the dashboard:

- Commands per second
- Latency (p50, p99)
- Key distribution
- Command types

## Performance Characteristics

### Latency Impact

- Same-region Upstash: ~5-15ms per request
- Worst-case (different region): ~50-100ms
- Failed Redis connection: 0ms (fail-open)

### Redis Operations

Per rate-limit check:

1. ZADD (add timestamp)
2. ZREMRANGEBYSCORE (trim old entries)
3. ZCARD (count remaining)
4. EXPIRE (cleanup)

All in single Lua atomic operation (~1 roundtrip).

### Storage

Memory per rate-limit bucket: ~100-200 bytes
With 10,000 active users: ~1-2 MB

## Troubleshooting

### Rate limit not working

1. Check `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
2. Check Redis connection: `redis.ping()` in Edge Function
3. Verify Lua script syntax (no typos)
4. Check logs for `[rateLimiter]` entries

### Too aggressive limit

- Lower the `limit` parameter
- Increase `windowSeconds`
- Check for bursts of legitimate traffic

### Users getting 429 incorrectly

- Verify JWT `sub` extraction works
- Check Redis key collisions
- Monitor for cache stampedes

## Migration Path

1. **Week 1**: Deploy infrastructure (redis.ts, rateLimiter.ts)
2. **Week 2**: Apply to high-risk functions (auth, payments)
3. **Week 3**: Apply to medium-risk functions
4. **Week 4**: Monitor, tune, document

## References

- [Upstash Redis Docs](https://upstash.com/docs/redis)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Lua Scripting in Redis](https://redis.io/docs/manual/lua-scripting/)
- [Rate Limiting Algorithms](https://en.wikipedia.org/wiki/Rate_limiting)

## Questions?

See the issue #2857 in the GitHub repository for design discussions and updates.
