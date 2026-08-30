import { GraphQLError } from "graphql";
import { pubsub, RedisPubSub } from "../pubsub";
import { createClient } from "../../src/lib/supabase/client";
import { query as pgQuery } from "../db";
const supabase = createClient();

// Redis-backed PubSub (with in-memory fallback) used across all subscriptions.
export { pubsub, RedisPubSub };

// ── Message Record Interface ──
export interface ChatMessageRecord {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  created_at: string;
  is_shadowbanned?: boolean;
}

// ── Notification Record Interface ──
export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  recent_actors?: string[] | null;
  group_count?: number | null;
  reference_id?: string | null;
}

/**
 * Publish a notification so any active subscription for that user receives it.
 * Call this from server-side triggers (e.g. mention detector, event update handler).
 */
export function publishNotification(notification: NotificationRecord): void {
  pubsub.publish("NOTIFICATION_RECEIVED", notification.user_id, notification);
}

/**
 * Helper to emit a discussion mention notification to a specific user.
 * Triggered when a user is @mentioned in a post, comment, or discussion.
 */
export function publishMentionNotification(params: {
  mentionedUserId: string;
  authorName: string;
  discussionTitle: string;
  link?: string;
}): NotificationRecord {
  const notification: NotificationRecord = {
    id: `notif_mention_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: params.mentionedUserId,
    type: "mention",
    title: "Mentioned in Discussion",
    message: `${params.authorName} mentioned you in "${params.discussionTitle}"`,
    link: params.link ?? null,
    is_read: false,
    created_at: new Date().toISOString(),
  };

  pubsub.publish("NOTIFICATION_RECEIVED", params.mentionedUserId, notification);
  return notification;
}

/**
 * Helper to emit an event update notification to all RSVP'd attendees of an event.
 * Triggered when an event's details, date, or location are updated.
 */
export function publishEventUpdateNotification(params: {
  eventId: string;
  eventTitle: string;
  updateSummary: string;
  attendeeUserIds: string[];
}): NotificationRecord[] {
  const notifications: NotificationRecord[] = params.attendeeUserIds.map((userId) => {
    const notification: NotificationRecord = {
      id: `notif_event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      type: "event_update",
      title: `Event Updated: ${params.eventTitle}`,
      message: params.updateSummary,
      link: `/events/${params.eventId}`,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    pubsub.publish("NOTIFICATION_RECEIVED", userId, notification);
    return notification;
  });

  return notifications;
}

// ── In-Memory LRU Cache Class ──
export class LRUCache<K, V> {
  private max: number;
  private cache: Map<K, V>;

  constructor(max: number = 100) {
    this.max = max;
    this.cache = new Map<K, V>();
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (item !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export interface ClubRecord {
  id: string;
  name: string;
}

// Cache for global clubs directory
export const clubsCache = new LRUCache<string, ClubRecord[]>(5);
export const CLUBS_CACHE_KEY = "all_clubs";

// Cache for directory search / profiles query
export const profilesCache = new LRUCache<string, ProfileRecord[]>(50);

if (typeof supabase.channel === "function") {
  supabase
    .channel("clubs-cache-invalidation")
    .on("postgres_changes", { event: "*", schema: "public", table: "clubs" }, () => {
      clubsCache.delete(CLUBS_CACHE_KEY);
    })
    .subscribe();

  supabase
    .channel("profiles-cache-invalidation")
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
      profilesCache.clear();
    })
    .subscribe();
}

// ── Lightweight Batch Loader Class ──

class SimpleDataLoader<K extends string, V> {
  private batchFn: (keys: readonly K[]) => Promise<(V | null)[]>;
  private cache = new Map<K, V | null>();

  constructor(batchFn: (keys: readonly K[]) => Promise<(V | null)[]>) {
    this.batchFn = batchFn;
  }

  async load(key: K): Promise<V | null> {
    if (this.cache.has(key)) {
      return this.cache.get(key) || null;
    }
    const results = await this.batchFn([key]);
    const val = results[0] || null;
    this.cache.set(key, val);
    return val;
  }
}

// ── Interfaces ──

interface ProfileRecord {
  id: string;
  full_name: string | null;
  handle: string | null;
  role: string | null;
}

interface CommentRecord {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  author_id: string;
  deleted_at: string | null;
}

export interface EventRecord {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  event_date: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
  is_private?: boolean | null;
}

// ── Cursor Encoding / Decoding Helpers ──

export function encodeCursor(record: { created_at: string; id: string }): string {
  const str = `${record.created_at}::${record.id}`;
  return typeof btoa === "function" ? btoa(str) : Buffer.from(str, "utf-8").toString("base64");
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const str =
      typeof atob === "function" ? atob(cursor) : Buffer.from(cursor, "base64").toString("utf-8");
    const parts = str.split("::");
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { createdAt: parts[0], id: parts[1] };
    }
  } catch {
    return null;
  }
  return null;
}

