import { http, HttpResponse } from "msw";

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface MockEvent {
  id: string;
  title: string;
  description: string;
  event_date: string;
  location: string;
  attendeesCount: number;
  userRsvped?: boolean;
}

export const mockUser: MockUser = {
  id: "user-123",
  email: "alex@campusconnect.edu",
  name: "Alex Rivera",
  role: "student",
};

export const mockEvents: MockEvent[] = [
  {
    id: "event-1",
    title: "Web3 & AI Hackathon",
    description: "Build cutting-edge decentralized AI applications.",
    event_date: "2026-09-15T10:00:00Z",
    location: "Student Center Innovation Hub",
    attendeesCount: 42,
    userRsvped: false,
  },
  {
    id: "event-2",
    title: "Campus Chess Championship",
    description: "Annual blitz chess tournament with prizes.",
    event_date: "2026-09-20T14:00:00Z",
    location: "Campus Recreation Lounge",
    attendeesCount: 18,
    userRsvped: true,
  },
];

export const handlers = [
  // ─── Auth API Routes ───────────────────────────────────────────────
  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };

    if (!body.email || !body.password) {
      return HttpResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (body.password === "invalid-password") {
      return HttpResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    return HttpResponse.json({
      user: { ...mockUser, email: body.email },
      token: "mock-jwt-session-token",
    });
  }),

  http.post("/api/auth/logout", () => {
    return HttpResponse.json({ success: true });
  }),

  http.get("/api/auth/me", ({ request }) => {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || authHeader === "Bearer unauthenticated") {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return HttpResponse.json({ user: mockUser });
  }),

  // ─── Event API Routes ──────────────────────────────────────────────
  http.get("/api/events", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search");

    let results = [...mockEvents];
    if (search) {
      results = results.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()));
    }

    return HttpResponse.json({ events: results });
  }),

  http.get("/api/events/:id", ({ params }) => {
    const { id } = params;
    const event = mockEvents.find((e) => e.id === id);

    if (!event) {
      return HttpResponse.json({ error: "Event not found" }, { status: 444 });
    }

    return HttpResponse.json({ event });
  }),

  http.post("/api/events", async ({ request }) => {
    const body = (await request.json()) as Omit<MockEvent, "id">;

    if (!body.title) {
      return HttpResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const newEvent: MockEvent = {
      ...body,
      id: `event-${Date.now()}`,
      attendeesCount: 0,
      userRsvped: false,
    };

    return HttpResponse.json({ event: newEvent }, { status: 201 });
  }),

  http.put("/api/events/:id", async ({ params, request }) => {
    const { id } = params;
    const updates = (await request.json()) as Partial<MockEvent>;

    const existing = mockEvents.find((e) => e.id === id);
    if (!existing) {
      return HttpResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const updated = { ...existing, ...updates };
    return HttpResponse.json({ event: updated });
  }),

  http.delete("/api/events/:id", ({ params }) => {
    const { id } = params;
    const existing = mockEvents.find((e) => e.id === id);

    if (!existing) {
      return HttpResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return HttpResponse.json({ success: true, id });
  }),

  http.post("/api/events/:id/rsvp", ({ params }) => {
    const { id } = params;
    const event = mockEvents.find((e) => e.id === id);

    if (!event) {
      return HttpResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const nextRsvp = !event.userRsvped;
    const updated = {
      ...event,
      userRsvped: nextRsvp,
      attendeesCount: nextRsvp ? event.attendeesCount + 1 : event.attendeesCount - 1,
    };

    return HttpResponse.json({ event: updated });
  }),
];
