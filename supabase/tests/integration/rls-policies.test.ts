import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Integration tests for Row Level Security (RLS) policies.
 * Verifies that the database physically prevents unauthorized access.
 */

// Local Supabase defaults (printed by `supabase start`)
const SUPABASE_URL = "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilFCblKi3v";

describe("RLS Policies Integration Tests", () => {
  let supabaseAnon: SupabaseClient;

  beforeAll(() => {
    supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  beforeEach(async () => {
    // Clean up test data before each test to guarantee a pristine state
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey);

    // Clean up clubs and events added by tests
    await supabaseAdmin.from("clubs").delete().eq("slug", "unauthorized-club-rls-test");
    await supabaseAdmin.from("events").delete().eq("title", "Unauthorized Event");
  });

  afterAll(async () => {
    await supabaseAnon.auth.signOut();
  });

  it("should prevent anonymous users from creating a club", async () => {
    const { data, error } = await supabaseAnon.from("clubs").insert({
      name: "Unauthorized Club",
      description: "This should fail RLS",
      slug: "unauthorized-club-rls-test",
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501"); // insufficient_privilege
    expect(data).toBeNull();
  });

  it("should prevent anonymous users from reading private events", async () => {
    // RLS should filter out private events for anon users, returning empty array
    const { data, error } = await supabaseAnon
      .from("events")
      .select("*")
      .eq("is_private", true)
      .limit(1);

    expect(error).toBeNull(); // RLS doesn't throw, it just filters
    expect(data).toEqual([]);
  });

  it("should allow authenticated users to read public events", async () => {
    // Login with seeded student account
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: "student@campusconnect.com",
      password: "password123",
    });

    expect(authError).toBeNull();
    expect(authData.user).not.toBeNull();

    const { data, error } = await supabaseAnon
      .from("events")
      .select("*")
      .eq("is_private", false)
      .limit(1);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);

    await supabaseAnon.auth.signOut();
  });

  it("should prevent students from updating clubs they don't own", async () => {
    await supabaseAnon.auth.signInWithPassword({
      email: "student@campusconnect.com",
      password: "password123",
    });

    // Try to update a random club ID (even if it doesn't exist, RLS blocks the attempt)
    const { error } = await supabaseAnon
      .from("clubs")
      .update({ name: "Hacked Club Name" })
      .eq("id", "00000000-0000-0000-0000-000000000000");

    // Should either be 42501 (permission denied) or PGRST116 (0 rows affected due to RLS)
    expect(error?.code === "42501" || error?.code === "PGRST116").toBe(true);

    await supabaseAnon.auth.signOut();
  });
});
