/**
 * Career Services Portal Dashboard (#1413)
 *
 * Job/internship postings, application tracking, resume reviews,
 * interview prep, mentorship matching, and career analytics.
 */

import { useMemo, useState } from 'react';

import { getCareerServicesData } from './careerServicesService';
import {
  OverviewStats, JobCard, ApplicationCard, ResumeReviewCard,
  InterviewPrepCard, InsightCard,
} from './CareerServicesCards';
import {
  BarChart, DonutChart, TrendLine, HorizontalBar, RadarChart,
} from './CareerServicesCharts';
import { JOB_TYPE_COLORS, JOB_TYPE_ICONS, INDUSTRY_COLORS } from './careerServicesTypes';

const TABS = ['Overview', 'Jobs', 'Applications', 'Resume Reviews', 'Interview Prep', 'Analytics'];

export default function CareerServicesDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const data = useMemo(() => getCareerServicesData(), []);

  const filteredJobs = useMemo(() => {
    return data.jobPostings.filter(j => {
      if (filterType !== 'All' && j.type !== filterType) return false;
      if (filterStatus !== 'All' && j.status !== filterStatus) return false;
      return true;
    });
  }, [data.jobPostings, filterType, filterStatus]);

  // Chart data
  const typeDonut = Object.entries(
    data.jobPostings.reduce((acc, j) => { acc[j.type] = (acc[j.type] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([label, value]) => ({ label, value, color: JOB_TYPE_COLORS[label as keyof typeof JOB_TYPE_COLORS] || '#3b82f6' }));

  const industryDonut = Object.entries(
    data.jobPostings.reduce((acc, j) => { acc[j.industry] = (acc[j.industry] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([label, value]) => ({ label, value, color: INDUSTRY_COLORS[label as keyof typeof INDUSTRY_COLORS] || '#3b82f6' }));

  const appStatusDonut = [
    { label: 'Applied', value: data.applications.filter(a => a.status === 'Applied').length, color: '#3b82f6' },
    { label: 'Under Review', value: data.applications.filter(a => a.status === 'Under Review').length, color: '#eab308' },
    { label: 'Interview', value: data.applications.filter(a => a.status === 'Interview Scheduled').length, color: '#8b5cf6' },
    { label: 'Offer', value: data.applications.filter(a => a.status === 'Offer Received').length, color: '#22c55e' },
    { label: 'Rejected', value: data.applications.filter(a => a.status === 'Rejected').length, color: '#ef4444' },
  ];

  const companyBar = data.companyStats.slice(0, 8)
    .map(c => ({ label: c.company.slice(0, 8), value: c.totalApplicants }))
    .sort((a, b) => b.value - a.value);

  const successRateBar = data.interviewPrep
    .map(p => ({ label: `${p.company.slice(0, 6)} ${p.type.slice(0, 4)}`, value: p.successRate, color: p.successRate > 60 ? '#22c55e' : '#eab308' }))
    .sort((a, b) => b.value - a.value);

  const prepRadar = data.interviewPrep.slice(0, 5).map(p => ({
    axis: `${p.company.slice(0, 6)} ${p.type.slice(0, 4)}`, value: p.successRate / 100,
  }));

  const filterBarStyle = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db',
    fontSize: 12, color: '#374151', background: '#fff', outline: 'none',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
          💼 Career Services Portal
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Job/internship postings, application tracking, resume reviews, and interview prep.
        </p>
      </div>

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

      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <OverviewStats summary={data.summary} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <DonutChart data={typeDonut} title="Jobs by Type" />
            <DonutChart data={industryDonut} title="Jobs by Industry" />
            <BarChart data={companyBar} title="Top Companies by Applicants" height={200} />
          </div>
          <TrendLine trends={data.trends} title="Career Trends Over Time" lines={[
            { key: 'newPostings', color: '#3b82f6', label: 'New Postings' },
            { key: 'totalApplications', color: '#22c55e', label: 'Applications' },
            { key: 'offersExtended', color: '#8b5cf6', label: 'Offers' },
          ]} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <HorizontalBar data={successRateBar} title="Interview Success Rate" />
            <RadarChart data={prepRadar} title="Interview Prep Performance" />
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🧠 Career Insights</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {data.insights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Jobs' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={filterBarStyle}>
              <option value="All">All Types</option>
              {['Full-Time','Part-Time','Internship','Co-Op','Contract','Freelance'].map(t => (
                <option key={t} value={t}>{JOB_TYPE_ICONS[t]} {t}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterBarStyle}>
              <option value="All">All Statuses</option>
              {['Open','Closed','Filled','Pending Review'].map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{filteredJobs.length} jobs</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
            {filteredJobs.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()).map(j => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Applications' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <DonutChart data={appStatusDonut} title="Application Status" />
            <DonutChart data={typeDonut} title="Applications by Job Type" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
            {data.applications.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()).map(a => (
              <ApplicationCard key={a.id} application={a} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Resume Reviews' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
          {data.resumeReviews.sort((a, b) => b.score - a.score).map(r => (
            <ResumeReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}

      {activeTab === 'Interview Prep' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <HorizontalBar data={successRateBar} title="Success Rate by Role" />
            <RadarChart data={prepRadar} title="Performance Radar" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 10 }}>
            {data.interviewPrep.map(p => <InterviewPrepCard key={p.id} prep={p} />)}
          </div>
        </div>
      )}

      {activeTab === 'Analytics' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <DonutChart data={typeDonut} title="Jobs by Type" />
            <DonutChart data={industryDonut} title="Jobs by Industry" />
            <BarChart data={companyBar} title="Top Companies" height={200} />
          </div>
          <TrendLine trends={data.trends} title="12-Month Career Trends" lines={[
            { key: 'newPostings', color: '#3b82f6', label: 'Postings' },
            { key: 'totalApplications', color: '#22c55e', label: 'Applications' },
            { key: 'placementRate', color: '#8b5cf6', label: 'Placement Rate' },
          ]} />
        </div>
      )}
    </div>
  );
}
