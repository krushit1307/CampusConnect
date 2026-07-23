import { createYoga, createSchema } from "graphql-yoga";
import { createClient } from "@supabase/supabase-js";
import { typeDefs, resolvers, createDataLoaders } from "./resolvers/index";
const metaEnv = (import.meta as { env?: Record<string, string> }).env;

const supabaseUrl = metaEnv?.VITE_SUPABASE_URL || "";
const supabaseKey = metaEnv?.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const schema = createSchema({
  typeDefs,
  resolvers,
});

export const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  context: () => ({
    supabase,
    dataloaders: createDataLoaders(supabase),
  }),
});
