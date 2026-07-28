import { createClient } from "../../src/lib/supabase/client";

const supabase = createClient();

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

interface ClubRecord {
  id: string;
  name: string;
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
const profileLoader = new SimpleDataLoader<string, ProfileRecord>(async (userIds) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds as string[]);

  if (error) throw error;

  const profileMap = new Map<string, ProfileRecord>(
    (data || []).map((p: ProfileRecord) => [p.id, p]),
  );
  return userIds.map((id) => profileMap.get(id) || null);
});

// Batch fetch clubs by ID array
const clubLoader = new SimpleDataLoader<string, ClubRecord>(async (clubIds) => {
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .in("id", clubIds as string[]);

  if (error) throw error;

  const clubMap = new Map<string, ClubRecord>((data || []).map((c: ClubRecord) => [c.id, c]));
  return clubIds.map((id) => clubMap.get(id) || null);
});

// Batch fetch comments for a set of post IDs
const commentsByPostLoader = new SimpleDataLoader<string, CommentRecord[]>(async (postIds) => {
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

// ── GraphQL Type Definitions ──

export const typeDefs = /* GraphQL */ `
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

  type Query {
    posts(limit: Int, offset: Int): [Post!]!
    post(id: ID!): Post
    clubs: [Club!]!
    profiles(limit: Int, offset: Int, sortBy: String, sortOrder: String): [Profile!]!
    totalProfiles: Int!
    events(first: Int, after: String): EventConnection!
    event(id: ID!): Event
  }

  type Mutation {
    suspendUsers(ids: [ID!]!): [Profile!]!
  }
`;

// ── Resolvers Definition ──

export const resolvers = {
  Query: {
    posts: async (_: unknown, { limit = 10, offset = 0 }: { limit?: number; offset?: number }) => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
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
      const { data, error } = await supabase.from("clubs").select("*");
      if (error) throw error;
      return data || [];
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
      let query = supabase.from("profiles").select("*");

      const allowedColumns = ["id", "full_name", "handle", "role", "is_banned"];
      const actualSortBy = allowedColumns.includes(sortBy) ? sortBy : "full_name";
      const actualSortOrder = sortOrder === "desc" ? "desc" : "asc";

      query = query
        .order(actualSortBy, { ascending: actualSortOrder === "asc", nullsFirst: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
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
  },

  Post: {
    author: (parent: { author_id: string }) => {
      return parent.author_id ? profileLoader.load(parent.author_id) : null;
    },
    club: (parent: { club_id: string }) => {
      return parent.club_id ? clubLoader.load(parent.club_id) : null;
    },
    comments: (parent: { id: string }) => {
      return commentsByPostLoader.load(parent.id);
    },
  },

  Comment: {
    author: (parent: { author_id: string }) => {
      return parent.author_id ? profileLoader.load(parent.author_id) : null;
    },
  },

  Event: {
    club: (parent: { club_id: string }) => {
      return parent.club_id ? clubLoader.load(parent.club_id) : null;
    },
    organizer: (parent: { created_by: string }) => {
      return parent.created_by ? profileLoader.load(parent.created_by) : null;
    },
  },
};
