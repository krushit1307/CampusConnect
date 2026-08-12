// =============================================================================
// Model: Webhooks Schema & Validation
// Issue: #2444 - Advanced API Webhook dispatch system for Discord integrations
// Description: Defines the Zod schemas and database structure for storing 
// club webhook configurations safely.
// =============================================================================

import { z } from 'zod';

/**
 * Zod Schema for validating a single Webhook URL input from the frontend.
 * Enforces HTTPS and basic structure before it even hits the backend validator.
 */
export const WebhookUrlSchema = z.string()
    .url('Must be a valid URL')
    .startsWith('https://', 'Webhooks must use HTTPS for security')
    .max(2048, 'URL is too long')
    .refine(
        (url) => {
            try {
                const parsed = new URL(url);
                // Block obvious localhost/internal attempts at the schema level
                return !parsed.hostname.includes('localhost') &&
                    !parsed.hostname.includes('127.0.0.1') &&
                    !parsed.hostname.includes('internal');
            } catch {
                return false;
            }
        },
        { message: 'Internal or localhost URLs are strictly prohibited' }
    );

/**
 * Schema for the Club Webhook Settings update payload.
 */
export const UpdateWebhooksSchema = z.object({
    clubId: z.string().uuid(),
    webhookUrls: z.array(WebhookUrlSchema).max(5, 'Maximum of 5 webhooks allowed per club'),
    notifyOnEventCreate: z.boolean().default(true),
    notifyOnEventCancel: z.boolean().default(false),
    notifyOnNewMember: z.boolean().default(false)
});

export type UpdateWebhooksInput = z.infer<typeof UpdateWebhooksSchema>;

/**
 * Database Schema Representation (Prisma/SQL equivalent)
 * 
 * TABLE club_webhooks (
 *   id UUID PRIMARY KEY,
 *   club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
 *   url TEXT NOT NULL,
 *   is_active BOOLEAN DEFAULT TRUE,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   last_triggered_at TIMESTAMPTZ,
 *   failure_count INT DEFAULT 0,
 *   UNIQUE(club_id, url)
 * );
 * 
 * CREATE INDEX idx_club_webhooks_club_id ON club_webhooks(club_id);
 */

/**
 * Interface representing a stored Webhook configuration.
 */
export interface WebhookConfig {
    id: string;
    clubId: string;
    url: string;
    isActive: boolean;
    createdAt: Date;
    lastTriggeredAt: Date | null;
    failureCount: number;
}

/**
 * Helper to format the database rows into the application interface.
 */
export function mapDbRowToConfig(row: any): WebhookConfig {
    return {
        id: row.id,
        clubId: row.club_id,
        url: row.url,
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at) : null,
        failureCount: row.failure_count || 0
    };
}
