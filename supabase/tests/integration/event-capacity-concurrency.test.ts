import { describe, expect, it } from "vitest";
import { Client } from "pg";

describe("Event capacity reservation consistency (#5221)", () => {
  it("does not allow concurrent RSVPs to exceed event capacity", async () => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required for this integration test");
    }

    const setupClient = new Client({ connectionString });
    const clientA = new Client({ connectionString });
    const clientB = new Client({ connectionString });

    const eventId = "52210000-0000-0000-0000-000000000001";
    const userA = "52210000-0000-0000-0000-000000000002";
    const userB = "52210000-0000-0000-0000-000000000003";
    const clubId = "52210000-0000-0000-0000-000000000004";

    try {
      await setupClient.connect();
      await clientA.connect();
      await clientB.connect();

      await setupClient.query(
        `
          INSERT INTO public.profiles (id, email, first_name, last_name)
          VALUES
            ($1, $4, 'Concurrency', 'User A'),
            ($2, $5, 'Concurrency', 'User B')
          ON CONFLICT (id) DO NOTHING;

          INSERT INTO public.clubs (id, name, slug, created_by)
          VALUES ($3, 'Concurrency Test Club', 'concurrency-test-club', $1)
          ON CONFLICT (id) DO NOTHING;

          INSERT INTO public.events (
            id,
            club_id,
            title,
            event_date,
            max_attendees
          )
          VALUES (
            $6,
            $3,
            'Capacity Concurrency Test',
            NOW() + INTERVAL '1 day',
            1
          );
        `,
        [
          userA,
          userB,
          clubId,
          "5221-user-a@test.local",
          "5221-user-b@test.local",
          eventId,
        ],
      );

      const results = await Promise.all([
        clientA.query(
          `
            SELECT public.join_event_or_waitlist(
              $1::uuid,
              $2::uuid,
              FALSE,
              NULL,
              NULL
            ) AS result;
          `,
          [eventId, userA],
        ),
        clientB.query(
          `
            SELECT public.join_event_or_waitlist(
              $1::uuid,
              $2::uuid,
              FALSE,
              NULL,
              NULL
            ) AS result;
          `,
          [eventId, userB],
        ),
      ]);

      const statuses = results.map(
        (result) => result.rows[0].result.status,
      );

      expect(statuses.filter((status) => status === "attending")).toHaveLength(1);
      expect(statuses.filter((status) => status === "waitlisted")).toHaveLength(1);

      const countResult = await setupClient.query(
        `
          SELECT COUNT(*)::int AS count
          FROM public.event_rsvps
          WHERE event_id = $1
            AND status = 'attending';
        `,
        [eventId],
      );

      expect(countResult.rows[0].count).toBe(1);
    } finally {
      await setupClient.query(
        `
          DELETE FROM public.event_rsvps
          WHERE event_id = $1;

          DELETE FROM public.event_waitlist
          WHERE event_id = $1;

          DELETE FROM public.events
          WHERE id = $1;

          DELETE FROM public.clubs
          WHERE id = $2;

          DELETE FROM public.profiles
          WHERE id IN ($3, $4);
        `,
        [eventId, clubId, userA, userB],
      );

      await clientA.end();
      await clientB.end();
      await setupClient.end();
    }
  });

  it("does not consume another capacity slot for duplicate concurrent RSVP requests", async () => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required for this integration test");
    }

    const client = new Client({ connectionString });

    const eventId = "52210000-0000-0000-0000-000000000011";
    const userId = "52210000-0000-0000-0000-000000000012";
    const clubId = "52210000-0000-0000-0000-000000000013";

    try {
      await client.connect();

      await client.query(
        `
          INSERT INTO public.profiles (id, email, first_name, last_name)
          VALUES ($1, '5221-duplicate@test.local', 'Duplicate', 'User')
          ON CONFLICT (id) DO NOTHING;

          INSERT INTO public.clubs (id, name, slug, created_by)
          VALUES ($2, 'Duplicate RSVP Club', 'duplicate-rsvp-club', $1)
          ON CONFLICT (id) DO NOTHING;

          INSERT INTO public.events (
            id,
            club_id,
            title,
            event_date,
            max_attendees
          )
          VALUES (
            $3,
            $2,
            'Duplicate RSVP Test',
            NOW() + INTERVAL '1 day',
            1
          );
        `,
        [userId, clubId, eventId],
      );

      const first = await client.query(
        `
          SELECT public.join_event_or_waitlist(
            $1::uuid,
            $2::uuid,
            FALSE,
            NULL,
            NULL
          ) AS result;
        `,
        [eventId, userId],
      );

      const second = await client.query(
        `
          SELECT public.join_event_or_waitlist(
            $1::uuid,
            $2::uuid,
            FALSE,
            NULL,
            NULL
          ) AS result;
        `,
        [eventId, userId],
      );

      expect(first.rows[0].result.status).toBe("attending");
      expect(second.rows[0].result.status).toBe("attending");

      const countResult = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM public.event_rsvps
          WHERE event_id = $1
            AND status = 'attending';
        `,
        [eventId],
      );

      expect(countResult.rows[0].count).toBe(1);
    } finally {
      await client.query(
        `
          DELETE FROM public.event_rsvps WHERE event_id = $1;
          DELETE FROM public.event_waitlist WHERE event_id = $1;
          DELETE FROM public.events WHERE id = $1;
          DELETE FROM public.clubs WHERE id = $2;
          DELETE FROM public.profiles WHERE id = $3;
        `,
        [eventId, clubId, userId],
      );

      await client.end();
    }
  });
});