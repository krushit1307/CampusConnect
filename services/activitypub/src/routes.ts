import { Router } from "express";
import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  getClubBySlug,
  getOrCreateClubKeys,
  getFollowers,
  getClubEvents,
  saveInboxItem,
} from "./db";
import { signatureMiddleware } from "./signature";
import { DOMAIN } from "./index";
import type { ClubRecord } from "./types";

const router = Router();

function actorUrl(slug: string): string {
  return `https://${DOMAIN}/api/activitypub/actors/${slug}`;
}

function getSlug(req: Request): string {
  const s = req.params.slug;
  return Array.isArray(s) ? s[0] : s;
}

function buildActor(
  slug: string,
  club: {
    name: string;
    description: string | null;
    logo_url: string | null;
    banner_url: string | null;
  },
) {
  return {
    "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
    id: actorUrl(slug),
    type: "Group",
    preferredUsername: slug,
    name: club.name,
    summary: club.description || "",
    icon: club.logo_url ? { type: "Image", url: club.logo_url } : undefined,
    image: club.banner_url ? { type: "Image", url: club.banner_url } : undefined,
    inbox: `${actorUrl(slug)}/inbox`,
    outbox: `${actorUrl(slug)}/outbox`,
    followers: `${actorUrl(slug)}/followers`,
    following: `${actorUrl(slug)}/following`,
    publicKey: {
      id: `${actorUrl(slug)}#main-key`,
      owner: actorUrl(slug),
      publicKeyPem: "",
    },
  };
}

function buildEventNote(
  event: {
    id: string;
    title: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    location: string | null;
    banner_url: string | null;
  },
  clubSlug: string,
): Record<string, unknown> {
  const eventId = `https://${DOMAIN}/events/${event.id}`;
  const note: Record<string, unknown> = {
    id: eventId,
    type: "Event",
    name: event.title,
    summary: event.description || "",
    content: event.description || "",
    url: eventId,
    published: new Date().toISOString(),
    attributedTo: actorUrl(clubSlug),
    to: ["https://www.w3.org/ns/activitystreams#Public"],
  };

  if (event.start_date) note.startTime = event.start_date;
  if (event.end_date) note.endTime = event.end_date;
  if (event.location) note.location = { type: "Place", name: event.location };
  if (event.banner_url) note.image = { type: "Image", url: event.banner_url };

  return note;
}

router.get("/actors/:slug", async (req: Request, res: Response) => {
  const slug = getSlug(req);
  const club = await getClubBySlug(slug);
  if (!club) {
    res.status(404).json({ error: "Actor not found" });
    return;
  }

  const keys = await getOrCreateClubKeys(club.id);
  const actor = buildActor(slug, club);
  actor.publicKey.publicKeyPem = keys.public_key;

  res.set("Content-Type", "application/activity+json");
  res.json(actor);
});

router.get("/actors/:slug/outbox", async (req: Request, res: Response) => {
  const slug = getSlug(req);
  const club = await getClubBySlug(slug);
  if (!club) {
    res.status(404).json({ error: "Actor not found" });
    return;
  }

  const events = await getClubEvents(club.id);
  const orderedItems = events.map((ev) => {
    const note = buildEventNote(ev, slug);
    return {
      id: `${actorUrl(slug)}/activities/${ev.id}`,
      type: "Create",
      actor: actorUrl(slug),
      object: note,
      published: ev.created_at,
      to: ["https://www.w3.org/ns/activitystreams#Public"],
    };
  });

  const outbox = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${actorUrl(slug)}/outbox`,
    type: "OrderedCollection",
    totalItems: orderedItems.length,
    orderedItems,
  };

  res.set("Content-Type", "application/activity+json");
  res.json(outbox);
});

router.get("/actors/:slug/followers", async (req: Request, res: Response) => {
  const slug = getSlug(req);
  const club = await getClubBySlug(slug);
  if (!club) {
    res.status(404).json({ error: "Actor not found" });
    return;
  }

  const followers = await getFollowers(club.id);
  const items = followers.map((f) => f.actor_id);

  const collection = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${actorUrl(slug)}/followers`,
    type: "OrderedCollection",
    totalItems: items.length,
    items,
  };

  res.set("Content-Type", "application/activity+json");
  res.json(collection);
});

