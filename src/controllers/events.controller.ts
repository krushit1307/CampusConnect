// =============================================================================
// Controller: Events (Mutations & Webhooks)
// Issue: #2424 - Implement Read-Replica routing for massive Analytics queries
// Issue: #2444 - Advanced API Webhook dispatch system for Discord integrations
// Description: Handles all state-mutating operations, registers mutations in DB Router cache,
// and triggers Discord webhooks on successful publication.
// =============================================================================

import { Request, Response } from "express";
import { primaryClient, runPrimaryTransaction } from "../lib/prisma/primaryClient";
import { trackMutation } from "../lib/prisma/dbRouter";
import { enqueueWebhookDispatch, buildEventCreatedPayload } from "../services/webhookDispatcher";
import { lintEventDescription } from "../utils/eventAccessibilityLinter";
import { getRequiredPermits } from "../utils/eventComplianceChecker";
/**
 * POST /api/events
 * Creates a new event.
 * MUST use primaryClient. Registers the new ID in the router cache.
 * Triggers webhook dispatch if status is PUBLISHED.
 */
export async function createEvent(req: Request, res: Response) {
  try {
    const { title, description, startDate, endDate, clubId, status, capacity, category, tags, compliancePermitUrl } = req.body;
    const userId = req.user?.id; // Assuming auth middleware populates req.user

    // Compliance Gatekeeper: block publishing until required permits are uploaded.
    let finalStatus = status || "DRAFT";
    if (finalStatus === "PUBLISHED") {
      const requiredPermits = getRequiredPermits({ capacity, category, tags });
      if (requiredPermits.length > 0) {
        if (!compliancePermitUrl) {
          return res.status(400).json({
            success: false,
            error: "This event requires a permit upload before it can be published.",
            requiredPermits,
          });
        }
        finalStatus = "PENDING_REVIEW";
      }
    }
    // 1. Validate input
    if (!title || !startDate || !clubId) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (status === "PUBLISHED" && description) {
      const accessibilityErrors = lintEventDescription(description);
      if (accessibilityErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Fix these accessibility issues to publish.",
          details: accessibilityErrors,
        });
      }
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
        status: finalStatus,
        capacity,
        category,
        tags,
        compliancePermitUrl,
      },      include: {
        club: true, // Include club data for the webhook payload
      },
    });

    // CRITICAL: Track this mutation in the DB Router cache.
    // If the frontend immediately fetches GET /api/events/:id,
    // the router will see this timestamp and route the read to Primary
    // instead of the laggy Replica.
    trackMutation("Event", newEvent.id);

    // 3. Asynchronous Webhook Dispatch
    // We ONLY dispatch if the event is immediately published.
    // If it's a DRAFT, webhooks will trigger when the admin updates it to PUBLISHED.
    if (newEvent.status === "PUBLISHED") {
      // Fetch the registered webhooks for this club
      // Assuming a `webhookUrls` JSON column or related table exists on the Club model
      const clubConfig = await primaryClient.club.findUnique({
        where: { id: clubId },
        select: { webhookUrls: true },
      });

      const webhookUrls: string[] = clubConfig?.webhookUrls || [];

      if (webhookUrls.length > 0) {
        // Build the beautiful Discord embed payload
        const payload = buildEventCreatedPayload(newEvent, newEvent.club);

        // Enqueue the jobs. This returns IMMEDIATELY.
        // The HTTP response is not delayed by Discord's API speed.
        await enqueueWebhookDispatch(webhookUrls, payload, clubId, newEvent.id);

        console.log(
          `[EventsController] Enqueued ${webhookUrls.length} webhook dispatches for event ${newEvent.id}`,
        );
      }
    }

    // 4. Return success to the frontend immediately
    res.status(201).json({
      success: true,
      data: newEvent,
      message:
        newEvent.status === "PUBLISHED"
          ? "Event created and webhooks dispatched."
          : "Event saved as draft.",
    });
  } catch (error: any) {
    console.error("[EventsController] Create failed:", error);
    res.status(500).json({ success: false, error: "Failed to create event" });
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
    const { title, description, status, capacity, category, tags, compliancePermitUrl } = req.body;

    let finalStatus = status;
    if (status === "PUBLISHED") {
      const requiredPermits = getRequiredPermits({ capacity, category, tags });
      if (requiredPermits.length > 0) {
        if (!compliancePermitUrl) {
          return res.status(400).json({
            success: false,
            error: "This event requires a permit upload before it can be published.",
            requiredPermits,
          });
        }
        finalStatus = "PENDING_REVIEW";
      }
    }

    if (status === "PUBLISHED") {      const eventToValidate = await primaryClient.event.findUnique({ where: { id } });
      if (!eventToValidate) {
        return res.status(404).json({ success: false, error: "Event not found" });
      }
      const finalDescription = description !== undefined ? description : eventToValidate.description;
      if (finalDescription) {
        const accessibilityErrors = lintEventDescription(finalDescription);
        if (accessibilityErrors.length > 0) {
          return res.status(400).json({
            success: false,
            error: "Fix these accessibility issues to publish.",
            details: accessibilityErrors,
          });
        }
      }
    }

    // Use the transaction helper for strict Primary node execution
    const updatedEvent = await runPrimaryTransaction(async (tx) => {
      // 1. Update the event
      const event = await tx.event.update({
        where: { id },
        data: { title, description, status: finalStatus, capacity, category, tags, compliancePermitUrl },
        include: { club: true }, // Needed for webhook payload
      });
      // 2. If status changed to PUBLISHED, log an audit trail
      if (status === "PUBLISHED") {
        await tx.auditLog.create({
          data: {
            action: "EVENT_PUBLISHED",
            entityId: id,
            entityType: "Event",
          },
        });
      }

      return event;
    });

    // Track the mutation to prevent replica lag on subsequent reads
    trackMutation("Event", updatedEvent.id);

    // Dispatch webhooks if transitioning to PUBLISHED
    if (updatedEvent.status === "PUBLISHED") {
      const clubConfig = await primaryClient.club.findUnique({
        where: { id: updatedEvent.clubId },
        select: { webhookUrls: true },
      });

      const webhookUrls: string[] = clubConfig?.webhookUrls || [];
      if (webhookUrls.length > 0) {
        const payload = buildEventCreatedPayload(updatedEvent, updatedEvent.club);
        await enqueueWebhookDispatch(webhookUrls, payload, updatedEvent.clubId, updatedEvent.id);
        console.log(
          `[EventsController] Enqueued ${webhookUrls.length} webhook dispatches for event ${updatedEvent.id}`,
        );
      }
    }

    res.status(200).json({ success: true, data: updatedEvent });
  } catch (error: any) {
    console.error("[EventsController] Update failed:", error);
    res.status(500).json({ success: false, error: "Failed to update event" });
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
        where: { eventId: id },
      });

      // Delete the event itself
      await tx.event.delete({
        where: { id },
      });
    });

    // Track deletion so any immediate read attempts return 404 from Primary
    // instead of stale data from Replica
    trackMutation("Event", id);

    res.status(200).json({ success: true, message: "Event deleted successfully" });
  } catch (error: any) {
    console.error("[EventsController] Delete failed:", error);
    res.status(500).json({ success: false, error: "Failed to delete event" });
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

    const eventToValidate = await primaryClient.event.findUnique({ where: { id } });
    if (!eventToValidate) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }
    if (eventToValidate.description) {
      const accessibilityErrors = lintEventDescription(eventToValidate.description);
      if (accessibilityErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Fix these accessibility issues to publish.",
          details: accessibilityErrors,
        });
      }
    }

    const requiredPermits = getRequiredPermits({
      capacity: eventToValidate.capacity,
      category: eventToValidate.category,
      tags: eventToValidate.tags,
    });
    if (requiredPermits.length > 0 && !eventToValidate.compliancePermitUrl) {
      return res.status(400).json({
        success: false,
        error: "This event requires a permit upload before it can be published.",
        requiredPermits,
      });
    }

    const event = await primaryClient.event.update({
      where: { id },
      data: { status: requiredPermits.length > 0 ? "PENDING_REVIEW" : "PUBLISHED" },
      include: { club: true },
    });
    // Track the mutation for read-replica routing
    trackMutation("Event", event.id);

    // Fetch webhooks and dispatch
    const clubConfig = await primaryClient.club.findUnique({
      where: { id: event.clubId },
      select: { webhookUrls: true },
    });

    const webhookUrls: string[] = clubConfig?.webhookUrls || [];
    if (webhookUrls.length > 0) {
      const payload = buildEventCreatedPayload(event, event.club);
      await enqueueWebhookDispatch(webhookUrls, payload, event.clubId, event.id);
      console.log(
        `[EventsController] Enqueued ${webhookUrls.length} webhook dispatches for event ${event.id}`,
      );
    }

    res.status(200).json({ success: true, data: event });
  } catch (error: any) {
    console.error("[EventsController] Publish failed:", error);
    res.status(500).json({ success: false, error: "Failed to publish event" });
  }
}

