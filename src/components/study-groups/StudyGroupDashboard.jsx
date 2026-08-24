/**
 * Study Group Scheduler Dashboard (#1407)
 *
 * Study group management, session scheduling, attendance tracking,
 * note sharing, and collaboration analytics.
 */

import { useMemo, useState } from 'react';

import { getStudyGroupData } from './studyGroupService';
import {
  OverviewStats, GroupCard, SessionCard, NoteCard, MemberCard,
  ActivityCard, InsightCard,
} from './StudyGroupCards';
import {
  BarChart, DonutChart, TrendLine, HorizontalBar, RadarChart,
} from './StudyGroupCharts';
import { SUBJECT_COLORS, SUBJECT_ICONS } from './studyGroupTypes';

const TABS = ['Overview', 'Groups', 'Sessions', 'Notes', 'Members', 'Activity'];

export default function StudyGroupDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const data = useMemo(() => getStudyGroupData(), []);

  const filteredGroups = useMemo(() => {
    return data.groups.filter(g => {
      if (filterSubject !== 'All' && g.subject !== filterSubject) return false;
      if (filterStatus !== 'All' && g.status !== filterStatus) return false;
      return true;
    });
  }, [data.groups, filterSubject, filterStatus]);

  // Chart data
  const statusDonut = [
    { label: 'Active', value: data.summary.activeGroups, color: '#22c55e' },
    { label: 'Recruiting', value: data.summary.recruitingGroups, color: '#3b82f6' },
    { label: 'Paused', value: data.groups.filter(g => g.status === 'Paused').length, color: '#eab308' },
    { label: 'Completed', value: data.groups.filter(g => g.status === 'Completed').length, color: '#6b7280' },
  ];

  const subjectBar = data.subjectStats
    .filter(s => s.groupCount > 0)
    .map(s => ({ label: s.subject.slice(0, 8), value: s.groupCount, color: SUBJECT_COLORS[s.subject] || '#3b82f6' }))
    .sort((a, b) => b.value - a.value);

  const attendanceBar = data.subjectStats
    .filter(s => s.groupCount > 0)
    .map(s => ({ label: s.subject.slice(0, 8), value: s.avgAttendance, color: s.avgAttendance > 80 ? '#22c55e' : '#eab308' }))
    .sort((a, b) => b.value - a.value);

  const notesBar = data.subjectStats
    .filter(s => s.totalNotes > 0)
    .map(s => ({ label: s.subject.slice(0, 8), value: s.totalNotes, color: SUBJECT_COLORS[s.subject] || '#3b82f6' }))
    .sort((a, b) => b.value - a.value);

  const subjectRadar = data.subjectStats.slice(0, 6).map(s => ({
    axis: s.subject.slice(0, 8), value: s.avgAttendance / 100,
  }));

  const filterBarStyle = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 12, color: '#374151', background: '#fff', outline: 'none',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
          📚 Study Group Scheduler
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Study group management, session scheduling, attendance tracking, and note sharing.
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
            <DonutChart data={statusDonut} title="Groups by Status" />
            <BarChart data={subjectBar} title="Groups by Subject" height={200} />
            <RadarChart data={subjectRadar} title="Attendance by Subject" />
          </div>
          <TrendLine
            trends={data.trends}
            title="Collaboration Trends Over Time"
            lines={[
              { key: 'totalGroups', color: '#3b82f6', label: 'Groups' },
              { key: 'totalSessions', color: '#22c55e', label: 'Sessions' },
              { key: 'totalNotes', color: '#8b5cf6', label: 'Notes' },
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <HorizontalBar data={attendanceBar} title="Avg Attendance by Subject" />
            <BarChart data={notesBar} title="Notes by Subject" height={200} />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🧠 Study Insights</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {data.insights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            </div>
          </div>
        </div>
      )}

      {/* Groups Tab */}
      {activeTab === 'Groups' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={filterBarStyle}>
              <option value="All">All Subjects</option>
              {['Data Structures','Algorithms','Linear Algebra','Calculus','Operating Systems','Databases','Machine Learning','Physics','Statistics','Networking','Compiler Design','Economics'].map(s => (
                <option key={s} value={s}>{SUBJECT_ICONS[s]} {s}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterBarStyle}>
              <option value="All">All Statuses</option>
              {['Active','Paused','Completed','Recruiting'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{filteredGroups.length} groups</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
            {filteredGroups.map(g => <GroupCard key={g.id} group={g} />)}
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'Sessions' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
          {data.sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(s => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'Notes' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
          {data.notes.sort((a, b) => b.downloads - a.downloads).map(n => (
            <NoteCard key={n.id} note={n} />
          ))}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'Members' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
          {data.members.sort((a, b) => b.contributionScore - a.contributionScore).map(m => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'Activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 800 }}>
          {data.activity.map(a => <ActivityCard key={a.id} activity={a} />)}
        </div>
      )}
    </div>
  );
}