// ── DataLoaders for batching nested relations (solving N+1) ──

// Batch fetch profiles by ID array
export const createProfileLoader = () =>
  new SimpleDataLoader<string, ProfileRecord>(async (userIds) => {
    // A feed page can reference hundreds of distinct authors at once.
    // Passing the whole array as ONE bound parameter (ANY($1)) avoids
    // building/parsing a giant "IN ($1, $2, ..., $500)" SQL string.
    const { rows } = await pgQuery<ProfileRecord>("SELECT * FROM profiles WHERE id = ANY($1)", [
      userIds,
    ]);

    const profileMap = new Map<string, ProfileRecord>(rows.map((p) => [p.id, p]));

    return userIds.map((id) => profileMap.get(id) || null);
  });
// Batch fetch clubs by ID array
export const createClubLoader = () =>
  new SimpleDataLoader<string, ClubRecord>(async (clubIds) => {
    // Same array-binding optimization as createProfileLoader above.
    const { rows } = await pgQuery<ClubRecord>("SELECT * FROM clubs WHERE id = ANY($1)", [
      clubIds,
    ]);

    const clubMap = new Map<string, ClubRecord>(rows.map((c) => [c.id, c]));

    return clubIds.map((id) => clubMap.get(id) || null);
  });
// Batch fetch comments for a set of post IDs
export const createCommentsByPostLoader = () =>
  new SimpleDataLoader<string, CommentRecord[]>(async (postIds) => {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .in("post_id", postIds as string[])
      .is("deleted_at", null);

    if (error) throw error;

    const commentsGrouped = new Map<string, CommentRecord[]>();

    postIds.forEach((id) => commentsGrouped.set(id, []));

    (data || []).forEach((comment: CommentRecord) => {
      commentsGrouped.get(comment.post_id)?.push(comment);
    });

    return postIds.map((id) => commentsGrouped.get(id) || null);
  });
interface GraphQLContext {
  user: {
    id: string;
    role: string;
  } | null;
  profileLoader: ReturnType<typeof createProfileLoader>;
  clubLoader: ReturnType<typeof createClubLoader>;
  commentsByPostLoader: ReturnType<typeof createCommentsByPostLoader>;
}

// ── GraphQL Type Definitions ──

export const typeDefs = /* GraphQL */ `
  scalar EmailAddress

  type Profile {
    id: ID!
    full_name: String
    handle: String
    role: String
    is_banned: Boolean
  }

  type Club {
    id: ID!
    name: String
  }

  type Comment {
    id: ID!
    content: String!
    created_at: String!
    post_id: ID!
    author: Profile
  }

  type Post {
    id: ID!
    content: String!
    created_at: String!
    pinned: Boolean!
    club_id: ID!
    author_id: ID!
    author: Profile
    club: Club
    comments: [Comment!]!
  }

  type PostEdge {
    cursor: String!
    node: Post!
  }

  type PostConnection {
    edges: [PostEdge!]!
    nodes: [Post!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type Event {
    id: ID!
    club_id: ID!
    title: String!
    description: String
    banner_url: String
    event_date: String
    start_date: String
    end_date: String
    location: String
    created_by: ID
    created_at: String
    updated_at: String
    is_private: Boolean
    max_attendees: Int
    maxAttendees: Int
    available_spots: Int
    availableSpots: Int
    version: Int
    club: Club
    organizer: Profile
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type EventEdge {
    cursor: String!
    node: Event!
  }

  type EventConnection {
    edges: [EventEdge!]!
    nodes: [Event!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  """
  Notification types emitted via GraphQL Subscriptions.
  """
  enum NotificationType {
    MENTION
    EVENT_UPDATE
    GENERIC
  }

  """
  A notification delivered to a specific user.
  """
  type Notification {
    id: ID!
    userId: ID!
    type: NotificationType!
    title: String!
    message: String!
    link: String
    isRead: Boolean!
    createdAt: String!
    recentActors: [ID!]
    groupCount: Int
    referenceId: ID
  }

  """
  A message in an event's live chat, delivered in real-time via the
  messageAdded subscription.
  """
  type Message {
    id: ID!
    eventId: ID!
    userId: ID!
    author: Profile
    content: String!
    createdAt: String!
    isShadowbanned: Boolean
  }

  type Query {
    posts(first: Int, after: String): PostConnection!
    post(id: ID!): Post
    clubs: [Club!]!
    profiles(limit: Int, offset: Int, sortBy: String, sortOrder: String): [Profile!]!
    totalProfiles: Int!
    events(first: Int, after: String): EventConnection!
    event(id: ID!): Event
    allUsers: [Profile!]! @auth(requires: ADMIN)
    """
    Recent messages in an event's live chat. Used to backfill history after a
    dropped WebSocket connection.
    """
    messages(eventId: ID!, limit: Int, before: String): [Message!]!
  }

  """
  Result payload returned by event RSVP mutation.
  """
  type RsvpPayload {
    success: Boolean!
    code: String!
    message: String!
    availableSpots: Int
    status: String
    version: Int
  }

  type Mutation {
    suspendUsers(ids: [ID!]!): [Profile!]!
    """
    Manage event RSVPs with strict row-level locking (SELECT FOR UPDATE)
    and optimistic concurrency control (version increments).
    Prevents race conditions and overbooking.
    """
    rsvpToEvent(eventId: ID!, userId: ID, action: String): RsvpPayload!
    """
    Send a message to an event's live chat. Persists the message and
    publishes it to the event's Redis channel so every connected client
    receives it via the messageAdded subscription.
    """
    addMessage(eventId: ID!, content: String!): Message!
  }

  """
  Subscribe to real-time notifications for a specific user.
  Clients receive events when they are mentioned in discussions
  or when an event they RSVP'd to is updated.
  """
  type Subscription {
    notificationReceived(userId: ID!): Notification!
    """
    Subscribe to new messages in an event's live chat. Yields a Message for
    every addMessage mutation published to the event's Redis channel.
    """
    messageAdded(eventId: ID!): Message!
  }
`;

