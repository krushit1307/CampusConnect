import React, { useState, useMemo } from 'react';
import {
  StatCard, WellnessScoreCard, HealthLogCard, AppointmentCard,
  ResourceCard, ChallengeCard, InsightCard
} from './WellnessTrackerCards';
import { BarChart, DonutChart, TrendLine, HorizontalBar, RadarChart } from './WellnessTrackerCharts';
import {
  getHealthLogs, getWellnessScores, getAppointments, getResources,
  getChallenges, getInsights, getMonthlyTrends, getDepartmentStats,
  CATEGORY_COLORS, STATUS_COLORS, DIFFICULTY_COLORS, MOOD_EMOJIS
} from './wellnessTrackerService';

const TABS = ['Overview', 'Health Logs', 'Appointments', 'Resources', 'Challenges', 'Insights'];

const WellnessTrackerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Overview');

  const healthLogs = useMemo(() => getHealthLogs(), []);
  const scores = useMemo(() => getWellnessScores(), []);
  const appointments = useMemo(() => getAppointments(), []);
  const resources = useMemo(() => getResources(), []);
  const challenges = useMemo(() => getChallenges(), []);
  const insights = useMemo(() => getInsights(), []);
  const trends = useMemo(() => getMonthlyTrends(), []);
  const deptStats = useMemo(() => getDepartmentStats(), []);

  const totalAppointments = appointments.length;
  const upcomingAppts = appointments.filter(a => a.status === 'Scheduled').length;
  const totalResources = resources.length;
  const activeChallenges = challenges.length;

  const avgSleep = healthLogs.length > 0
    ? (healthLogs.reduce((s, l) => s + l.sleepHours, 0) / healthLogs.length).toFixed(1)
    : '0';
  const avgMood = healthLogs.length > 0
    ? (healthLogs.reduce((s, l) => s + l.mood, 0) / healthLogs.length).toFixed(1)
    : '0';
  const avgStress = healthLogs.length > 0
    ? (healthLogs.reduce((s, l) => s + l.stressLevel, 0) / healthLogs.length).toFixed(1)
    : '0';

  const resourceCategoryData = resources.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const donutData = Object.entries(resourceCategoryData).map(([label, value], i) => ({
    label,
    value,
    color: Object.values(CATEGORY_COLORS)[i % Object.values(CATEGORY_COLORS).length]
  }));

  const statusData = appointments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusDonut = Object.entries(statusData).map(([label, value], i) => ({
    label,
    value,
    color: Object.values(STATUS_COLORS)[i % Object.values(STATUS_COLORS).length]
  }));

  const challengeBarData = Object.entries(
    challenges.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([label, value]) => ({
    label,
    value,
    color: CATEGORY_COLORS[label] || '#6b7280'
  }));

  const trendLabels = trends.map(t => t.month);
  const trendLines = [
    { label: 'Avg Sleep', data: trends.map(t => t.avgSleep), color: '#6366f1' },
    { label: 'Avg Mood', data: trends.map(t => t.avgMood), color: '#22c55e' },
    { label: 'Avg Exercise', data: trends.map(t => t.avgExerciseMin), color: '#f59e0b' }
  ];

  const radarData = scores.map(s => ({
    label: s.dimension,
    value: s.score,
    max: s.maxScore
  }));

  const deptBarData = deptStats.map(d => ({
    label: d.department,
    value: Math.round(d.avgWellnessScore),
    color: `hsl(${Math.random() * 360}, 60%, 50%)`
  }));

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: '#1e293b' }}>
        🏥 Campus Wellness Tracker
      </h1>
      <p style={{ color: '#64748b', marginBottom: 20, fontSize: 14 }}>
        Monitor student health, track wellness scores, and manage wellness resources
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid #e2e8f0', paddingBottom: 8, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: activeTab === tab ? '#6366f1' : 'transparent',
            color: activeTab === tab ? '#fff' : '#64748b',
            transition: 'all 0.2s'
          }}>{tab}</button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard label="Avg Sleep" value={`${avgSleep}h`} icon="🛏️" color="#6366f1" subtitle="per night" />
            <StatCard label="Avg Mood" value={`${avgMood}/10`} icon="😊" color="#22c55e" subtitle="student average" />
            <StatCard label="Avg Stress" value={`${avgStress}/10`} icon="😰" color="#ef4444" subtitle="student average" />
            <StatCard label="Resources" value={totalResources} icon="📚" color="#8b5cf6" subtitle="wellness resources" />
            <StatCard label="Active Challenges" value={activeChallenges} icon="🏆" color="#f59e0b" subtitle="join now" />
            <StatCard label="Upcoming Appts" value={upcomingAppts} icon="📅" color="#06b6d4" subtitle={`of ${totalAppointments} total`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#334155' }}>Wellness Dimensions</h3>
              <RadarChart data={radarData} size={220} color="#6366f1" />
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#334155' }}>Resource Categories</h3>
              <DonutChart data={donutData} />
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#334155' }}>Appointment Status</h3>
              <DonutChart data={statusDonut} />
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#334155' }}>12-Month Wellness Trends</h3>
            <TrendLine lines={trendLines} labels={trendLabels} width={600} height={200} />
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#334155' }}>Department Wellness Scores</h3>
            <HorizontalBar data={deptBarData} width={500} height={deptBarData.length * 28} />
          </div>

          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#334155' }}>🔑 Insights</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            {insights.map(insight => <InsightCard key={insight.id} insight={insight} />)}
          </div>
        </div>
      )}

      {activeTab === 'Health Logs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#334155' }}>Sleep & Exercise Trends</h3>
            <TrendLine lines={[
              { label: 'Sleep', data: healthLogs.slice(-12).map(l => l.sleepHours), color: '#6366f1' },
              { label: 'Exercise', data: healthLogs.slice(-12).map(l => l.exerciseMinutes / 10), color: '#22c55e' }
            ]} width={600} height={160} />
          </div>
          {healthLogs.map(log => (
            <HealthLogCard key={log.id} log={log} moodEmojis={MOOD_EMOJIS} />
          ))}
        </div>
      )}

      {activeTab === 'Appointments' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            {Object.entries(statusData).map(([status, count]) => (
              <StatCard key={status} label={status} value={count} icon="📅" color={STATUS_COLORS[status] || '#6b7280'} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {appointments.map(apt => (
              <AppointmentCard key={apt.id} appointment={apt} typeColors={CATEGORY_COLORS} statusColors={STATUS_COLORS} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Resources' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {resources.map(res => (
              <ResourceCard key={res.id} resource={res} categoryColors={CATEGORY_COLORS} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Challenges' && (
        <div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#334155' }}>Challenges by Category</h3>
            <BarChart data={challengeBarData} width={500} height={180} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {challenges.map(ch => (
              <ChallengeCard key={ch.id} challenge={ch} categoryColors={CATEGORY_COLORS} difficultyColors={DIFFICULTY_COLORS} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Insights' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {insights.map(insight => <InsightCard key={insight.id} insight={insight} />)}
        </div>
      )}
    </div>
  );
};

export default WellnessTrackerDashboard;
