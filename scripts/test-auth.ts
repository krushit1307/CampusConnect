// Fix import.meta.env for tsx
(global as any).import = {
  meta: {
    env: { DEV: true, VITE_SUPABASE_URL: "http://localhost", VITE_SUPABASE_ANON_KEY: "key" },
  },
};

import { yoga } from "../graphql/server";
import { supabase } from "../src/lib/supabase/client";

// Mock supabase functions properly
supabase.channel = () => ({ on: () => ({ subscribe: () => {} }) }) as any;
supabase.auth.getUser = async (token) => {
  if (token === "token-user") return { data: { user: { id: "user-123" } } } as any;
  if (token === "token-admin") return { data: { user: { id: "admin-123" } } } as any;
  return { data: { user: null } } as any;
};

const originalFrom = supabase.from.bind(supabase);
supabase.from = ((table: string) => {
  if (table === "profiles") {
    return {
      select: () => {
        const queryObj = {
          eq: (field: string, val: string) => ({
            single: async () => {
              if (val === "user-123") return { data: { role: "USER" }, error: null };
              if (val === "admin-123") return { data: { role: "ADMIN" }, error: null };
              return { data: null, error: null };
            },
          }),
          then: (resolve: any) =>
            resolve({ data: [{ id: "user-123" }, { id: "admin-123" }], error: null }),
        };
        return queryObj;
      },
    };
  }
  return originalFrom(table);
}) as any;

async function runTests() {
  console.log("--- Testing Auth Directive ---");

  // 1. Unauthenticated (no token)
  let res = await yoga.fetch("http://localhost:4000/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "query { allUsers { id } }" }),
  });
  let json = await res.json();
  console.log("Unauthenticated:", JSON.stringify(json));

  // 2. Authenticated as USER
  res = await yoga.fetch("http://localhost:4000/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer token-user" },
    body: JSON.stringify({ query: "query { allUsers { id } }" }),
  });
  json = await res.json();
  console.log("Authenticated USER:", JSON.stringify(json));

  // 3. Authenticated as ADMIN
  res = await yoga.fetch("http://localhost:4000/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer token-admin" },
    body: JSON.stringify({ query: "query { allUsers { id } }" }),
  });
  json = await res.json();
  console.log("Authenticated ADMIN:", JSON.stringify(json));
}

runTests().catch(console.error);