// ── Resolvers Definition ──

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const resolvers = {
  EmailAddress: {
    serialize: (value: string) => value.toLowerCase().trim(),
    parseValue: (value: unknown) => {
      if (typeof value !== "string" || !isValidEmail(value)) {
        throw new GraphQLError("EmailAddress must be a valid email address");
      }
      return value.toLowerCase().trim();
    },
    parseLiteral: (ast: { kind: string; value: string }) => {
      if (ast.kind !== "StringValue") {
        throw new GraphQLError("EmailAddress must be a string");
      }
      if (!isValidEmail(ast.value)) {
        throw new GraphQLError("EmailAddress must be a valid email address");
      }
      return ast.value.toLowerCase().trim();
    },
  },

  Query: {
    posts: async (_: unknown, { first = 10, after }: { first?: number; after?: string }) => {
      const limit = Math.max(1, Math.min(first, 100));
      let query = supabase.from("posts").select("*", { count: "exact" }).is("deleted_at", null);

      if (after) {
        const decoded = decodeCursor(after);
        if (decoded) {
          query = query.or(
            `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
          );
        }
      }

      // Fetch limit + 1 items to accurately calculate hasNextPage
      query = query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);

      const { data, count, error } = await query;
      if (error) throw error;

      const rawPosts = data || [];
      const hasNextPage = rawPosts.length > limit;
      const nodes = hasNextPage ? rawPosts.slice(0, limit) : rawPosts;

      const edges = nodes.map((node) => ({
        cursor: encodeCursor(node),
        node,
      }));

      const startCursor = edges.length > 0 ? edges[0].cursor : null;
      const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

      return {
        edges,
        nodes,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!after,
          startCursor,
          endCursor,
        },
        totalCount: count ?? nodes.length,
      };
    },
    post: async (_: unknown, { id }: { id: string }) => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (error) throw error;
      return data;
    },
    clubs: async () => {
      const cached = clubsCache.get(CLUBS_CACHE_KEY);
      if (cached) {
        return cached;
      }
      const { data, error } = await supabase.from("clubs").select("*");
      if (error) throw error;
      const result = data || [];
      clubsCache.set(CLUBS_CACHE_KEY, result);
      return result;
    },
    profiles: async (
      _: unknown,
      {
        limit = 20,
        offset = 0,
        sortBy = "full_name",
        sortOrder = "asc",
      }: {
        limit?: number;
        offset?: number;
        sortBy?: string;
        sortOrder?: string;
      },
    ) => {
      const cacheKey = `profiles:${limit}:${offset}:${sortBy}:${sortOrder}`;
      const cached = profilesCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      let query = supabase.from("profiles").select("*");

      const allowedColumns = ["id", "full_name", "handle", "role", "is_banned"];
      const actualSortBy = allowedColumns.includes(sortBy) ? sortBy : "full_name";
      const actualSortOrder = sortOrder === "desc" ? "desc" : "asc";

      query = query
        .order(actualSortBy, { ascending: actualSortOrder === "asc", nullsFirst: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;
      if (error) throw error;

      const result = data || [];
      profilesCache.set(cacheKey, result);
      return result;
    },
    totalProfiles: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
    events: async (_: unknown, { first = 10, after }: { first?: number; after?: string }) => {
      const limit = Math.max(1, Math.min(first, 100));
      let query = supabase.from("events").select("*", { count: "exact" });

      if (after) {
        const decoded = decodeCursor(after);
        if (decoded) {
          // Robust keyset pagination: created_at < cursor.createdAt OR (created_at = cursor.createdAt AND id < cursor.id)
          query = query.or(
            `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
          );
        }
      }

      // Fetch limit + 1 items to accurately calculate hasNextPage
      query = query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);

      const { data, count, error } = await query;
      if (error) throw error;

      const rawEvents: EventRecord[] = data || [];
      const hasNextPage = rawEvents.length > limit;
      const nodes = hasNextPage ? rawEvents.slice(0, limit) : rawEvents;

      const edges = nodes.map((node) => ({
        cursor: encodeCursor(node),
        node,
      }));

      const startCursor = edges.length > 0 ? edges[0].cursor : null;
      const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

      return {
        edges,
        nodes,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!after,
          startCursor,
          endCursor,
        },
        totalCount: count ?? nodes.length,
      };
    },
    event: async (_: unknown, { id }: { id: string }) => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();

      if (error) throw error;
      return data;
    },
    messages: async (
      _: unknown,
      { eventId, limit = 50, before }: { eventId: string; limit?: number; before?: string },
      context: GraphQLContext,
    ) => {
      const cappedLimit = Math.max(1, Math.min(limit, 100));
      let query = supabase
        .from("event_chat_messages")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(cappedLimit);

      if (before) {
        query = query.lt("created_at", before);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Return in chronological order (oldest → newest) for the chat UI.
      return ((data ?? []) as ChatMessageRecord[])
        .reverse()
        .map((row) => mapMessageToGraphQL(row, context));
    },
    allUsers: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data || [];
    },
  },

  Mutation: {
    suspendUsers: async (_: unknown, { ids }: { ids: string[] }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ is_banned: true })
        .in("id", ids)
        .select("*");

      if (error) throw error;
      return data || [];
    },
    rsvpToEvent: async (
      _: unknown,
      { eventId, userId, action = "RSVP" }: { eventId: string; userId?: string; action?: string },
    ) => {
      const { data, error } = await supabase.rpc("manage_event_rsvp", {
        p_event_id: eventId,
        p_user_id: userId || null,
        p_action: action,
      });

      if (error) throw new Error(error.message);

      return {
        success: data?.success ?? false,
        code: data?.code ?? "ERROR",
        message: data?.message ?? "An error occurred during RSVP processing.",
        availableSpots: data?.available_spots ?? null,
        status: data?.status ?? null,
        version: data?.version ?? null,
      };
    },
    addMessage: async (
      _: unknown,
      { eventId, content }: { eventId: string; content: string },
      context: GraphQLContext,
    ) => {
      if (!context.user) {
        throw new GraphQLError("You must be signed in to send a message", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const text = content.trim();
      if (!text) {
        throw new GraphQLError("Message content cannot be empty");
      }
      if (text.length > 500) {
        throw new GraphQLError("Message cannot exceed 500 characters");
      }

      const { data, error } = await supabase.rpc("send_event_chat_message", {
        p_event_id: eventId,
        p_user_id: context.user.id,
        p_content: text,
      });

      if (error) throw new Error(error.message);

      const result = data as {
        success: boolean;
        message?: string;
        data?: ChatMessageRecord;
      } | null;
      if (!result?.success || !result.data) {
        throw new GraphQLError(result?.message ?? "Could not send message");
      }

      const message = await mapMessageToGraphQL(result.data, context);

      // Fan the message out to every client subscribed to this event's chat.
      await pubsub.publish("MESSAGE_ADDED", eventId, message);

      return message;
    },
  },

  Post: {
    author: (parent: { author_id: string }, _: unknown, context: GraphQLContext) => {
      return parent.author_id ? context.profileLoader.load(parent.author_id) : null;
    },

    club: (parent: { club_id: string }, _: unknown, context: GraphQLContext) => {
      return parent.club_id ? context.clubLoader.load(parent.club_id) : null;
    },

    comments: (parent: { id: string }, _: unknown, context: GraphQLContext) => {
      return context.commentsByPostLoader.load(parent.id);
    },
  },

  Comment: {
    author: (parent: { author_id: string }, _: unknown, context: GraphQLContext) => {
      return parent.author_id ? context.profileLoader.load(parent.author_id) : null;
    },
  },

  Event: {
    club: (parent: { club_id: string }, _: unknown, context: GraphQLContext) => {
      return parent.club_id ? context.clubLoader.load(parent.club_id) : null;
    },

    organizer: (parent: { created_by: string }, _: unknown, context: GraphQLContext) => {
      return parent.created_by ? context.profileLoader.load(parent.created_by) : null;
    },

    maxAttendees: (parent: { max_attendees?: number | null }) => parent.max_attendees ?? null,

    availableSpots: (parent: { available_spots?: number | null }) => parent.available_spots ?? null,
  },

  Subscription: {
    notificationReceived: {
      /**
       * subscribe() returns an AsyncIterable that yields each notification
       * published to the NOTIFICATION_RECEIVED channel for this userId.
       *
       * GraphQL Yoga + @graphql-yoga/subscription handles SSE transport
       * automatically — no additional WebSocket configuration required.
       */
      subscribe: (_: unknown, { userId }: { userId: string }) =>
        pubsub.subscribe("NOTIFICATION_RECEIVED", userId),

      /**
       * resolve() maps the raw NotificationRecord (snake_case from Supabase)
       * to the GraphQL Notification type (camelCase fields).
       */
      resolve: (payload: NotificationRecord) => ({
        id: payload.id,
        userId: payload.user_id,
        type: mapNotificationType(payload.type),
        title: payload.title,
        message: payload.message,
        link: payload.link ?? null,
        isRead: payload.is_read,
        createdAt: payload.created_at,
        recentActors: payload.recent_actors ?? [],
        groupCount: payload.group_count ?? 1,
        referenceId: payload.reference_id ?? null,
      }),
    },
    messageAdded: {
      subscribe: async function* (_: unknown, { eventId }: { eventId: string }, context: GraphQLContext) {
        const iterator = pubsub.subscribe<MessageRecord>("MESSAGE_ADDED", eventId);
        for await (const message of iterator) {
          if (message.isShadowbanned) {
            const isAuthor = context.user?.id === message.userId;
            const isAdmin = context.user && ["admin", "moderator", "club_admin", "system_admin"].includes(context.user.role);
            if (isAuthor || isAdmin) {
              yield message;
            }
          } else {
            yield message;
          }
        }
      },
      resolve: (payload: MessageRecord) => payload,
    },
  },

  /**
   * Notification field resolvers for camelCase ↔ snake_case mapping.
   * These handle the case when Notification is returned in other Query fields.
   */
  Notification: {
    userId: (parent: NotificationRecord) => parent.user_id,
    isRead: (parent: NotificationRecord) => parent.is_read,
    createdAt: (parent: NotificationRecord) => parent.created_at,
    type: (parent: NotificationRecord) => mapNotificationType(parent.type),
    recentActors: (parent: NotificationRecord) => parent.recent_actors ?? [],
    groupCount: (parent: NotificationRecord) => parent.group_count ?? 1,
    referenceId: (parent: NotificationRecord) => parent.reference_id ?? null,
  },
};

