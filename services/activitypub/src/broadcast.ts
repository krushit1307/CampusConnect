import { v4 as uuidv4 } from "uuid";
import {
  getClubBySlug,
  getClubById,
  getOrCreateClubKeys,
  getFollowers,
  saveActivity,
  getClubKeys,
  getClubEvents,
} from "./db";
import { deliverActivity } from "./routes";
import { DOMAIN } from "./index";

function actorUrl(slug: string): string {
  return `https://${DOMAIN}/api/activitypub/actors/${slug}`;
}

export async function broadcastEventCreate(event: {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  start_date: string | null;
  end_date: string | null;
  event_date: string | null;
  location: string | null;
  created_at: string;
}): Promise<void> {
  const club = await getClubById(event.club_id);
  if (!club || !club.activitypub_enabled) return;

  const slug = club.slug;
  const keys = await getClubKeys(club.id);
  if (!keys) return;

  const followers = await getFollowers(club.id);
  if (followers.length === 0) return;

  const note: Record<string, unknown> = {
    id: `https://${DOMAIN}/events/${event.id}`,
    type: "Event",
    name: event.title,
    summary: event.description || "",
    content: event.description || "",
    url: `https://${DOMAIN}/events/${event.id}`,
    published: event.created_at || new Date().toISOString(),
    attributedTo: actorUrl(slug),
    to: ["https://www.w3.org/ns/activitystreams#Public"],
  };

  if (event.start_date) note.startTime = event.start_date;
  if (event.end_date) note.endTime = event.end_date;
  if (event.location) note.location = { type: "Place", name: event.location };
  if (event.banner_url) note.image = { type: "Image", url: event.banner_url };

  const activityId = `${actorUrl(slug)}/activities/${uuidv4()}`;
  const createActivity: Record<string, unknown> = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: activityId,
    type: "Create",
    actor: actorUrl(slug),
    object: note,
    published: new Date().toISOString(),
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    cc: [`${actorUrl(slug)}/followers`],
  };

  await saveActivity({
    club_id: club.id,
    activity_id: activityId,
    activity_type: "Create",
    object_type: "Event",
    object_id: event.id,
    payload: createActivity,
  });

  const deliveryPromises = followers.map(async (follower) => {
    const targetInbox = follower.shared_inbox_url || follower.inbox_url;
    await deliverActivity(targetInbox, createActivity, actorUrl(slug), keys.private_key);
  });

  await Promise.allSettled(deliveryPromises);
}

export async function broadcastEventUpdate(event: {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  start_date: string | null;
  end_date: string | null;
  event_date: string | null;
  location: string | null;
  updated_at: string;
}): Promise<void> {
  const club = await getClubById(event.club_id);
  if (!club || !club.activitypub_enabled) return;

  const slug = club.slug;
  const keys = await getClubKeys(club.id);
  if (!keys) return;

  const followers = await getFollowers(club.id);
  if (followers.length === 0) return;

  const note: Record<string, unknown> = {
    id: `https://${DOMAIN}/events/${event.id}`,
    type: "Event",
    name: event.title,
    summary: event.description || "",
    content: event.description || "",
    url: `https://${DOMAIN}/events/${event.id}`,
    published: event.updated_at || new Date().toISOString(),
    attributedTo: actorUrl(slug),
    updated: event.updated_at || new Date().toISOString(),
    to: ["https://www.w3.org/ns/activitystreams#Public"],
  };

  if (event.start_date) note.startTime = event.start_date;
  if (event.end_date) note.endTime = event.end_date;
  if (event.location) note.location = { type: "Place", name: event.location };
  if (event.banner_url) note.image = { type: "Image", url: event.banner_url };

  const activityId = `${actorUrl(slug)}/activities/${uuidv4()}`;
  const updateActivity: Record<string, unknown> = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: activityId,
    type: "Update",
    actor: actorUrl(slug),
    object: note,
    published: new Date().toISOString(),
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    cc: [`${actorUrl(slug)}/followers`],
  };

  await saveActivity({
    club_id: club.id,
    activity_id: activityId,
    activity_type: "Update",
    object_type: "Event",
    object_id: event.id,
    payload: updateActivity,
  });

  const deliveryPromises = followers.map(async (follower) => {
    const targetInbox = follower.shared_inbox_url || follower.inbox_url;
    await deliverActivity(targetInbox, updateActivity, actorUrl(slug), keys.private_key);
  });

  await Promise.allSettled(deliveryPromises);
}

export async function broadcastEventDelete(eventId: string, clubId: string): Promise<void> {
  const club = await getClubById(clubId);
  if (!club || !club.activitypub_enabled) return;

  const slug = club.slug;
  const keys = await getClubKeys(club.id);
  if (!keys) return;

  const followers = await getFollowers(club.id);
  if (followers.length === 0) return;

  const activityId = `${actorUrl(slug)}/activities/${uuidv4()}`;
  const deleteActivity: Record<string, unknown> = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: activityId,
    type: "Delete",
    actor: actorUrl(slug),
    object: {
      id: `https://${DOMAIN}/events/${eventId}`,
      type: "Event",
    },
    published: new Date().toISOString(),
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    cc: [`${actorUrl(slug)}/followers`],
  };

  await saveActivity({
    club_id: club.id,
    activity_id: activityId,
    activity_type: "Delete",
    object_type: "Event",
    object_id: eventId,
    payload: deleteActivity,
  });

  const deliveryPromises = followers.map(async (follower) => {
    const targetInbox = follower.shared_inbox_url || follower.inbox_url;
    await deliverActivity(targetInbox, deleteActivity, actorUrl(slug), keys.private_key);
  });

  await Promise.allSettled(deliveryPromises);
}
