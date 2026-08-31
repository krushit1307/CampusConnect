// @ts-nocheck
import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { User } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SessionReplayError,
  verifyAuth,
  verifyAuthWithReplayDetection,
} from "./auth-middleware.ts";

const mockUser: User = {
  id: "user-123",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

// The replay-detection path requires a binding secret; without one the
// middleware fails open (by design) and the replay tests cannot run.
Deno.env.set("REPLAY_BINDING_SECRET", "test-replay-binding-secret-0123456789");

function mockSupabaseAuth(
  getUserImpl: (token: string) => Promise<{ data: { user: User | null }; error: unknown }>,
) {
  return {
    auth: {
      getUser: getUserImpl,
    },
  };
}

function mockSupabaseWithRpc(
  getUserImpl: (token: string) => Promise<{ data: { user: User | null }; error: unknown }>,
  rpcResult: () => { data: unknown; error: unknown },
) {
  return {
    auth: {
      getUser: getUserImpl,
    },
    rpc: async () => rpcResult(),
  };
}

const validUserGet = async (_token: string) => {
  return { data: { user: mockUser }, error: null };
};

Deno.test("verifyAuth - success", async () => {
  const req = new Request("https://example.com", {
    headers: {
      Authorization: "Bearer valid-token",
    },
  });

  const user = await verifyAuth(req, mockSupabaseAuth(validUserGet));
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

// A realistic-looking Supabase access token whose payload contains a
// `session_id` claim, so the replay path can be exercised.
const TOKEN_WITH_SESSION =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInNlc3Npb25faWQiOiIxMTExMTExMS0yMjIyLTIyMjItMjIyMi0yMjIyMjIyMjIyMjIiLCJpYXQiOjF9.signature";

function replayRequest(overrides: Record<string, string> = {}): Request {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN_WITH_SESSION}`,
    "x-device-fingerprint": "cc_fp_a1b2c3d4e5f60718293a4b5c6d7e8f90",
    "x-forwarded-for": "10.0.0.42",
    ...overrides,
  };
  return new Request("https://example.com", { headers });
}

Deno.test("verifyAuthWithReplayDetection - ok verdict passes through", async () => {
  const supabase = mockSupabaseWithRpc(validUserGet, () => ({ data: "ok", error: null }));

  const user = await verifyAuthWithReplayDetection(replayRequest(), supabase);
  assertEquals(user.id, "user-123");
});

Deno.test("verifyAuthWithReplayDetection - replay verdict throws SessionReplayError", async () => {
  const supabase = mockSupabaseWithRpc(validUserGet, () => ({ data: "replay", error: null }));

  await assertRejects(async () => {
    await verifyAuthWithReplayDetection(replayRequest(), supabase);
  }, SessionReplayError);
});

Deno.test("verifyAuthWithReplayDetection - rpc error fails open", async () => {
  const supabase = mockSupabaseWithRpc(validUserGet, () => ({
    data: null,
    error: new Error("rpc down"),
  }));

  const user = await verifyAuthWithReplayDetection(replayRequest(), supabase);
  assertEquals(user.id, "user-123");
});

Deno.test("verifyAuthWithReplayDetection - missing fingerprint fails open", async () => {
  const supabase = mockSupabaseWithRpc(validUserGet, () => ({ data: "replay", error: null }));

  const req = replayRequest({ "x-device-fingerprint": "" });
  const user = await verifyAuthWithReplayDetection(req, supabase);
  assertEquals(user.id, "user-123");
});

Deno.test("verifyAuthWithReplayDetection - missing ip fails open", async () => {
  const supabase = mockSupabaseWithRpc(validUserGet, () => ({ data: "replay", error: null }));

  const req = replayRequest({ "x-forwarded-for": "" });
  const user = await verifyAuthWithReplayDetection(req, supabase);
  assertEquals(user.id, "user-123");
});
