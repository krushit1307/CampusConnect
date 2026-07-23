import DataLoader from "dataloader";
import { SupabaseClient } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  email?: string;
  fullName?: string;
  avatarUrl?: string;
  [key: string]: unknown;
}

export interface GraphQLContext {
  supabase: SupabaseClient;
  dataloaders: {
    userLoader: DataLoader<string, UserProfile | null>;
  };
}

export function createDataLoaders(supabase: SupabaseClient) {
  return {
    userLoader: new DataLoader<string, UserProfile | null>(async (userIds) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds as string[]);

      if (error) throw new Error(error.message);

      const userMap = new Map<string, UserProfile>(
        (data || []).map((user) => [user.id as string, user as UserProfile]),
      );
      return userIds.map((id) => userMap.get(id) || null);
    }),
  };
}

export const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    email: String
    fullName: String
    avatarUrl: String
  }

  type GenericRecord {
    id: ID!
    data: String
  }

  type Query {
    table(tableName: String!, limit: Int): [GenericRecord]
    user(id: ID!): User
  }
`;

export const resolvers = {
  Query: {
    table: async (
      _: unknown,
      { tableName, limit = 10 }: { tableName: string; limit?: number },
      ctx: GraphQLContext,
    ) => {
      const { data, error } = await ctx.supabase.from(tableName).select("*").limit(limit);

      if (error) throw new Error(error.message);
      return (data || []).map((item) => ({
        id: item.id as string,
        data: JSON.stringify(item),
      }));
    },
    user: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      return ctx.dataloaders.userLoader.load(id);
    },
  },
};
