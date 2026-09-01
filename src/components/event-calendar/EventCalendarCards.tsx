/**
 * Campus Event Calendar — Card Components
 *
 * StatCard, EventCard, RSVPCard, VenueCard, ClubCard,
 * InsightCard, OverviewStats.
 */

import React from 'react';
import {
  CampusEvent, EventRSVP, VenueBooking, ClubActivity, EventInsight,
  EventSummary,
  CATEGORY_COLORS, STATUS_COLORS, CATEGORY_ICONS,
  formatCapacity, getCapacityColor, formatDate, formatTime,
  EventStatus,
} from './eventCalendarTypes';

// ── Stat Card ──────────────────────────────────────────────────────────────

export const StatCard: React.FC<{
  label: string; value: string | number; icon?: string;
  color?: string; subtitle?: string;
}> = ({ label, value, icon, color = '#2563EB', subtitle }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    flex: '1 1 180px', minWidth: 160,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
    <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
    {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
  </div>
);

// ── Overview Stats ─────────────────────────────────────────────────────────

export const OverviewStats: React.FC<{ summary: EventSummary }> = ({ summary }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
    <StatCard label="Total Events" value={summary.totalEvents} icon="📅" />
    <StatCard label="Upcoming" value={summary.upcomingEvents} icon="🔜" color="#3b82f6" />
    <StatCard label="Completed" value={summary.completedEvents} icon="✅" color="#22c55e" />
    <StatCard label="Total RSVPs" value={summary.totalRSVPs} icon="🎟️" />
    <StatCard label="Capacity Used" value={`${summary.capacityUtilization}%`} icon="📊" color={summary.capacityUtilization > 70 ? '#22c55e' : '#eab308'} />
    <StatCard label="Avg Attendance" value={`${summary.avgAttendanceRate}%`} icon="📈" />
    <StatCard label="Active Clubs" value={summary.totalClubs} icon="👥" />
    <StatCard label="Avg Rating" value={`${summary.avgRating}/5`} icon="⭐" color="#f59e0b" />
  </div>
);

// ── Status Badge ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: EventStatus }> = ({ status }) => (
  <span style={{
    padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
    color: STATUS_COLORS[status], background: `${STATUS_COLORS[status]}15`,
    border: `1px solid ${STATUS_COLORS[status]}30`,
  }}>{status}</span>
);

// ── Event Card ─────────────────────────────────────────────────────────────

export const EventCard: React.FC<{ event: CampusEvent }> = ({ event }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 16,
    border: event.isFeatured ? `2px solid ${CATEGORY_COLORS[event.category]}` : '1px solid #e5e7eb',
    boxShadow: event.isFeatured ? `0 0 0 1px ${CATEGORY_COLORS[event.category]}20` : '0 1px 3px rgba(0,0,0,0.06)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>
        {CATEGORY_ICONS[event.category]} {event.title}
        {event.isFeatured && <span style={{ fontSize: 10, color: CATEGORY_COLORS[event.category], marginLeft: 6, fontWeight: 700 }}>⭐ FEATURED</span>}
      </div>
      <StatusBadge status={event.status} />
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{event.description}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, marginBottom: 8 }}>
      <div>📅 {formatDate(event.date)}</div>
      <div>⏰ {formatTime(event.startTime)} - {formatTime(event.endTime)}</div>
      <div>📍 {event.venue}</div>
      <div>🏢 {event.organizer}</div>
      <div style={{ gridColumn: 'span 2' }}>
        🎟️ <span style={{ color: getCapacityColor(event.currentRSVPs, event.maxCapacity), fontWeight: 600 }}>
          {formatCapacity(event.currentRSVPs, event.maxCapacity)}
        </span>
        {event.waitlistCount > 0 && <span style={{ color: '#ef4444' }}> (+{event.waitlistCount} waitlist)</span>}
      </div>
    </div>
    {/* Capacity bar */}
    <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
      <div style={{
        height: '100%', borderRadius: 3,
        width: `${Math.min((event.currentRSVPs / event.maxCapacity) * 100, 100)}%`,
        background: getCapacityColor(event.currentRSVPs, event.maxCapacity),
      }} />
    </div>
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {event.tags.slice(0, 4).map(t => (
        <span key={t} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#f3f4f6', color: '#6b7280' }}>{t}</span>
      ))}
      {event.recurring !== 'None' && (
        <span style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#eff6ff', color: '#3b82f6' }}>🔄 {event.recurring}</span>
      )}
    </div>
  </div>
);

