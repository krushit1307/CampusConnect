import DataLoader from "dataloader";
import { createClient } from "../../src/lib/supabase/client";

const supabase = createClient();

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

// ── DataLoaders for batching nested relations (solving N+1) ──

// Batch fetch profiles by ID array
const profileLoader = new DataLoader<string, ProfileRecord | null>(async (userIds) => {
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
const clubLoader = new DataLoader<string, ClubRecord | null>(async (clubIds) => {
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .in("id", clubIds as string[]);

  if (error) throw error;

  const clubMap = new Map<string, ClubRecord>((data || []).map((c: ClubRecord) => [c.id, c]));
  return clubIds.map((id) => clubMap.get(id) || null);
});

// Batch fetch comments for a set of post IDs
const commentsByPostLoader = new DataLoader<string, CommentRecord[]>(async (postIds) => {
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

  return postIds.map((id) => commentsGrouped.get(id) || []);
});

// ── GraphQL Type Definitions ──

export const typeDefs = /* GraphQL */ `
  type Profile {
    id: ID!
    full_name: String
    handle: String
    role: String
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

  type Query {
    posts(limit: Int, offset: Int): [Post!]!
    post(id: ID!): Post
    clubs: [Club!]!
    profiles: [Profile!]!
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
    profiles: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
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
};