/**
 * PUT /api/events/:id/approve-compliance
 * Student Union Admin action: approves an event's uploaded permit(s)
 * and moves it from PENDING_REVIEW to PUBLISHED.
 */
export async function approveEventCompliance(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const eventToValidate = await primaryClient.event.findUnique({ where: { id } });
    if (!eventToValidate) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }
    if (eventToValidate.status !== "PENDING_REVIEW") {
      return res.status(400).json({
        success: false,
        error: "Only events in PENDING_REVIEW can be approved.",
      });
    }
    if (!eventToValidate.compliancePermitUrl) {
      return res.status(400).json({ success: false, error: "No permit document on file." });
    }

    const event = await primaryClient.event.update({
      where: { id },
      data: { status: "PUBLISHED" },
      include: { club: true },
    });

    trackMutation("Event", event.id);

    const clubConfig = await primaryClient.club.findUnique({
      where: { id: event.clubId },
      select: { webhookUrls: true },
    });
    const webhookUrls: string[] = clubConfig?.webhookUrls || [];
    if (webhookUrls.length > 0) {
      const payload = buildEventCreatedPayload(event, event.club);
      await enqueueWebhookDispatch(webhookUrls, payload, event.clubId, event.id);
    }

    res.status(200).json({ success: true, data: event });
  } catch (error: any) {
    console.error("[EventsController] Compliance approval failed:", error);
    res.status(500).json({ success: false, error: "Failed to approve event compliance" });
  }
}