import { Router } from "express";
import type { Request, Response } from "express";
import { broadcastEventCreate, broadcastEventUpdate, broadcastEventDelete } from "./broadcast";

export interface WebhookBroadcasters {
  broadcastEventCreate: typeof broadcastEventCreate;
  broadcastEventUpdate: typeof broadcastEventUpdate;
  broadcastEventDelete: typeof broadcastEventDelete;
}

const defaultBroadcasters: WebhookBroadcasters = {
  broadcastEventCreate,
  broadcastEventUpdate,
  broadcastEventDelete,
};

export function createWebhookRouter(broadcasters: WebhookBroadcasters = defaultBroadcasters) {
  const router = Router();

  router.post("/webhook/event-created", async (req: Request, res: Response) => {
    const { type, record } = req.body;

    if (type !== "INSERT" || !record) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    const event = {
      id: record.id,
      club_id: record.club_id,
      title: record.title,
      description: record.description,
      banner_url: record.banner_url,
      start_date: record.start_date,
      end_date: record.end_date,
      event_date: record.event_date,
      location: record.location,
      created_at: record.created_at,
    };

    broadcasters.broadcastEventCreate(event).catch((err) => {
      console.error("[Webhook] Error broadcasting event create:", err);
    });

    res.status(202).json({ status: "accepted" });
  });

  router.post("/webhook/event-updated", async (req: Request, res: Response) => {
    const { type, record } = req.body;

    if (type !== "UPDATE" || !record) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    const event = {
      id: record.id,
      club_id: record.club_id,
      title: record.title,
      description: record.description,
      banner_url: record.banner_url,
      start_date: record.start_date,
      end_date: record.end_date,
      event_date: record.event_date,
      location: record.location,
      updated_at: record.updated_at,
    };

    broadcasters.broadcastEventUpdate(event).catch((err) => {
      console.error("[Webhook] Error broadcasting event update:", err);
    });

    res.status(202).json({ status: "accepted" });
  });

  router.post("/webhook/event-deleted", async (req: Request, res: Response) => {
    const { type, record } = req.body;

    if (!record) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }

    broadcasters.broadcastEventDelete(record.id, record.club_id).catch((err) => {
      console.error("[Webhook] Error broadcasting event delete:", err);
    });

    res.status(202).json({ status: "accepted" });
  });

  return router;
}

const router = createWebhookRouter();

export default router;
