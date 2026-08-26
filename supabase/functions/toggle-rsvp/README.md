# Toggle RSVP Edge Function

This function securely handles user RSVPs for events. It validates authentication tokens, checks event existence, toggles the RSVP status in the database, and is protected by IP-based rate limiting.

## Setup Instructions

This function utilizes Upstash Redis for distributed rate limiting. To run this function locally or deploy it to production, you must configure the following environment variables:

1. **UPSTASH_REDIS_REST_URL**: The REST endpoint URL provided by your Upstash Redis database.
2. **UPSTASH_REDIS_REST_TOKEN**: The authentication token for your Upstash Redis database.

### Local Development

Create a `.env.local` file in the `supabase` directory (if it doesn't already exist) and add your keys:

```bash
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

### Production Deployment

Ensure the secrets are added to your Supabase project before deploying:

```bash
supabase secrets set UPSTASH_REDIS_REST_URL=your_upstash_url
supabase secrets set UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```
