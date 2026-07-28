import { createClient } from "@supabase/supabase-js";
import type { ClubRecord, EventRecord, FollowerRecord, KeyRecord, ActivityRecord } from "./types";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getClubBySlug(slug: string): Promise<ClubRecord | null> {
  const { data } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .eq("activitypub_enabled", true)
    .single();
  return data as ClubRecord | null;
}

export async function getClubById(id: string): Promise<ClubRecord | null> {
  const { data } = await supabase.from("clubs").select("*").eq("id", id).single();
  return data as ClubRecord | null;
}

export async function getClubKeys(clubId: string): Promise<KeyRecord | null> {
  const { data } = await supabase
    .from("activitypub_keys")
    .select("*")
    .eq("club_id", clubId)
    .single();
  return data as KeyRecord | null;
}

export async function getOrCreateClubKeys(clubId: string): Promise<KeyRecord> {
  const existing = await getClubKeys(clubId);
  if (existing) return existing;

  const { publicKey, privateKey } = await generateRSAKeyPair();

  const { data } = await supabase
    .from("activitypub_keys")
    .insert({ club_id: clubId, private_key: privateKey, public_key: publicKey })
    .select()
    .single();

  return data as KeyRecord;
}

export async function getFollowers(clubId: string): Promise<FollowerRecord[]> {
  const { data } = await supabase.from("activitypub_followers").select("*").eq("club_id", clubId);
  return (data as FollowerRecord[]) || [];
}

export async function getClubEvents(clubId: string): Promise<EventRecord[]> {
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });
  return (data as EventRecord[]) || [];
}

export async function getActivityById(activityId: string): Promise<ActivityRecord | null> {
  const { data } = await supabase
    .from("activitypub_activities")
    .select("*")
    .eq("activity_id", activityId)
    .single();
  return data as ActivityRecord | null;
}

export async function saveActivity(
  record: Omit<ActivityRecord, "id" | "created_at" | "delivered">,
): Promise<void> {
  await supabase.from("activitypub_activities").insert(record);
}

export async function markActivityDelivered(activityId: string): Promise<void> {
  await supabase
    .from("activitypub_activities")
    .update({ delivered: true })
    .eq("activity_id", activityId);
}

export async function saveInboxItem(
  clubId: string,
  actorId: string,
  activityType: string,
  raw: Record<string, unknown>,
): Promise<void> {
  await supabase.from("activitypub_inbox").insert({
    club_id: clubId,
    actor_id: actorId,
    activity_type: activityType,
    raw,
  });
}

async function generateRSAKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const { generateKeyPairSync } = await import("crypto");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}
