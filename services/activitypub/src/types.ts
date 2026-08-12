export interface ClubRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  activitypub_enabled: boolean;
  activitypub_follower_count: number;
}

export interface EventRecord {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  start_date: string | null;
  end_date: string | null;
  event_date: string | null;
  location: string | null;
  status: string;
  created_at: string;
}

export interface FollowerRecord {
  id: string;
  club_id: string;
  actor_id: string;
  inbox_url: string;
  shared_inbox_url: string | null;
  username: string;
  domain: string;
  followed_at: string;
}

export interface KeyRecord {
  id: string;
  club_id: string;
  private_key: string;
  public_key: string;
}

export interface ActivityRecord {
  id: string;
  club_id: string;
  activity_id: string;
  activity_type: string;
  object_type: string | null;
  object_id: string | null;
  payload: Record<string, unknown>;
  delivered: boolean;
  created_at: string;
}

export interface ActivityStreamsObject {
  "@context": string | string[] | Record<string, unknown>;
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface WebFingerResponse {
  subject: string;
  aliases: string[];
  links: Array<{
    rel: string;
    type?: string;
    href?: string;
    template?: string;
  }>;
}

export interface HttpSignatureParts {
  keyId: string;
  algorithm: string;
  headers: string[];
  signature: string;
}
