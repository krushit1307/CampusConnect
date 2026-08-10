// =============================================================================
// Service: Webhook Dispatcher (Background Queue)
// Issue: #2444 - Advanced API Webhook dispatch system for Discord integrations
// Description: Manages the asynchronous dispatch of webhook payloads to 
// external services (like Discord). Uses a background queue pattern (simulated 
// via BullMQ architecture) to ensure slow external APIs never freeze our 
// Event Creation HTTP requests. Includes strict timeouts and SSRF validation.
// =============================================================================

import axios, { AxiosError } from 'axios';
import { validateWebhookUrl } from '../utils/webhookValidator';

/**
 * Interface for a Webhook Job payload
 */
export interface WebhookJobData {
    webhookUrl: string;
    payload: DiscordWebhookPayload;
    clubId: string;
    eventId: string;
    attempt: number;
}

/**
 * Discord-specific Webhook Payload Schema
 * Adheres strictly to Discord's API requirements for embedded messages.
 */
export interface DiscordWebhookPayload {
    content?: string;
    username?: string;
    avatar_url?: string;
    embeds: Array<{
        title: string;
        description: string;
        url?: string;
        color?: number; // Decimal color code
        timestamp?: string; // ISO8601
        footer?: { text: string; icon_url?: string };
        thumbnail?: { url: string };
        fields?: Array<{ name: string; value: string; inline?: boolean }>;
    }>;
}

/**
 * Maximum number of retry attempts for failed webhook deliveries.
 */
const MAX_RETRIES = 3;

/**
 * Strict timeout for the Axios POST request (3000ms).
 * Prevents malicious or slow webhook receivers from hanging our worker threads.
 */
const REQUEST_TIMEOUT_MS = 3000;

/**
 * In-memory queue simulation for demonstration.
 * In production, this would be replaced by BullMQ + Redis.
 */
const webhookQueue: WebhookJobData[] = [];
let isProcessing = false;

/**
 * Adds a webhook dispatch job to the background queue.
 * This function returns immediately, ensuring the HTTP request is not blocked.
 */
export async function enqueueWebhookDispatch(
    webhookUrls: string[],
    payload: DiscordWebhookPayload,
    clubId: string,
    eventId: string
): Promise<void> {

    for (const url of webhookUrls) {
        // 1. STRICT VALIDATION: Check URL before it ever enters the queue.
        // This prevents SSRF attacks where an admin pastes http://localhost:5432
        const isValid = await validateWebhookUrl(url);
        if (!isValid) {
            console.warn(`[WebhookDispatcher] Blocked invalid/unsafe webhook URL: ${url}`);
            continue; // Skip this URL, don't crash the event creation
        }

        // 2. Enqueue the job
        webhookQueue.push({
            webhookUrl: url,
            payload,
            clubId,
            eventId,
            attempt: 1
        });
    }

    // 3. Trigger the background worker if it's not already running
    if (!isProcessing) {
        processQueue().catch(err => {
            console.error('[WebhookDispatcher] Queue processor crashed:', err);
        });
    }
}

/**
 * Background Worker: Processes the queue sequentially.
 * In a real BullMQ setup, this would be a separate Worker process with 
 * concurrency: 1 to prevent rate-limiting by Discord.
 */
async function processQueue(): Promise<void> {
    isProcessing = true;
    console.log('[WebhookDispatcher] Starting background queue processing...');

    while (webhookQueue.length > 0) {
        const job = webhookQueue.shift();
        if (!job) break;

        try {
            await executeWebhookPost(job);
            console.log(`[WebhookDispatcher] Successfully delivered webhook to ${job.webhookUrl}`);
        } catch (error: any) {
            console.error(`[WebhookDispatcher] Failed to deliver to ${job.webhookUrl}:`, error.message);

            // Retry logic with exponential backoff
            if (job.attempt < MAX_RETRIES) {
                job.attempt += 1;
                const delay = Math.pow(2, job.attempt) * 1000; // 2s, 4s, 8s
                console.log(`[WebhookDispatcher] Scheduling retry ${job.attempt} in ${delay}ms`);

                setTimeout(() => {
                    webhookQueue.push(job);
                    if (!isProcessing) processQueue();
                }, delay);
            } else {
                console.error(`[WebhookDispatcher] Max retries reached for ${job.webhookUrl}. Dropping job.`);
                // In production, move to a Dead Letter Queue (DLQ) for admin review
            }
        }
    }

    isProcessing = false;
    console.log('[WebhookDispatcher] Queue empty. Worker sleeping.');
}

/**
 * Executes the actual HTTP POST request to the webhook URL.
 */
async function executeWebhookPost(job: WebhookJobData): Promise<void> {
    // Construct the Axios config with strict security settings
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'CampusConnect-Webhook-Bot/1.0 (+https://campusconnect.com)'
        },
        timeout: REQUEST_TIMEOUT_MS,
        maxRedirects: 0, // Prevent SSRF via open redirects
        // Validate that we only accept 2xx success codes from Discord
        validateStatus: (status: number) => status >= 200 && status < 300
    };

    // Execute the POST request
    await axios.post(job.webhookUrl, job.payload, config);
}

/**
 * Helper to construct a beautiful Discord Embed payload for a new Event.
 */
export function buildEventCreatedPayload(event: any, club: any): DiscordWebhookPayload {
    return {
        username: 'CampusConnect Bot',
        avatar_url: 'https://cdn.campusconnect.com/bot-avatar.png',
        embeds: [
            {
                title: `🎉 New Event: ${event.title}`,
                description: event.description || 'No description provided.',
                url: `https://campusconnect.com/events/${event.id}`,
                color: 5814783, // CampusConnect Brand Blue (Decimal)
                timestamp: new Date().toISOString(),
                thumbnail: {
                    url: event.bannerUrl || club.logoUrl || 'https://cdn.campusconnect.com/default-banner.png'
                },
                fields: [
                    {
                        name: '📅 Date',
                        value: new Date(event.startDate).toLocaleString('en-US', {
                            weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        }),
                        inline: true
                    },
                    {
                        name: '📍 Location',
                        value: event.location || 'TBA',
                        inline: true
                    },
                    {
                        name: '🏛️ Hosted By',
                        value: club.name,
                        inline: false
                    }
                ],
                footer: {
                    text: 'CampusConnect • Every club. Every event.',
                    icon_url: 'https://cdn.campusconnect.com/favicon.png'
                }
            }
        ]
    };
}
