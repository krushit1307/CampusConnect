/**
 * Next.js Middleware for Rate Limiting
 * Intercepts all /api/v1/public/* requests and applies Token Bucket rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter/tokenBucket';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only apply to public API routes
    if (!pathname.startsWith('/api/v1/public/')) {
        return NextResponse.next();
    }

    // Extract identifier: API Key from header, fallback to IP address
    const apiKey = request.headers.get('x-api-key');
    const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown';
    const identifier = apiKey ? `apikey:${apiKey}` : `ip:${ip}`;

    // Apply rate limit: 100 requests per 15 minutes (900 seconds)
    const rateLimit = await checkRateLimit(identifier, 100, 900);

    const response = NextResponse.next();

    // Always attach rate limit headers for transparency
    response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());

    if (!rateLimit.allowed) {
        // Short-circuit the request, returning HTTP 429 without touching Postgres
        return new NextResponse(
            JSON.stringify({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please slow down your requests.',
                retryAfter: rateLimit.resetTime - Math.floor(Date.now() / 1000),
            }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'X-RateLimit-Limit': rateLimit.limit.toString(),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': rateLimit.resetTime.toString(),
                    'Retry-After': (rateLimit.resetTime - Math.floor(Date.now() / 1000)).toString(),
                },
            }
        );
    }

    return response;
}

export const config = {
    matcher: '/api/v1/public/:path*',
};
