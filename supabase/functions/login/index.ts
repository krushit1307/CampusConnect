// supabase/functions/login/index.ts
// Follows CampusConnect Edge Function conventions.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAuth } from '../shared/auth-middleware.ts';

/**
 * Login Edge Function with Progressive Backoff (Tarpit)
 * 
 * Our standard login endpoint has a basic rate limit (100 req/min), but a
 * botnet can still attempt 100 passwords a minute against a single admin
 * account indefinitely. This custom Edge Function implements a targeted,
 * progressive backoff that exponentially slows down repeated failures for
 * a specific email address, making brute-force credential stuffing
 * mathematically impossible.
 * 
 * Edge Case Handling (DoS Prevention):
 * If we delay the response by 32 seconds, a malicious bot can open 10,000
 * parallel connections, forcing the server to hold 10,000 open promises in
 * memory (Connection Exhaustion). To prevent this, we implement a hard upper
 * bound limit. After 10 consecutive failures, we outright reject the request
 * with a 429 Too Many Requests status instead of holding the connection open.
 */

// In-memory store for failed attempts.
// In a production Deno environment with multiple instances, this should be
// replaced with an Upstash Redis or Supabase KV store for global state.
// For this implementation, we use a Map with an TTL cleanup interval.
const failedAttempts = new Map<string, { count: number; timestamp: number }>();

// Configuration constants
const MAX_FAILURES_BEFORE_REJECTION = 10;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Clean up stale entries every hour
const ATTEMPT_EXPIRY_MS = 24 * 60 * 60 * 1000; // Failures expire after 24 hours

/**
 * Periodically cleans up stale entries from the in-memory map to prevent
 * memory leaks over long-running Edge Function instances.
 */
setInterval(() => {
    const now = Date.now();
    for (const [email, data] of failedAttempts.entries()) {
        if (now - data.timestamp > ATTEMPT_EXPIRY_MS) {
            failedAttempts.delete(email);
        }
    }
}, CLEANUP_INTERVAL_MS);

/**
 * Calculates the progressive delay in milliseconds based on the number of failures.
 * Formula: delay_ms = Math.pow(2, failures) * 1000
 * 
 * Examples:
 * - 4 failures = 16 seconds
 * - 5 failures = 32 seconds
 * - 6 failures = 64 seconds
 */
function calculateDelay(failures: number): number {
    // Only start delaying after 3 failures
    if (failures <= 3) return 0;
    return Math.pow(2, failures) * 1000;
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        });
    }

    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return new Response(
                JSON.stringify({ error: 'Email and password are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const normalizedEmail = email.toLowerCase().trim();
        const attemptData = failedAttempts.get(normalizedEmail);
        const currentFailures = attemptData ? attemptData.count : 0;

        // DoS Protection: Hard reject if failures exceed the maximum threshold
        if (currentFailures >= MAX_FAILURES_BEFORE_REJECTION) {
            console.warn(`[SECURITY] Max login attempts exceeded for ${normalizedEmail}. Rejecting with 429.`);
            return new Response(
                JSON.stringify({
                    error: 'Too many failed attempts. Please try again later or reset your password.',
                    code: 'MAX_ATTEMPTS_EXCEEDED'
                }),
                { status: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
        }

        // Calculate and apply the progressive delay BEFORE executing the expensive hash comparison
        const delayMs = calculateDelay(currentFailures);
        if (delayMs > 0) {
            console.log(`[SECURITY] Applying ${delayMs}ms tarpit delay for ${normalizedEmail} (Failures: ${currentFailures})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        // Initialize Supabase Client
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Attempt to sign in the user
        const { data, error } = await supabaseAdmin.auth.signInWithPassword({
            email: normalizedEmail,
            password: password,
        });

        if (error || !data.user) {
            // Login Failed: Increment the failure counter
            const newCount = currentFailures + 1;
            failedAttempts.set(normalizedEmail, {
                count: newCount,
                timestamp: Date.now(),
            });

            console.log(`[SECURITY] Login failed for ${normalizedEmail}. New failure count: ${newCount}`);

            return new Response(
                JSON.stringify({
                    error: 'Invalid login credentials',
                    // Inform the client about the backoff state so it can update UI
                    nextDelay: calculateDelay(newCount),
                    failures: newCount
                }),
                { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
        }

        // Login Successful: Delete the failure counter for this email
        if (failedAttempts.has(normalizedEmail)) {
            failedAttempts.delete(normalizedEmail);
            console.log(`[SECURITY] Login successful for ${normalizedEmail}. Failure counter reset.`);
        }

        // Return the session data to the client
        return new Response(
            JSON.stringify({
                user: data.user,
                session: data.session
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );

    } catch (err) {
        console.error('Unexpected error in login Edge Function:', err);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
    }
});
