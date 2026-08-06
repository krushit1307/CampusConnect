// =============================================================================
// Controller: Events (Mutations)
// Issue: #2424 - Implement Read-Replica routing for massive Analytics queries
// Description: Handles all state-mutating operations (CREATE, UPDATE, DELETE).
// Strictly utilizes the primaryClient and registers mutations in the DB Router 
// cache to prevent Read-After-Write replication lag issues.
// =============================================================================

import { Request, Response } from 'express';
import { primaryClient, runPrimaryTransaction } from '../lib/prisma/primaryClient';
import { trackMutation } from '../lib/prisma/dbRouter';

/**
 * POST /api/events
 * Creates a new event.
 * MUST use primaryClient. Registers the new ID in the router cache.
 */
export async function createEvent(req: Request, res: Response) {
    try {
        const { title, description, startDate, endDate, clubId } = req.body;
        const userId = req.user?.id; // Assuming auth middleware populates req.user

        if (!title || !startDate || !clubId) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Execute strictly on the Primary node
        const newEvent = await primaryClient.event.create({
            data: {
                title,
                description,
                startDate: new Date(startDate),
                endDate: endDate ? new Date(endDate) : null,
                clubId,
                createdById: userId,
                status: 'DRAFT'
            }
        });

        // CRITICAL: Track this mutation in the DB Router cache.
        // If the frontend immediately fetches GET /api/events/:id, 
        // the router will see this timestamp and route the read to Primary 
        // instead of the laggy Replica.
        trackMutation('Event', newEvent.id);

        res.status(201).json({ success: true, data: newEvent });

    } catch (error: any) {
        console.error('[EventsController] Create failed:', error);
        res.status(500).json({ success: false, error: 'Failed to create event' });
    }
}

/**
 * PUT /api/events/:id
 * Updates an existing event.
 * Uses a Primary Transaction to ensure atomic updates across related tables.
 */
export async function updateEvent(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { title, description, status } = req.body;

        // Use the transaction helper for strict Primary node execution
        const updatedEvent = await runPrimaryTransaction(async (tx) => {

            // 1. Update the event
            const event = await tx.event.update({
                where: { id },
                data: { title, description, status }
            });

            // 2. If status changed to PUBLISHED, log an audit trail
            if (status === 'PUBLISHED') {
                await tx.auditLog.create({
                    data: {
                        action: 'EVENT_PUBLISHED',
                        entityId: id,
                        entityType: 'Event'
                    }
                });
            }

            return event;
        });

        // Track the mutation to prevent replica lag on subsequent reads
        trackMutation('Event', updatedEvent.id);

        res.status(200).json({ success: true, data: updatedEvent });

    } catch (error: any) {
        console.error('[EventsController] Update failed:', error);
        res.status(500).json({ success: false, error: 'Failed to update event' });
    }
}

/**
 * DELETE /api/events/:id
 * Deletes an event and all associated RSVPs.
 * MUST use primaryClient.
 */
export async function deleteEvent(req: Request, res: Response) {
    try {
        const { id } = req.params;

        await runPrimaryTransaction(async (tx) => {
            // Cascade delete RSVPs first to prevent foreign key constraint errors
            await tx.eventRsvp.deleteMany({
                where: { eventId: id }
            });

            // Delete the event itself
            await tx.event.delete({
                where: { id }
            });
        });

        // Track deletion so any immediate read attempts return 404 from Primary 
        // instead of stale data from Replica
        trackMutation('Event', id);

        res.status(200).json({ success: true, message: 'Event deleted successfully' });

    } catch (error: any) {
        console.error('[EventsController] Delete failed:', error);
        res.status(500).json({ success: false, error: 'Failed to delete event' });
    }
}
