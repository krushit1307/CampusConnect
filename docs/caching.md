# Static Metadata Caching Strategy

To improve application loading speeds and reduce bandwidth, we employ an aggressive edge caching strategy for highly static metadata (majors, semesters, terms, departments).

## The Cache Header

All static edge function responses include the following header:

```
Cache-Control: public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400
```

### Breakdown:

- **`public`**: The response can be cached by any cache (browser, CDN).
- **`max-age=86400`**: The browser will cache the data locally for 1 day (86,400 seconds).
- **`s-maxage=604800`**: The CDN (Cloudflare/Vercel) will cache the data for 7 days.
- **`stale-while-revalidate=86400`**: The CDN will serve stale data while fetching the updated data in the background if the cache is older than 7 days, up to an additional 1 day.

## Frontend Fetch Wrapper

The frontend `customFetch` utility in `src/utils/fetch.ts` is designed to support this strategy.
For static metadata requests, it ensures:

1. `cache: "default"` is explicitly passed to the underlying `fetch` API.
2. Cache-busting query strings (like `?timestamp=12345`) are NOT appended, allowing the browser to serve from disk/memory cache.

## Database Triggers and Cache Invalidation

Since the data is cached at the CDN for 7 days, any modifications made in the database (e.g., adding a new major) would not reflect immediately.

To solve this, we implemented a Postgres trigger on the static metadata tables.
When a row is inserted, updated, or deleted, it invokes a PL/pgSQL function `notify_cdn_purge()`.
This function makes an HTTP POST request via `pg_net` to the Cloudflare/Vercel CDN Purge API, invalidating the specific endpoint url (e.g. `/api/majors`).

### Relevant Files

- `supabase/migrations/*_cache_invalidation.sql`
- `supabase/migrations/*_triggers.sql`
- `supabase/functions/shared/cache.ts`
