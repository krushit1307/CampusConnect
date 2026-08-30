import { Users, Calendar, MessageCircle, TrendingUp, RefreshCw } from "lucide-react";
import { useClubAnalytics } from "@/hooks/useClubAnalytics";
import { EngagementScoreRing } from "./EngagementScoreRing";
import { MembershipChart } from "./MembershipChart";
import { ActivityTimelineChart } from "./ActivityTimelineChart";
import { EventPerformanceTable } from "./EventPerformanceTable";
import { TopContributorsList } from "./TopContributorsList";
import { StatCard } from "./StatCard";

interface ClubAnalyticsPageProps {
  clubId: string;
  clubName?: string;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 border-b-2 border-black pb-3">
      <h2 className="text-xl font-bold uppercase">{title}</h2>
      {subtitle && <p className="font-mono text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export function ClubAnalyticsPage({ clubId, clubName }: ClubAnalyticsPageProps) {
  const { data, isLoading, error, refetch } = useClubAnalytics(clubId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-48 bg-gray-200 animate-pulse neu-border" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 animate-pulse neu-border" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 animate-pulse neu-border" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="neu-border bg-red-50 p-8 text-center shadow-[4px_4px_0_0_#000]">
        <p className="font-display text-xl font-black text-red-700 mb-2">
          Failed to Load Analytics
        </p>
        <p className="font-mono text-sm text-red-600 mb-4">{error}</p>
        <button
          onClick={refetch}
          className="neu-border bg-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-gray-100 transition-colors shadow-[2px_2px_0_0_#000]"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, membershipTrends, eventPerformance, activityMetrics, topContributors } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-black uppercase tracking-tight">
            Club Analytics
          </h1>
          {clubName && <p className="font-mono text-sm text-gray-500 mt-1">{clubName}</p>}
        </div>
        <button
          onClick={refetch}
          className="neu-border bg-white px-4 py-2 font-mono text-xs font-bold uppercase flex items-center gap-2 hover:bg-cream transition-colors shadow-[2px_2px_0_0_#000] neu-press"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Members"
          value={summary.total_members}
          icon={Users}
          accent="bg-lime/20"
          subtitle={`${summary.active_members_30d} active (30d)`}
        />
        <StatCard
          label="Total Events"
          value={summary.total_events}
          icon={Calendar}
          accent="bg-sky/20"
          subtitle={`${summary.upcoming_events} upcoming`}
        />
        <StatCard
          label="Posts & Comments"
          value={summary.total_posts + summary.total_comments}
          icon={MessageCircle}
          accent="bg-peach/20"
          subtitle={`${summary.total_posts} posts, ${summary.total_comments} comments`}
        />
        <StatCard
          label="Avg Attendance"
          value={`${summary.avg_attendance_rate}%`}
          icon={TrendingUp}
          accent="bg-yellow-100"
          subtitle="Check-in rate across events"
        />
      </div>

      {/* Engagement Score */}
      <div className="neu-border bg-white p-6 shadow-[2px_2px_0_0_#000]">
        <SectionHeader
          title="Engagement Score"
          subtitle="Composite metric based on activity, content, and event participation"
        />
        <div className="flex flex-col items-center py-4">
          <EngagementScoreRing score={summary.engagement_score} />
          <div className="mt-4 grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-gray-500">Activity</p>
              <p className="font-display font-bold text-lg">
                {summary.total_members > 0
                  ? Math.round((summary.active_members_30d / summary.total_members) * 100)
                  : 0}
                %
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-gray-500">Content</p>
              <p className="font-display font-bold text-lg">
                {summary.total_posts + summary.total_comments}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase text-gray-500">Events</p>
              <p className="font-display font-bold text-lg">{summary.total_events}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="neu-border bg-white p-6 shadow-[2px_2px_0_0_#000]">
          <SectionHeader
            title="Membership Growth"
            subtitle="Member join/leave trends over the last 6 months"
          />
          <MembershipChart data={membershipTrends} />
        </div>

        <div className="neu-border bg-white p-6 shadow-[2px_2px_0_0_#000]">
          <SectionHeader
            title="Activity Timeline"
            subtitle="Daily posts, comments, and RSVPs over the last 30 days"
          />
          <ActivityTimelineChart data={activityMetrics} />
        </div>
      </div>

      {/* Event Performance */}
      <div className="neu-border bg-white p-6 shadow-[2px_2px_0_0_#000]">
        <SectionHeader
          title="Event Performance"
          subtitle="RSVP counts, check-ins, and attendance rates for recent events"
        />
        <EventPerformanceTable events={eventPerformance} />
      </div>

      {/* Top Contributors */}
      <div className="neu-border bg-white p-6 shadow-[2px_2px_0_0_#000]">
        <SectionHeader
          title="Top Contributors"
          subtitle="Most active members by post and comment count"
        />
        <TopContributorsList contributors={topContributors} />
      </div>
    </div>
  );
}
