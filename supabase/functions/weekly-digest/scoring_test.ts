// Weekly digest recommendation scoring tests (#2911)
// Run with: deno test supabase/functions/weekly-digest/scoring_test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  CLUB_BOOST,
  DEFAULT_TOP_N,
  scoreAndSelectTopEvents,
  TAG_BOOST,
  type DigestContext,
  type DigestEvent,
} from "./scoring.ts";

function event(overrides: Partial<DigestEvent>): DigestEvent {
  return {
    id: "evt-1",
    title: "Test Event",
    event_date: "2026-08-16T10:00:00.000Z",
    location: "Room 101",
    club_id: "club-1",
    club_name: "Robotics Club",
    tag_paths: [],
    ...overrides,
  };
}

function ctx(overrides: Partial<DigestContext>): DigestContext {
  return {
    events: [],
    followedClubIds: new Set(),
    attendedTagPaths: new Set(),
    rsvpedEventIds: new Set(),
    ...overrides,
  };
}

Deno.test("excludes events the user already RSVP'd to", () => {
  const e = event({ id: "evt-rsvp" });
  const picks = scoreAndSelectTopEvents(
    ctx({ events: [e], rsvpedEventIds: new Set(["evt-rsvp"]) }),
  );
  assertEquals(picks.length, 0);
});

Deno.test("applies +CLUB_BOOST for events hosted by clubs the user follows", () => {
  const e = event({ id: "evt-club", club_id: "club-1" });
  const picks = scoreAndSelectTopEvents(ctx({ events: [e], followedClubIds: new Set(["club-1"]) }));
  assertEquals(picks.length, 1);
  assertEquals(picks[0].score, CLUB_BOOST);
  assertEquals(picks[0].reasons.length, 1);
});

Deno.test("applies +TAG_BOOST per matching tag from previously attended events", () => {
  const e = event({ id: "evt-tag", tag_paths: ["ai", "ml"] });
  const picks = scoreAndSelectTopEvents(ctx({ events: [e], attendedTagPaths: new Set(["ai"]) }));
  assertEquals(picks[0].score, TAG_BOOST);

  const picks2 = scoreAndSelectTopEvents(
    ctx({ events: [e], attendedTagPaths: new Set(["ai", "ml"]) }),
  );
  assertEquals(picks2[0].score, 2 * TAG_BOOST);
});

Deno.test("combines club and tag boosts and ranks by total score", () => {
  const events = [
    event({
      id: "both",
      club_id: "club-1",
      tag_paths: ["ai"],
      event_date: "2026-08-20T10:00:00.000Z",
    }),
    event({ id: "club-only", club_id: "club-1", event_date: "2026-08-18T10:00:00.000Z" }),
    event({
      id: "tag-only",
      club_id: null,
      tag_paths: ["ai"],
      event_date: "2026-08-17T10:00:00.000Z",
    }),
    event({ id: "none", club_id: null, event_date: "2026-08-16T10:00:00.000Z" }),
  ];
  const picks = scoreAndSelectTopEvents(
    ctx({
      events,
      followedClubIds: new Set(["club-1"]),
      attendedTagPaths: new Set(["ai"]),
    }),
  );
  assertEquals(
    picks.map((p) => p.id),
    ["both", "club-only", "tag-only"],
  );
  assertEquals(picks[0].score, CLUB_BOOST + TAG_BOOST);
  assertEquals(picks[1].score, CLUB_BOOST);
  assertEquals(picks[2].score, TAG_BOOST);
  // 'none' has score 0 and falls outside the top 3.
  assertEquals(picks.length, DEFAULT_TOP_N);
});

Deno.test("ties are broken by earliest event date", () => {
  const events = [
    event({ id: "later", event_date: "2026-08-20T10:00:00.000Z" }),
    event({ id: "earlier", event_date: "2026-08-16T10:00:00.000Z" }),
  ];
  const picks = scoreAndSelectTopEvents(ctx({ events }));
  assertEquals(
    picks.map((p) => p.id),
    ["earlier", "later"],
  );
});

Deno.test("returns empty when there are no eligible events", () => {
  const picks = scoreAndSelectTopEvents(ctx({ events: [] }));
  assertEquals(picks.length, 0);
});

Deno.test("still recommends score-0 events so users never get a blank digest", () => {
  const picks = scoreAndSelectTopEvents(
    ctx({
      events: [event({ id: "a" }), event({ id: "b" }), event({ id: "c" }), event({ id: "d" })],
    }),
  );
  assertEquals(picks.length, DEFAULT_TOP_N);
  assertEquals(
    picks.every((p) => p.score === 0),
    true,
  );
});