router.get("/actors/:slug/following", async (req: Request, res: Response) => {
  const slug = getSlug(req);
  const club = await getClubBySlug(slug);
  if (!club) {
    res.status(404).json({ error: "Actor not found" });
    return;
  }

  const collection = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${actorUrl(slug)}/following`,
    type: "OrderedCollection",
    totalItems: 0,
    items: [],
  };

  res.set("Content-Type", "application/activity+json");
  res.json(collection);
});

router.post(
  "/actors/:slug/inbox",
  signatureMiddleware(false),
  async (req: Request, res: Response) => {
    const slug = getSlug(req);
    const club = await getClubBySlug(slug);
    if (!club) {
      res.status(404).json({ error: "Actor not found" });
      return;
    }

    const activity = req.body as Record<string, unknown>;
    const actorId =
      ((req as unknown as Record<string, unknown>).verifiedActorId as string) ||
      (activity.actor as string) ||
      ((activity.object as Record<string, unknown>)?.attributedTo as string);

    if (!actorId) {
      res.status(400).json({ error: "Could not verify actor" });
      return;
    }

    await saveInboxItem(club.id, actorId, (activity.type as string) || "Unknown", activity);

    if (activity.type === "Follow") {
      await handleFollowActivity(club, slug, actorId, activity);
    }

    res.status(202).json({});
  },
);

router.get("/actors/:slug/inbox", async (req: Request, res: Response) => {
  const slug = getSlug(req);
  const club = await getClubBySlug(slug);
  if (!club) {
    res.status(404).json({ error: "Actor not found" });
    return;
  }

  const collection = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${actorUrl(slug)}/inbox`,
    type: "OrderedCollection",
    totalItems: 0,
    orderedItems: [],
  };

  res.set("Content-Type", "application/activity+json");
  res.json(collection);
});

async function handleFollowActivity(
  club: ClubRecord,
  slug: string,
  actorId: string,
  activity: Record<string, unknown>,
): Promise<void> {
  const { supabase } = await import("./db");

  const actorDoc = await fetch(actorId, {
    headers: { Accept: "application/activity+json" },
  })
    .then(async (r) => (await r.json()) as Record<string, unknown>)
    .catch(() => null);

  if (!actorDoc) return;

  const inboxUrl = actorDoc.inbox as string;
  const preferredUsername = (actorDoc.preferredUsername as string) || "unknown";
  const actorUrlObj = new URL(actorId);
  const domain = actorUrlObj.hostname;

  if (!inboxUrl) return;

  await supabase.from("activitypub_followers").upsert(
    {
      club_id: club.id,
      actor_id: actorId,
      inbox_url: inboxUrl,
      shared_inbox_url: (actorDoc.sharedInbox as string) || null,
      username: preferredUsername,
      domain,
    },
    { onConflict: "club_id, actor_id" },
  );

  const acceptActivity: Record<string, unknown> = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${actorUrl(slug)}/activities/${uuidv4()}`,
    type: "Accept",
    actor: actorUrl(slug),
    object: activity,
  };

  const keys = await getOrCreateClubKeys(club.id);
  const targetInbox = (actorDoc.sharedInbox as string) || inboxUrl;

  await deliverActivity(targetInbox, acceptActivity, actorUrl(slug), keys.private_key);
}

export async function deliverActivity(
  inboxUrl: string,
  activity: Record<string, unknown>,
  actorId: string,
  privateKeyPem: string,
): Promise<void> {
  try {
    const body = JSON.stringify(activity);
    const { createSign } = await import("crypto");

    const inboxUrlObj = new URL(inboxUrl);
    const signer = createSign("RSA-SHA256");
    const date = new Date().toUTCString();
    const digest = await sha256Base64(body);
    const signedString = `(request-target): post ${inboxUrlObj.pathname}\nhost: ${inboxUrlObj.hostname}\ndate: ${date}\ndigest: SHA-256=${digest}`;
    signer.update(signedString, "utf8");
    const signature = signer.sign(privateKeyPem, "base64");

    const signatureHeader = `keyId="${actorId}#main-key",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${signature}"`;

    const response = await fetch(inboxUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/activity+json",
        Host: inboxUrlObj.hostname,
        Date: date,
        Digest: `SHA-256=${digest}`,
        Signature: signatureHeader,
      },
      body,
    });

    if (!response.ok) {
      console.error(`[ActivityPub] Delivery to ${inboxUrl} failed: ${response.status}`);
    }
  } catch (err) {
    console.error(`[ActivityPub] Delivery error to ${inboxUrl}:`, err);
  }
}

async function sha256Base64(input: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(input, "utf8").digest("base64");
}

export default router;
