/**
 * Study Group Scheduler — Card Components
 *
 * StatCard, GroupCard, SessionCard, NoteCard, MemberCard,
 * ActivityCard, InsightCard, OverviewStats.
 */

import React from 'react';
import {
  StudyGroup, StudySession, SharedNote, GroupMember, GroupActivity,
  StudyInsight, StudyGroupSummary,
  SUBJECT_COLORS, STATUS_COLORS, SESSION_COLORS, SUBJECT_ICONS,
  formatCapacity, formatDate, formatTime,
  GroupStatus, SessionStatus,
} from './studyGroupTypes';

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

export const OverviewStats: React.FC<{ summary: StudyGroupSummary }> = ({ summary }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
    <StatCard label="Total Groups" value={summary.totalGroups} icon="👥" />
    <StatCard label="Active" value={summary.activeGroups} icon="🟢" color="#22c55e" />
    <StatCard label="Recruiting" value={summary.recruitingGroups} icon="📢" color="#3b82f6" />
    <StatCard label="Total Members" value={summary.totalMembers} icon="👤" />
    <StatCard label="Total Sessions" value={summary.totalSessions} icon="📅" />
    <StatCard label="Total Notes" value={summary.totalNotes} icon="📝" />
    <StatCard label="Avg Attendance" value={`${summary.avgAttendance}%`} icon="📊" color={summary.avgAttendance > 75 ? '#22c55e' : '#eab308'} />
    <StatCard label="Avg Rating" value={`${summary.avgSessionRating}/5`} icon="⭐" color="#f59e0b" />
  </div>
);

// ── Status Badge ───────────────────────────────────────────────────────────

const GroupStatusBadge: React.FC<{ status: GroupStatus }> = ({ status }) => (
  <span style={{
    padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
    color: STATUS_COLORS[status], background: `${STATUS_COLORS[status]}15`,
    border: `1px solid ${STATUS_COLORS[status]}30`,
  }}>{status}</span>
);

const SessionStatusBadge: React.FC<{ status: SessionStatus }> = ({ status }) => (
  <span style={{
    padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
    color: SESSION_COLORS[status], background: `${SESSION_COLORS[status]}15`,
  }}>{status}</span>
);

// ── Group Card ─────────────────────────────────────────────────────────────

export const GroupCard: React.FC<{ group: StudyGroup }> = ({ group }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 16,
    borderLeft: `4px solid ${SUBJECT_COLORS[group.subject]}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>
        {SUBJECT_ICONS[group.subject]} {group.name}
      </div>
      <GroupStatusBadge status={group.status} />
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{group.description}</div>
    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
      Owner: {group.owner} · {group.subject}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, marginBottom: 8 }}>
      <div>👥 {formatCapacity(group.memberCount, group.maxMembers)}</div>
      <div>📅 {group.totalSessions} sessions</div>
      <div>📝 {group.totalNotes} notes</div>
      <div>📊 {group.avgAttendance}% attendance</div>
      <div>🎯 {group.actualWeeklyHours}/{group.weeklyGoal}h/week</div>
      {group.nextSession && <div>🔜 {formatDate(group.nextSession)}</div>}
    </div>
    {/* Attendance bar */}
    <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
      <div style={{
        height: '100%', borderRadius: 3, width: `${group.avgAttendance}%`,
        background: group.avgAttendance > 80 ? '#22c55e' : group.avgAttendance > 60 ? '#eab308' : '#ef4444',
      }} />
    </div>
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {group.tags.map(t => (
        <span key={t} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#f3f4f6', color: '#6b7280' }}>{t}</span>
      ))}
    </div>
  </div>
);

// ── Session Card ───────────────────────────────────────────────────────────

export const SessionCard: React.FC<{ session: StudySession }> = ({ session }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{SUBJECT_ICONS[session.subject]} {session.title}</div>
      <SessionStatusBadge status={session.status} />
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{session.groupName}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, marginBottom: 4 }}>
      <div>📅 {formatDate(session.date)}</div>
      <div>⏰ {formatTime(session.startTime)} - {formatTime(session.endTime)}</div>
      <div>📍 {session.location}</div>
      <div>👤 {session.host}</div>
    </div>
    {session.status === 'Completed' && (
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
        👥 {session.attendees}/{session.expectedAttendees} attended
        {session.rating && <span> · ⭐ {session.rating}/5</span>}
      </div>
    )}
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {session.isVirtual && <span style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#eff6ff', color: '#3b82f6' }}>💻 Virtual</span>}
      {session.topicsCovered.map(t => (
        <span key={t} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#f3f4f6', color: '#6b7280' }}>{t}</span>
      ))}
    </div>
  </div>
);

// ── Note Card ──────────────────────────────────────────────────────────────

export const NoteCard: React.FC<{ note: SharedNote }> = ({ note }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' }}>
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>📝 {note.title}</div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
      {note.groupName} · {note.type} · {note.subject}
    </div>
    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
      <span>👤 {note.uploadedBy}</span>
      <span>📥 {note.downloads} downloads</span>
      <span>⭐ {note.rating}/5</span>
      <span>📦 {note.fileSize}</span>
    </div>
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {note.tags.map(t => (
        <span key={t} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#f3f4f6', color: '#6b7280' }}>{t}</span>
      ))}
    </div>
  </div>
);

// ── Member Card ────────────────────────────────────────────────────────────

export const MemberCard: React.FC<{ member: GroupMember }> = ({ member }) => {
  const pct = member.totalSessions > 0 ? Math.round((member.sessionsAttended / member.totalSessions) * 100) : 0;
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 12, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>👤 {member.name}</div>
        <span style={{ padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: member.role === 'Owner' ? '#8b5cf6' : member.role === 'Admin' ? '#3b82f6' : '#6b7280', background: member.role === 'Owner' ? '#f5f3ff' : member.role === 'Admin' ? '#eff6ff' : '#f3f4f6' }}>{member.role}</span>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
        📊 {member.sessionsAttended}/{member.totalSessions} sessions ({pct}%)
      </div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>
        💪 Contribution: {member.contributionScore}/100
        {member.isActive ? <span style={{ color: '#22c55e' }}> · Active</span> : <span style={{ color: '#ef4444' }}> · Inactive</span>}
      </div>
    </div>
  );
};

// ── Activity Card ──────────────────────────────────────────────────────────

export const ActivityCard: React.FC<{ activity: GroupActivity }> = ({ activity }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
    <span style={{ fontSize: 18 }}>{activity.icon}</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, color: '#374151' }}>{activity.description}</div>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>
        {activity.groupName} · {new Date(activity.timestamp).toLocaleString()}
      </div>
    </div>
  </div>
);

// ── Insight Card ───────────────────────────────────────────────────────────

export const InsightCard: React.FC<{ insight: StudyInsight }> = ({ insight }) => {
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
