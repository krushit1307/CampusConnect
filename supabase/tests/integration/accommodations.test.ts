import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

describe("Accessibility Accommodations Database & Security Integration", () => {
  let client: pg.Client;

  beforeAll(async () => {
    // Connect to the test PostgreSQL container database
    client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  // Seeds and retrieves roles to simulate authenticating different identities
  async function impersonateUser(userId: string | null) {
    if (userId === null) {
      await client.query("SELECT set_config('request.jwt.claims', '', true)");
    } else {
      const claims = JSON.stringify({ sub: userId, role: "authenticated" });
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [claims]);
    }
  }

  // Pre-seed ids for isolation
  const studentId = "11111111-1111-1111-1111-111111111111";
  const presidentId = "22222222-2222-2222-2222-222222222222";
  const adminId = "33333333-3333-3333-3333-333333333333";
  const unrelatedId = "99999999-9999-9999-9999-999999999999";
  const clubId = "88888888-8888-8888-8888-888888888888";
  const eventId = "77777777-7777-7777-7777-777777777777";
  const rsvpId = "66666666-6666-6666-6666-666666666666";

  async function seedDatabase() {
    // 1. Create profiles
    await client.query(
      `
      INSERT INTO public.profiles (id, email, first_name, last_name, role) VALUES
      ($1, 'student@test.com', 'Alice', 'Student', 'student'::public.user_role),
      ($2, 'president@test.com', 'Bob', 'President', 'student'::public.user_role),
      ($3, 'admin@test.com', 'Charlie', 'Admin', 'student'::public.user_role),
      ($4, 'unrelated@test.com', 'Dave', 'Unrelated', 'student'::public.user_role)
      ON CONFLICT (id) DO NOTHING;
    `,
      [studentId, presidentId, adminId, unrelatedId],
    );

    // 2. Create club where Bob (presidentId) is creator
    await client.query(
      `
      INSERT INTO public.clubs (id, name, slug, description, created_by)
      VALUES ($1, 'Test Club', 'test-club', 'A club for testing', $2)
      ON CONFLICT (id) DO NOTHING;
    `,
      [clubId, presidentId],
    );

    // 3. Setup dynamic club role for lower-tier admin (permissions_level >= 100)
    const adminRoleIdResult = await client.query(
      `
      SELECT id FROM public.club_roles WHERE club_id = $1 AND title = 'Admin'
    `,
      [clubId],
    );

    let adminRoleId;
    if (adminRoleIdResult.rows.length === 0) {
      const insRole = await client.query(
        `
        INSERT INTO public.club_roles (club_id, title, permissions_level)
        VALUES ($1, 'Admin', 100) RETURNING id
      `,
        [clubId],
      );
      adminRoleId = insRole.rows[0].id;
    } else {
      adminRoleId = adminRoleIdResult.rows[0].id;
    }

    // 4. Invite lower-tier admin as approved member
    await client.query(
      `
      INSERT INTO public.club_members (club_id, user_id, status, role_id)
      VALUES ($1, $2, 'approved', $3)
      ON CONFLICT (club_id, user_id) DO NOTHING;
    `,
      [clubId, adminId, adminRoleId],
    );

    // 5. Create event under that club
    await client.query(
      `
      INSERT INTO public.events (id, club_id, title, description, start_date, end_date, event_date, created_by)
      VALUES ($1, $2, 'Test Event', 'Event description', '2026-09-01T10:00:00Z', '2026-09-01T12:00:00Z', '2026-09-01T10:00:00Z', $3)
      ON CONFLICT (id) DO NOTHING;
    `,
      [eventId, clubId, presidentId],
    );
  }

  it("should automatically encrypt accommodations_requested using pgp_sym_encrypt when inserting", async () => {
    await seedDatabase();

    // Insert RSVP with plaintext
    await client.query(
      `
      INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in, accommodations_requested)
      VALUES ($1, $2, $3, 'approved', false, 'Requires wheelchair access')
    `,
      [rsvpId, eventId, studentId],
    );

    // Select raw DB value mapping
    const dbResult = await client.query(
      `
      SELECT accommodations_requested 
      FROM public.event_rsvps 
      WHERE id = $1
    `,
      [rsvpId],
    );

    const val = dbResult.rows[0].accommodations_requested;
    expect(val).not.toBeNull();
    expect(val.startsWith("cipher:")).toBe(true);
    expect(val).not.toBe("Requires wheelchair access");
  });

  it("should enforce chk_events_accommodation_deadline check constraint", async () => {
    await seedDatabase();

    // Accommodation deadline on/before start_date -> Succeeded
    await expect(
      client.query(
        `
      UPDATE public.events
      SET accommodation_deadline = '2026-08-31T23:59:59Z'
      WHERE id = $1
    `,
        [eventId],
      ),
    ).resolves.not.toThrow();

    // Accommodation deadline after start_date -> Fails
    await expect(
      client.query(
        `
      UPDATE public.events
      SET accommodation_deadline = '2026-09-02T00:00:00Z'
      WHERE id = $1
    `,
        [eventId],
      ),
    ).rejects.toThrow(/chk_events_accommodation_deadline/);
  });

  it("should securely decrypt using RPC for authorized users and deny unauthorized users", async () => {
    await seedDatabase();

    // Insert RSVP with accommodations
    await client.query(
      `
      INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in, accommodations_requested)
      VALUES ($1, $2, $3, 'approved', false, 'Requires visual assistance')
    `,
      [rsvpId, eventId, studentId],
    );

    // 1. Student themselves -> Decrypts successfully
    await impersonateUser(studentId);
    const resStudent = await client.query(
      `
      SELECT public.get_decrypted_accommodation($1) as dec
    `,
      [rsvpId],
    );
    expect(resStudent.rows[0].dec).toBe("Requires visual assistance");

    // 2. Primary Club President -> Decrypts successfully
    await impersonateUser(presidentId);
    const resPres = await client.query(
      `
      SELECT public.get_decrypted_accommodation($1) as dec
    `,
      [rsvpId],
    );
    expect(resPres.rows[0].dec).toBe("Requires visual assistance");

    // 3. Lower-tier club admin -> DENIED
    await impersonateUser(adminId);
    await expect(
      client.query(
        `
      SELECT public.get_decrypted_accommodation($1) as dec
    `,
        [rsvpId],
      ),
    ).rejects.toThrow(/Permission Denied/);

    // 4. Unrelated user -> DENIED
    await impersonateUser(unrelatedId);
    await expect(
      client.query(
        `
      SELECT public.get_decrypted_accommodation($1) as dec
    `,
        [rsvpId],
      ),
    ).rejects.toThrow(/Permission Denied/);

    // 5. Anonymous caller -> DENIED
    await impersonateUser(null);
    await expect(
      client.query(
        `
      SELECT public.get_decrypted_accommodation($1) as dec
    `,
        [rsvpId],
      ),
    ).rejects.toThrow(/Permission Denied/);
  });

  it("should verify that decryption logs to accommodation_audit_logs and hides details, and restricts select to owners", async () => {
    await seedDatabase();

    await client.query(
      `
      INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in, accommodations_requested)
      VALUES ($1, $2, $3, 'approved', false, 'Sign language interpreter')
    `,
      [rsvpId, eventId, studentId],
    );

    // Decrypt as president to trigger log insert
    await impersonateUser(presidentId);
    await client.query(
      `
      SELECT public.get_decrypted_accommodation($1)
    `,
      [rsvpId],
    );

    // Query audit log directly
    const rawLogs = await client.query(
      `
      SELECT * FROM public.accommodation_audit_logs WHERE rsvp_id = $1
    `,
      [rsvpId],
    );

    expect(rawLogs.rows.length).toBe(1);
    const log = rawLogs.rows[0];
    expect(log.viewer_id).toBe(presidentId);
    expect(log.rsvp_id).toBe(rsvpId);
    expect(log.event_id).toBe(eventId);
    expect(log.club_id).toBe(clubId);
    expect(log.action).toBe("VIEW_ACCOMMODATION");

    // Ensure audit log never records secret content
    const stringifiedLog = JSON.stringify(log);
    expect(stringifiedLog).not.toContain("Sign language interpreter");

    // Test RLS policies on audit logs:
    // Club President (owner) -> Can view
    await impersonateUser(presidentId);
    const presSelect = await client.query(
      `
      SELECT count(*) FROM public.accommodation_audit_logs WHERE rsvp_id = $1
    `,
      [rsvpId],
    );
    expect(parseInt(presSelect.rows[0].count)).toBe(1);

    // Student -> Count is 0 (filtered by RLS)
    await impersonateUser(studentId);
    const studentSelect = await client.query(
      `
      SELECT count(*) FROM public.accommodation_audit_logs WHERE rsvp_id = $1
    `,
      [rsvpId],
    );
    expect(parseInt(studentSelect.rows[0].count)).toBe(0);
  });
});
