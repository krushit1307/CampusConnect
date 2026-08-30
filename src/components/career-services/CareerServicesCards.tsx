/**
 * Career Services Portal — Card Components
 *
 * StatCard, JobCard, ApplicationCard, ResumeReviewCard,
 * InterviewPrepCard, InsightCard, OverviewStats.
 */

import React from 'react';
import {
  JobPosting, Application, ResumeReview, InterviewPrep, CareerInsight,
  CareerSummary,
  JOB_TYPE_COLORS, APPLICATION_COLORS, INDUSTRY_COLORS, JOB_TYPE_ICONS,
  formatSalary, formatDate,
  ApplicationStatus, JobStatus,
} from './careerServicesTypes';

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

export const OverviewStats: React.FC<{ summary: CareerSummary }> = ({ summary }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
    <StatCard label="Total Postings" value={summary.totalPostings} icon="📋" />
    <StatCard label="Open" value={summary.openPostings} icon="🟢" color="#22c55e" />
    <StatCard label="Applications" value={summary.totalApplications} icon="📨" />
    <StatCard label="Interviews" value={summary.interviewsScheduled} icon="🎯" color="#8b5cf6" />
    <StatCard label="Offers" value={summary.offersReceived} icon="🎉" color="#22c55e" />
    <StatCard label="Placement Rate" value={`${summary.placementRate}%`} icon="📈" />
    <StatCard label="Avg Salary" value={`$${(summary.avgSalary / 1000).toFixed(0)}k`} icon="💰" />
    <StatCard label="Resume Reviews" value={summary.resumeReviews} icon="📝" />
    <StatCard label="Avg Resume Score" value={`${summary.avgResumeScore}/100`} icon="🎯" color={summary.avgResumeScore > 70 ? '#22c55e' : '#eab308'} />
  </div>
);

// ── Status Badges ──────────────────────────────────────────────────────────

const JobStatusBadge: React.FC<{ status: JobStatus }> = ({ status }) => {
  const colors: Record<JobStatus, string> = { 'Open': '#22c55e', 'Closed': '#6b7280', 'Filled': '#3b82f6', 'Pending Review': '#eab308' };
  return <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: colors[status], background: `${colors[status]}15` }}>{status}</span>;
};

const AppStatusBadge: React.FC<{ status: ApplicationStatus }> = ({ status }) => (
  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: APPLICATION_COLORS[status], background: `${APPLICATION_COLORS[status]}15` }}>{status}</span>
);

// ── Job Card ───────────────────────────────────────────────────────────────

export const JobCard: React.FC<{ job: JobPosting }> = ({ job }) => (
  <div style={{
    background: '#fff', borderRadius: 12, padding: 16,
    borderLeft: `4px solid ${JOB_TYPE_COLORS[job.type]}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>
        {JOB_TYPE_ICONS[job.type]} {job.title}
      </div>
      <JobStatusBadge status={job.status} />
    </div>
    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{job.company} · {job.industry}</div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{job.description}</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11, marginBottom: 8 }}>
      <div>💰 {formatSalary(job.salaryMin, job.salaryMax)}</div>
      <div>📍 {job.location}</div>
      <div>{job.isRemote ? '🌍 Remote' : '🏢 On-site'}</div>
      <div>👥 {job.applicantCount} applicants</div>
      <div>📅 Deadline: {formatDate(job.deadline)}</div>
      <div>📄 {job.type}</div>
    </div>
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {job.skills.slice(0, 4).map(s => (
        <span key={s} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#eff6ff', color: '#3b82f6' }}>{s}</span>
      ))}
    </div>
  </div>
);

// ── Application Card ───────────────────────────────────────────────────────

export const ApplicationCard: React.FC<{ application: Application }> = ({ application }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{application.jobTitle}</div>
      <AppStatusBadge status={application.status} />
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
      {application.company} · Applicant: {application.studentName}
    </div>
    <div style={{ fontSize: 11, color: '#6b7280' }}>
      Applied: {formatDate(application.appliedAt)}
      {application.interviewDate && <span> · Interview: {formatDate(application.interviewDate)}</span>}
      {application.offerAmount && <span> · 💰 ${(application.offerAmount / 1000).toFixed(0)}k</span>}
    </div>
  </div>
);

// ── Resume Review Card ─────────────────────────────────────────────────────

export const ResumeReviewCard: React.FC<{ review: ResumeReview }> = ({ review }) => {
  const scoreColor = review.score >= 80 ? '#22c55e' : review.score >= 60 ? '#eab308' : '#ef4444';
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>📝 {review.studentName}</div>
        <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor }}>{review.score}</span>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
        Reviewer: {review.reviewerName} · {formatDate(review.submittedAt)} · {review.status}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, marginBottom: 6 }}>
        {review.categories.map(c => (
          <div key={c.name}>
            <span style={{ color: '#6b7280' }}>{c.name}:</span> <b style={{ color: c.score >= 70 ? '#22c55e' : '#eab308' }}>{c.score}</b>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 2 }}>💪 {review.strengths.join(', ')}</div>
      <div style={{ fontSize: 11, color: '#f59e0b' }}>🔧 {review.improvements.join(', ')}</div>
    </div>
  );
};

// ── Interview Prep Card ────────────────────────────────────────────────────

export const InterviewPrepCard: React.FC<{ prep: InterviewPrep }> = ({ prep }) => {
  const diffColor = prep.difficulty === 'Hard' ? '#ef4444' : prep.difficulty === 'Medium' ? '#eab308' : '#22c55e';
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 14, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>🎯 {prep.company} — {prep.role}</div>
        <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: diffColor, background: `${diffColor}15` }}>{prep.difficulty}</span>
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        Type: {prep.type} · ⏱️ {prep.avgPreparationTime}min avg · ✅ {prep.successRate}% success
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
        👥 {prep.completedBy} students completed
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {prep.questions.map((q, i) => (
          <span key={i} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: '#f3f4f6', color: '#6b7280' }}>{q}</span>
        ))}
      </div>
    </div>
  );
};

// ── Insight Card ───────────────────────────────────────────────────────────

export const InsightCard: React.FC<{ insight: CareerInsight }> = ({ insight }) => {
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
