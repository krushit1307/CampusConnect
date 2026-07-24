// @ts-nocheck
import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { User } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "./auth-middleware.ts";

Deno.test("verifyAuth - success", async () => {
  const mockUser: User = {
    id: "user-123",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const mockSupabase = {
    auth: {
      getUser: async (token: string) => {
        assertEquals(token, "valid-token");
        return { data: { user: mockUser }, error: null };
      },
    },
  };

  const req = new Request("https://example.com", {
    headers: {
      Authorization: "Bearer valid-token",
    },
  });

  const user = await verifyAuth(req, mockSupabase);
  assertEquals(user.id, "user-123");
});

Deno.test("verifyAuth - missing auth header", async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => {
        return { data: { user: null }, error: new Error("not called") };
      },
    },
  };

  const req = new Request("https://example.com");

  await assertRejects(
    async () => {
      await verifyAuth(req, mockSupabase);
    },
    Error,
    "Unauthorized",
  );
});

Deno.test("verifyAuth - invalid token format", async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => {
        return { data: { user: null }, error: new Error("not called") };
      },
    },
  };

  const req = new Request("https://example.com", {
    headers: {
      Authorization: "InvalidFormat valid-token",
    },
  });

  await assertRejects(
    async () => {
      await verifyAuth(req, mockSupabase);
    },
    Error,
    "Unauthorized",
  );
});

Deno.test("verifyAuth - supabase error", async () => {
  const mockSupabase = {
    auth: {
      getUser: async () => {
        return { data: { user: null }, error: new Error("Supabase error") };
      },
    },
  };

  const req = new Request("https://example.com", {
    headers: {
      Authorization: "Bearer invalid-token",
    },
  });

  await assertRejects(
    async () => {
      await verifyAuth(req, mockSupabase);
    },
    Error,
    "Unauthorized",
  );
});
