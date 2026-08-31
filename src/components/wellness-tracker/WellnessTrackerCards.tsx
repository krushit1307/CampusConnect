import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, subtitle }) => (
  <div style={{
    background: '#fff',
    borderRadius: 12,
    padding: '20px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    borderLeft: `4px solid ${color}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>{label}</span>
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    {subtitle && <div style={{ fontSize: 12, color: '#999' }}>{subtitle}</div>}
  </div>
);

interface WellnessScoreCardProps {
  dimension: string;
  score: number;
  maxScore: number;
  icon: string;
  color: string;
  trend?: string;
}

export const WellnessScoreCard: React.FC<WellnessScoreCardProps> = ({ dimension, score, maxScore, icon, color, trend }) => {
  const pct = Math.round((score / maxScore) * 100);
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{dimension}</span>
        </div>
        {trend && (
          <span style={{ fontSize: 12, color: trend.startsWith('+') ? '#22c55e' : '#ef4444', fontWeight: 500 }}>
            {trend}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{score}/{maxScore}</span>
      </div>
    </div>
  );
};

interface HealthLogCardProps {
  log: {
    id: string;
    date: string;
    sleepHours: number;
    exerciseMinutes: number;
    mood: number;
    stressLevel: number;
    waterIntake: number;
    meals: number;
    notes?: string;
  };
  moodEmojis: Record<number, string>;
}

export const HealthLogCard: React.FC<HealthLogCardProps> = ({ log, moodEmojis }) => (
  <div style={{
    background: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{log.date}</span>
      <span style={{ fontSize: 24 }}>{moodEmojis[log.mood] || '😐'}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12, color: '#555' }}>
      <div>🛏️ {log.sleepHours}h sleep</div>
      <div>🏃 {log.exerciseMinutes}min</div>
      <div>💧 {log.waterIntake}L</div>
      <div>🍽️ {log.meals} meals</div>
      <div>😰 Stress: {log.stressLevel}/10</div>
      <div>😊 Mood: {log.mood}/10</div>
    </div>
    {log.notes && (
      <div style={{ fontSize: 12, color: '#777', fontStyle: 'italic', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
        "{log.notes}"
      </div>
    )}
  </div>
);

interface AppointmentCardProps {
  appointment: {
    id: string;
    type: string;
    provider: string;
    date: string;
    time: string;
    status: string;
    location: string;
    notes?: string;
  };
  typeColors: Record<string, string>;
  statusColors: Record<string, string>;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({ appointment, typeColors, statusColors }) => (
  <div style={{
    background: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    borderLeft: `4px solid ${typeColors[appointment.type] || '#6b7280'}`
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{appointment.type}</span>
      <span style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 10,
        background: `${statusColors[appointment.status] || '#6b7280'}20`,
        color: statusColors[appointment.status] || '#6b7280',
        fontWeight: 600
      }}>{appointment.status}</span>
    </div>
    <div style={{ fontSize: 13, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div>👤 {appointment.provider}</div>
      <div>📅 {appointment.date} at {appointment.time}</div>
      <div>📍 {appointment.location}</div>
    </div>
    {appointment.notes && (
      <div style={{ fontSize: 12, color: '#777', fontStyle: 'italic', marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
        {appointment.notes}
      </div>
    )}
  </div>
);

interface ResourceCardProps {
  resource: {
    id: string;
    title: string;
    category: string;
    description: string;
    rating: number;
    accessCount: number;
    url?: string;
  };
  categoryColors: Record<string, string>;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, categoryColors }) => (
  <div style={{
    background: '#fff',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    borderLeft: `4px solid ${categoryColors[resource.category] || '#6b7280'}`
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <span style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 10,
        background: `${categoryColors[resource.category] || '#6b7280'}20`,
        color: categoryColors[resource.category] || '#6b7280',
        fontWeight: 600
      }}>{resource.category}</span>
      <span style={{ fontSize: 12, color: '#999' }}>⭐ {resource.rating}</span>
    </div>
    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{resource.title}</div>
    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{resource.description}</div>
    <div style={{ fontSize: 11, color: '#aaa' }}>👁️ {resource.accessCount} views</div>
  </div>
);

interface ChallengeCardProps {
  challenge: {
    id: string;
    name: string;
    description: string;
    duration: string;
    participants: number;
    completions: number;
    category: string;
    difficulty: string;
    startDate: string;
  };
  categoryColors: Record<string, string>;
  difficultyColors: Record<string, string>;
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, categoryColors, difficultyColors }) => {
  const completionRate = challenge.participants > 0
    ? Math.round((challenge.completions / challenge.participants) * 100)
    : 0;
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      borderLeft: `4px solid ${categoryColors[challenge.category] || '#6b7280'}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 10,
          background: `${categoryColors[challenge.category] || '#6b7280'}20`,
          color: categoryColors[challenge.category] || '#6b7280',
          fontWeight: 600
        }}>{challenge.category}</span>
        <span style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 10,
          background: `${difficultyColors[challenge.difficulty] || '#6b7280'}20`,
          color: difficultyColors[challenge.difficulty] || '#6b7280',
          fontWeight: 600
        }}>{challenge.difficulty}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{challenge.name}</div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{challenge.description}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 8 }}>
        <span>⏱️ {challenge.duration}</span>
        <span>👥 {challenge.participants} joined</span>
      </div>
      <div style={{ fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#555' }}>Completion Rate</span>
          <span style={{ fontWeight: 600, color: '#22c55e' }}>{completionRate}%</span>
        </div>
        <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${completionRate}%`, background: '#22c55e', borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
};

interface InsightCardProps {
  insight: {
    id: string;
    type: string;
    title: string;
    description: string;
    priority: string;
    actionable: boolean;
  };
}

export const InsightCard: React.FC<InsightCardProps> = ({ insight }) => {
  const priorityColors: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
  const color = priorityColors[insight.priority] || '#6b7280';
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{insight.title}</span>
        <span style={{
          fontSize: 11,
          padding: '2px 8px',
          borderRadius: 10,
          background: `${color}20`,
          color,
          fontWeight: 600
        }}>{insight.priority}</span>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{insight.description}</div>
      {insight.actionable && (
        <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 500 }}>🔗 Actionable</span>
      )}
    </div>
  );
};