// ── RSVP Card ──────────────────────────────────────────────────────────────

export const RSVPCard: React.FC<{ rsvp: EventRSVP }> = ({ rsvp }) => {
  const statusColor = rsvp.status === 'Going' ? '#22c55e' : rsvp.status === 'Maybe' ? '#eab308' : rsvp.status === 'Waitlisted' ? '#3b82f6' : '#9ca3af';
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{rsvp.studentName}</div>
        <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: statusColor, background: `${statusColor}15` }}>{rsvp.status}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{rsvp.eventTitle}</div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>
        {rsvp.checkedIn && <span style={{ color: '#22c55e' }}>✓ Checked In</span>}
        {rsvp.rating && <span> ⭐ {rsvp.rating}/5</span>}
        <span> · {rsvp.rsvpedAt}</span>
      </div>
      {rsvp.feedback && (
        <div style={{ fontSize: 12, color: '#374151', background: '#f9fafb', borderRadius: 6, padding: '4px 8px', marginTop: 4, fontStyle: 'italic' }}>
          "{rsvp.feedback}"
        </div>
      )}
    </div>
  );
};

// ── Venue Card ─────────────────────────────────────────────────────────────

export const VenueCard: React.FC<{ venue: VenueBooking }> = ({ venue }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 14,
    border: `1px solid ${venue.isAvailable ? '#22c55e30' : '#ef444430'}`,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>📍 {venue.venue}</div>
      <span style={{ fontSize: 10, fontWeight: 700, color: venue.isAvailable ? '#22c55e' : '#ef4444' }}>
        {venue.isAvailable ? '● Available' : '● Booked'}
      </span>
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
      {venue.venueType} · Capacity: {venue.capacity} · Booked by: {venue.bookedBy}
    </div>
    <div style={{ fontSize: 11, color: '#6b7280' }}>
      📅 {venue.date} · ⏰ {venue.startTime} - {venue.endTime}
    </div>
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
      {venue.equipment.map(e => (
        <span key={e} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#eff6ff', color: '#3b82f6' }}>{e}</span>
      ))}
    </div>
  </div>
);

// ── Club Card ──────────────────────────────────────────────────────────────

export const ClubCard: React.FC<{ club: ClubActivity }> = ({ club }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>👥 {club.clubName}</div>
      <span style={{ fontSize: 11, color: '#9ca3af' }}>{club.memberCount} members</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, marginBottom: 8 }}>
      <div>Events: <b>{club.totalEvents}</b></div>
      <div>Attendees: <b>{club.totalAttendees}</b></div>
      <div>Rating: <b>⭐ {club.avgRating}/5</b></div>
      <div>Upcoming: <b>{club.upcomingEvents}</b></div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: '#6b7280' }}>Engagement Score</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: club.engagementScore > 75 ? '#22c55e' : '#eab308' }}>{club.engagementScore}/100</span>
    </div>
    <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 3, width: `${club.engagementScore}%`,
        background: club.engagementScore > 75 ? '#22c55e' : club.engagementScore > 50 ? '#eab308' : '#ef4444',
      }} />
    </div>
  </div>
);

// ── Insight Card ───────────────────────────────────────────────────────────

export const InsightCard: React.FC<{ insight: EventInsight }> = ({ insight }) => {
  const colors = { positive: '#22c55e', warning: '#eab308', critical: '#ef4444', info: '#3b82f6' };
  const color = colors[insight.type];
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 14, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{insight.title}</div>
        <span style={{ fontSize: 12 }}>{insight.trend === 'up' ? '📈' : insight.trend === 'down' ? '📉' : '➡️'}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{insight.description}</div>
      <div style={{ fontSize: 11, color }}><b>{insight.metric}:</b> {insight.value}</div>
    </div>
  );
};
