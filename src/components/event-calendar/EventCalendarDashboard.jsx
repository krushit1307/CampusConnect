/**
 * Campus Event Calendar Dashboard (#1404)
 *
 * Event management, RSVP tracking, venue scheduling,
 * recurring events, and attendance analytics.
 */

import { useMemo, useState } from 'react';

import { getEventCalendarData } from './eventCalendarService';
import {
  OverviewStats, EventCard, RSVPCard, VenueCard, ClubCard, InsightCard,
} from './EventCalendarCards';
import {
  BarChart, DonutChart, TrendLine, HorizontalBar, RadarChart,
} from './EventCalendarCharts';
import { CATEGORY_COLORS, CATEGORY_ICONS, formatDate } from './eventCalendarTypes';

const TABS = ['Overview', 'Events', 'RSVPs', 'Venues', 'Clubs', 'Analytics'];

export default function EventCalendarDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const data = useMemo(() => getEventCalendarData(), []);

  const filteredEvents = useMemo(() => {
    return data.events.filter(e => {
      if (filterCategory !== 'All' && e.category !== filterCategory) return false;
      if (filterStatus !== 'All' && e.status !== filterStatus) return false;
      return true;
    });
  }, [data.events, filterCategory, filterStatus]);

  // Chart data
  const categoryDonut = Object.entries(
    data.events.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([label, value]) => ({ label, value, color: CATEGORY_COLORS[label as keyof typeof CATEGORY_COLORS] || '#3b82f6' }));

  const statusDonut = [
    { label: 'Upcoming', value: data.summary.upcomingEvents, color: '#3b82f6' },
    { label: 'Completed', value: data.summary.completedEvents, color: '#22c55e' },
    { label: 'Cancelled', value: data.events.filter(e => e.status === 'Cancelled').length, color: '#ef4444' },
  ];

  const clubEngagementBar = data.clubActivity
    .map(c => ({ label: c.clubName.slice(0, 8), value: c.engagementScore, color: c.engagementScore > 75 ? '#22c55e' : '#eab308' }))
    .sort((a, b) => b.value - a.value);

  const clubEventsBar = data.clubActivity
    .map(c => ({ label: c.clubName.slice(0, 8), value: c.totalEvents }))
    .sort((a, b) => b.value - a.value);

  const venueRadar = data.clubActivity.slice(0, 6).map(c => ({
    axis: c.clubName.slice(0, 8), value: c.engagementScore / 100,
  }));

  const attendanceByCategory = Object.entries(
    data.events.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.currentRSVPs; return acc; }, {} as Record<string, number>)
  ).map(([label, value]) => ({ label: label.slice(0, 8), value, color: CATEGORY_COLORS[label as keyof typeof CATEGORY_COLORS] || '#3b82f6' }))
    .sort((a, b) => b.value - a.value);

  const filterBarStyle = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 12, color: '#374151', background: '#fff', outline: 'none',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
          📅 Campus Event Calendar
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Event management, RSVP tracking, venue scheduling, and attendance analytics.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: activeTab === tab ? 700 : 500,
            color: activeTab === tab ? '#2563EB' : '#6b7280',
            background: activeTab === tab ? '#eff6ff' : 'transparent',
            borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent',
            marginBottom: -2,
          }}>{tab}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <OverviewStats summary={data.summary} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <DonutChart data={categoryDonut} title="Events by Category" />
            <DonutChart data={statusDonut} title="Events by Status" />
            <BarChart data={attendanceByCategory.slice(0, 8)} title="Attendance by Category" height={200} />
          </div>
          <TrendLine
            trends={data.trends}
            title="Event Trends Over Time"
            lines={[
              { key: 'totalEvents', color: '#3b82f6', label: 'Events' },
              { key: 'avgAttendance', color: '#22c55e', label: 'Avg Attendance' },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <HorizontalBar data={clubEngagementBar} title="Club Engagement Scores" />
            <BarChart data={clubEventsBar} title="Events by Club" height={200} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🧠 Event Insights</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {data.insights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            </div>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'Events' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={filterBarStyle}>
              <option value="All">All Categories</option>
              {['Academic','Social','Sports','Workshop','Conference','Club Meeting','Career Fair','Cultural','Volunteer','Fundraiser'].map(c => (
                <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterBarStyle}>
              <option value="All">All Statuses</option>
              {['Upcoming','Live','Completed','Cancelled','Postponed'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{filteredEvents.length} events</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
            {filteredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(e => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </div>
      )}

      {/* RSVPs Tab */}
      {activeTab === 'RSVPs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
          {data.rsvps.slice(0, 24).map(r => <RSVPCard key={r.id} rsvp={r} />)}
        </div>
      )}

      {/* Venues Tab */}
      {activeTab === 'Venues' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {data.venueBookings.map(v => <VenueCard key={v.id} venue={v} />)}
        </div>
      )}

      {/* Clubs Tab */}
      {activeTab === 'Clubs' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <HorizontalBar data={clubEngagementBar} title="Club Engagement Scores" />
            <RadarChart data={venueRadar} title="Club Activity Radar" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {data.clubActivity.map(c => <ClubCard key={c.clubName} club={c} />)}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'Analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <DonutChart data={categoryDonut} title="Events by Category" />
            <BarChart data={attendanceByCategory.slice(0, 8)} title="Attendance by Category" height={200} />
            <BarChart data={clubEventsBar} title="Events per Club" height={200} />
          </div>
          <TrendLine
            trends={data.trends}
            title="12-Month Event Trends"
            lines={[
              { key: 'totalEvents', color: '#3b82f6', label: 'Events' },
              { key: 'totalAttendees', color: '#22c55e', label: 'Attendees' },
              { key: 'repeatAttendees', color: '#8b5cf6', label: 'Repeat Attendees' },
            ]}
          />
        </div>
      )}
    </div>
  );
}
