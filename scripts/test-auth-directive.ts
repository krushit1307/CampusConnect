import { yoga } from "../graphql/server";
import { supabase } from "../src/lib/supabase/client";

async function runTests() {
  console.log("--- Testing Auth Directive ---");

  // 1. Unauthenticated (no token)
  let res = await yoga.fetch("http://localhost:4000/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "query { allUsers { id } }" }),
  });
  let json = await res.json();
  console.log("Unauthenticated Response:", JSON.stringify(json));

  // 2. Authenticated as USER
  // Mock Supabase methods
  supabase.auth.getUser = async (token) => {
    if (token === "token-user") return { data: { user: { id: "user-123" } }, error: null } as any;
    if (token === "token-admin") return { data: { user: { id: "admin-123" } }, error: null } as any;
    return { data: { user: null }, error: null } as any;
  };

  // Mock supabase.from
  const originalFrom = supabase.from.bind(supabase);
  supabase.from = ((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: (field: string, val: string) => ({
            single: async () => {
              if (val === "user-123") return { data: { role: "USER" }, error: null };
              if (val === "admin-123") return { data: { role: "ADMIN" }, error: null };
              return { data: null, error: null };
            },
          }),
        }),
        // For the allUsers resolver
        select: (cols: string) => {
          if (cols === "*") {
            // Mock eq for context parsing, but for the actual query, it returns array
            return Object.assign(
              Promise.resolve({ data: [{ id: "user-123" }, { id: "admin-123" }], error: null }),
              {
                eq: (field: string, val: string) => ({
                  single: async () => {
                    if (val === "user-123") return { data: { role: "USER" }, error: null };
                    if (val === "admin-123") return { data: { role: "ADMIN" }, error: null };
                    return { data: null, error: null };
                  },
                }),
              },
            );
          }
        },
      };
    }
    return originalFrom(table);
  }) as any;

  res = await yoga.fetch("http://localhost:4000/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer token-user" },
    body: JSON.stringify({ query: "query { allUsers { id } }" }),
  });
  json = await res.json();
  console.log("Authenticated USER Response:", JSON.stringify(json));

  // 3. Authenticated as ADMIN
  res = await yoga.fetch("http://localhost:4000/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer token-admin" },
    body: JSON.stringify({ query: "query { allUsers { id } }" }),
  });
  json = await res.json();
  console.log("Authenticated ADMIN Response:", JSON.stringify(json));

  // Restore
  supabase.from = originalFrom;
}

runTests().catch(console.error);