// ── Notification type mapper ──

/**
 * Maps raw `type` string from the notifications table to the
 * GraphQL NotificationType enum value.
 */
function mapNotificationType(type: string): "MENTION" | "EVENT_UPDATE" | "GENERIC" {
  if (type === "mention") return "MENTION";
  if (type === "event_update") return "EVENT_UPDATE";
  return "GENERIC";
}

// ── Message type mapper ──

/** The GraphQL `Message` shape published/subscribed over Redis. */
export interface MessageRecord {
  id: string;
  eventId: string;
  userId: string;
  author: ProfileRecord | null;
  content: string;
  createdAt: string;
  isShadowbanned?: boolean;
}

/**
 * Maps a `event_chat_messages` row (snake_case) to the GraphQL Message shape
 * (camelCase), enriching it with the sender's profile via the batch loader.
 */
async function mapMessageToGraphQL(
  record: ChatMessageRecord,
  context: GraphQLContext,
): Promise<MessageRecord> {
  let author: ProfileRecord | null = null;
  try {
    author = await context.profileLoader.load(record.user_id);
  } catch {
    author = null;
  }

  return {
    id: record.id,
    eventId: record.event_id,
    userId: record.user_id,
    author,
    content: record.content,
    createdAt: record.created_at,
    isShadowbanned: record.is_shadowbanned ?? false,
  };
}
