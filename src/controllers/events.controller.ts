// =============================================================================
// Controller: Events (Webhook Integration)
// Issue: #2444 - Advanced API Webhook dispatch system for Discord integrations
// Description: Extends the Event Creation endpoint to asynchronously dispatch 
// webhooks to all registered club URLs upon successful publication.
// =============================================================================

import { Request, Response } from 'express';
import { primaryClient } from '../lib/prisma/primaryClient';
import { enqueueWebhookDispatch, buildEventCreatedPayload } from '../services/webhookDispatcher';

/**
 * POST /api/events
 * Creates a new event and triggers webhook dispatch if status is PUBLISHED.
 */
export async function createEvent(req: Request, res: Response) {
    try {
        const { title, description, startDate, endDate, clubId, status } = req.body;
        const userId = req.user?.id;

        // 1. Validate input
        if (!title || !startDate || !clubId) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // 2. Create the event in the Primary Database
        const newEvent = await primaryClient.event.create({
            data: {
                title,
                description,
                startDate: new Date(startDate),
                endDate: endDate ? new Date(endDate) : null,
                clubId,
                createdById: userId,
                status: status || 'DRAFT'
            },
            include: {
                club: true // Include club data for the webhook payload
            }
        });

        // 3. CRITICAL: Asynchronous Webhook Dispatch
        // We ONLY dispatch if the event is immediately published.
        // If it's a DRAFT, webhooks will trigger when the admin updates it to PUBLISHED.
        if (newEvent.status === 'PUBLISHED') {

            // Fetch the registered webhooks for this club
            // Assuming a `webhooks` JSON column or related table exists on the Club model
            const clubConfig = await primaryClient.club.findUnique({
                where: { id: clubId },
                select: { webhookUrls: true } // Assuming JSONB column or similar
            });

            const webhookUrls: string[] = clubConfig?.webhookUrls || [];

            if (webhookUrls.length > 0) {
                // Build the beautiful Discord embed payload
                const payload = buildEventCreatedPayload(newEvent, newEvent.club);

                // Enqueue the jobs. This returns IMMEDIATELY.
                // The HTTP response is not delayed by Discord's API speed.
                await enqueueWebhookDispatch(webhookUrls, payload, clubId, newEvent.id);

                console.log(`[EventsController] Enqueued ${webhookUrls.length} webhook dispatches for event ${newEvent.id}`);
            }
        }

        // 4. Return success to the frontend immediately
        res.status(201).json({
            success: true,
            data: newEvent,
            message: newEvent.status === 'PUBLISHED'
                ? 'Event created and webhooks dispatched.'
                : 'Event saved as draft.'
        });

    } catch (error: any) {
        console.error('[EventsController] Create failed:', error);
        res.status(500).json({ success: false, error: 'Failed to create event' });
    }
}

/**
 * PUT /api/events/:id/publish
 * Specifically handles transitioning an event from DRAFT to PUBLISHED 
 * and triggers the webhook dispatch.
 */
export async function publishEvent(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const event = await primaryClient.event.update({
            where: { id },
            data: { status: 'PUBLISHED' },
            include: { club: true }
        });

        // Fetch webhooks and dispatch
        const clubConfig = await primaryClient.club.findUnique({
            where: { id: event.clubId },
            select: { webhookUrls: true }
        });

        const webhookUrls: string[] = clubConfig?.webhookUrls || [];
        if (webhookUrls.length > 0) {
            const payload = buildEventCreatedPayload(event, event.club);
            await enqueueWebhookDispatch(webhookUrls, payload, event.clubId, event.id);
        }

        res.status(200).json({ success: true, data: event });

    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Failed to publish event' });
    }
}
