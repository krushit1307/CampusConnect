// @ts-ignore: Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports
import { createYoga, createSchema } from "https://esm.sh/graphql-yoga@5.1.0";
// @ts-ignore: Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const typeDefs = /* GraphQL */ `
  type Profile {
    id: ID!
    first_name: String
    last_name: String
    college: String
    bio: String
    avatar_url: String
    role: String
    created_at: String
  }

  type Club {
    id: ID!
    name: String!
    slug: String!
    description: String
    banner_url: String
  }

  type Event {
    id: ID!
    title: String!
    description: String
    event_date: String
    location: String
    created_by: String
    club: Club
    organizer: Profile
  }

  type Query {
    profile(id: ID!): Profile
    event(id: ID!): Event
    events(limit: Int): [Event!]!
  }
`;

const resolvers = {
  Query: {
    profile: async (_: any, { id }: { id: string }, ctx: any) => {
      const { data, error } = await ctx.supabase.from("profiles").select("*").eq("id", id).single();
      if (error) return null;
      return data;
    },
    event: async (_: any, { id }: { id: string }, ctx: any) => {
      const { data, error } = await ctx.supabase.from("events").select("*").eq("id", id).single();
      if (error) return null;
      return data;
    },
    events: async (_: any, { limit = 10 }: { limit?: number }, ctx: any) => {
      const { data, error } = await ctx.supabase.from("events").select("*").limit(limit);
      if (error) return [];
      return data ?? [];
    },
  },
  Event: {
    organizer: async (parent: any, _: any, ctx: any) => {
      if (!parent.created_by) return null;
      const { data } = await ctx.supabase
        .from("profiles")
        .select("*")
        .eq("id", parent.created_by)
        .single();
      return data;
    },
    club: async (parent: any, _: any, ctx: any) => {
      if (!parent.club_id) return null;
      const { data } = await ctx.supabase
        .from("clubs")
        .select("*")
        .eq("id", parent.club_id)
        .single();
      return data;
    },
  },
};

const schema = createSchema({
  typeDefs,
  resolvers,
});

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/functions/v1/graphql",
  context: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return {
      supabase: createClient(supabaseUrl, supabaseKey),
    };
  },
});

serve(yoga);
