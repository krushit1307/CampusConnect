import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface MembershipTrend {
  month: string;
  count: number;
  new_members: number;
  left_members: number;
}

export interface EventPerformance {
  event_id: string;
  title: string;
  event_date: string;
  rsvp_count: number;
  check_in_count: number;
  attendance_rate: number;
}

export interface ActivityMetric {
  date: string;
  posts: number;
  comments: number;
  rsvps: number;
}

export interface EngagementSummary {
  total_members: number;
  active_members_30d: number;
  total_events: number;
  upcoming_events: number;
  total_posts: number;
  total_comments: number;
  avg_attendance_rate: number;
  engagement_score: number;
}

export interface TopContributor {
  user_id: string;
  full_name: string;
  avatar_url: string;
  post_count: number;
  comment_count: number;
}

export interface ClubAnalyticsData {
  summary: EngagementSummary;
  membershipTrends: MembershipTrend[];
  eventPerformance: EventPerformance[];
  activityMetrics: ActivityMetric[];
  topContributors: TopContributor[];
}

export interface UseClubAnalyticsResult {
  data: ClubAnalyticsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function getMonthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function computeScore(
  active: number,
  total: number,
  events: number,
  posts: number,
  comments: number,
): number {
  if (total === 0) return 0;
  const act = active / total;
  const content = Math.min((posts + comments) / (total * 2), 1);
  const evt = Math.min(events / 10, 1);
  return Math.round((act * 40 + content * 35 + evt * 25) * 10) / 10;
}

async function fetchSummary(
  supabase: ReturnType<typeof createClient>,
  clubId: string,
): Promise<EngagementSummary> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [m, am, ev, ue, po, co, rsvps] = await Promise.all([
    supabase
      .from("club_members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "approved"),
    supabase
      .from("club_members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "approved")
      .gte("joined_at", since.toISOString()),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("club_id", clubId),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .gte("event_date", new Date().toISOString()),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .is("deleted_at", null),
    supabase
      .from("posts")
      .select("id, comments(count)", { count: "exact", head: true })
      .eq("club_id", clubId)
      .is("deleted_at", null),
    supabase
      .from("event_rsvps")
      .select("id, checked_in")
      .in(
        "event_id",
        (await supabase.from("events").select("id").eq("club_id", clubId)).data?.map((e) => e.id) ||
          [],
      ),
  ]);

  const tm = m.count || 0;
  const a30 = am.count || 0;
  const te = ev.count || 0;
  const ueCount = ue.count || 0;
  const tp = po.count || 0;
  const tc = co.count || 0;
  const rd = rsvps.data || [];
  const aar =
    rd.length > 0 ? Math.round((rd.filter((r) => r.checked_in).length / rd.length) * 1000) / 10 : 0;

  return {
    total_members: tm,
    active_members_30d: a30,
    total_events: te,
    upcoming_events: ueCount,
    total_posts: tp,
    total_comments: tc,
    avg_attendance_rate: aar,
    engagement_score: computeScore(a30, tm, te, tp, tc),
  };
}

async function fetchEvents(
  supabase: ReturnType<typeof createClient>,
  clubId: string,
): Promise<EventPerformance[]> {
  const { data: events } = await supabase
    .from("events")
    .select("id, title, event_date, event_rsvps(id, checked_in)")
    .eq("club_id", clubId)
    .order("event_date", { ascending: false })
    .limit(10);
  if (!events) return [];
  return events.map((e) => {
    const rsvps = e.event_rsvps || [];
    const rc = rsvps.length;
    const ci = rsvps.filter((r: { checked_in: boolean }) => r.checked_in).length;
    return {
      event_id: e.id,
      title: e.title,
      event_date: e.event_date,
      rsvp_count: rc,
      check_in_count: ci,
      attendance_rate: rc > 0 ? Math.round((ci / rc) * 1000) / 10 : 0,
    };
  });
}

async function fetchActivity(
  supabase: ReturnType<typeof createClient>,
  clubId: string,
): Promise<ActivityMetric[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString();

  const [po, co, rv] = await Promise.all([
    supabase
      .from("posts")
      .select("created_at")
      .eq("club_id", clubId)
      .is("deleted_at", null)
      .gte("created_at", sinceStr)
      .order("created_at"),
    supabase
      .from("posts")
      .select("comments(created_at)")
      .eq("club_id", clubId)
      .is("deleted_at", null),
    supabase
      .from("event_rsvps")
      .select("rsvp_at")
      .in(
        "event_id",
        (await supabase.from("events").select("id").eq("club_id", clubId)).data?.map((e) => e.id) ||
          [],
      )
      .gte("rsvp_at", sinceStr),
  ]);

  const byDay = (key: string) => new Map<string, number>();
  const pMap = byDay("p"),
    cMap = byDay("c"),
    rMap = byDay("r");

  for (const p of po.data || []) {
    const d = new Date(p.created_at).toISOString().split("T")[0];
    pMap.set(d, (pMap.get(d) || 0) + 1);
  }
  for (const p of co.data || []) {
    for (const c of Array.isArray(p.comments) ? p.comments : []) {
      const d = new Date(c.created_at).toISOString().split("T")[0];
      cMap.set(d, (cMap.get(d) || 0) + 1);
    }
  }
  for (const r of rv.data || []) {
    if (!r.rsvp_at) continue;
    const d = new Date(r.rsvp_at).toISOString().split("T")[0];
    rMap.set(d, (rMap.get(d) || 0) + 1);
  }

  const all = new Set([...pMap.keys(), ...cMap.keys(), ...rMap.keys()]);
  return Array.from(all)
    .sort()
    .map((date) => ({
      date,
      posts: pMap.get(date) || 0,
      comments: cMap.get(date) || 0,
      rsvps: rMap.get(date) || 0,
    }));
}

async function fetchContributors(
  supabase: ReturnType<typeof createClient>,
  clubId: string,
): Promise<TopContributor[]> {
  const { data: posts } = await supabase
    .from("posts")
    .select("author_id, profiles(full_name, avatar_url)")
    .eq("club_id", clubId)
    .is("deleted_at", null);
  if (!posts) return [];

  const map = new Map<
    string,
    { full_name: string; avatar_url: string; post_count: number; comment_count: number }
  >();
  for (const p of posts) {
    const pid = p.author_id;
    if (!map.has(pid)) {
      const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      map.set(pid, {
        full_name: prof?.full_name || "Unknown",
        avatar_url: prof?.avatar_url || "",
        post_count: 0,
        comment_count: 0,
      });
    }
    map.get(pid)!.post_count++;
  }

  const { data: allPosts } = await supabase
    .from("posts")
    .select("id, author_id, comments(author_id)")
    .eq("club_id", clubId)
    .is("deleted_at", null);
  if (allPosts) {
    for (const p of allPosts) {
      for (const c of Array.isArray(p.comments) ? p.comments : []) {
        if (!map.has(c.author_id))
          map.set(c.author_id, {
            full_name: "Unknown",
            avatar_url: "",
            post_count: 0,
            comment_count: 0,
          });
        map.get(c.author_id)!.comment_count++;
      }
    }
  }

  return Array.from(map.entries())
    .map(([user_id, d]) => ({ user_id, ...d }))
    .sort((a, b) => b.post_count + b.comment_count - (a.post_count + a.comment_count))
    .slice(0, 5);
}

export function useClubAnalytics(clubId: string | null): UseClubAnalyticsResult {
  const [data, setData] = useState<ClubAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!clubId) return;
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [summary, eventPerformance, activityMetrics, topContributors, memberJoins] =
        await Promise.all([
          fetchSummary(supabase, clubId),
          fetchEvents(supabase, clubId),
          fetchActivity(supabase, clubId),
          fetchContributors(supabase, clubId),
          supabase
            .from("club_members")
            .select("created_at, status")
            .eq("club_id", clubId)
            .eq("status", "approved"),
        ]);

      const now = new Date();
      const joinMap = new Map<string, number>();
      for (const m of memberJoins.data || []) {
        const d = new Date(m.created_at);
        if (isNaN(d.getTime())) continue;
        const key = getMonthLabel(d);
        joinMap.set(key, (joinMap.get(key) || 0) + 1);
      }

      const months: MembershipTrend[] = [];
      let rc = 0;
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = getMonthLabel(d);
        const nm = joinMap.get(key) || 0;
        rc += nm;
        months.push({ month: key, count: Math.max(0, rc), new_members: nm, left_members: 0 });
      }

      setData({
        summary,
        membershipTrends: months,
        eventPerformance,
        activityMetrics,
        topContributors,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  return { data, isLoading, error, refetch: fetchData };
}
