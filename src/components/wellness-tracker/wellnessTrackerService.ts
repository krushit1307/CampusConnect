/**
 * Campus Wellness Tracker — Service Layer
 *
 * Mock activities, challenges, mental health resources,
 * health events, trends, and insights.
 */

import {
  WellnessActivity, WellnessChallenge, MentalHealthResource,
  HealthEvent, WellnessTrend, CategoryStats, WellnessSummary,
  WellnessInsight, ActivityType, WellnessCategory, ChallengeStatus,
  MentalHealthType, ResourceType,
} from './wellnessTrackerTypes';

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const round1 = (n: number) => Math.round(n * 10) / 10;
const uid = () => Math.random().toString(36).substring(2, 10);

const FIRST = ['Aisha','Brent','Carmen','David','Elena','Faisal','Grace','Hiroshi','Ines','James','Kavita','Liam','Mei','Nadia','Oscar','Priya','Quinn','Ravi','Sofia','Tariq','Uma','Victor','Wendy','Xavier','Yuki','Zara'];
const LAST = ['Patel','Kim','Mueller','Santos','Nakamura','Okafor','Silva','Singh','Johansson','Tanaka','Chen','Rodriguez','Ali','Nguyen','Kowalski','Ibrahim','Kapoor','Olsen','Sato','Garcia','Das','Brown','Lee'];

// ── Activities ─────────────────────────────────────────────────────────────

function generateActivities(): WellnessActivity[] {
  const activities: WellnessActivity[] = [];
  const types: { type: ActivityType; cat: WellnessCategory; calMin: number; calMax: number }[] = [
    { type: 'Running', cat: 'Physical', calMin: 300, calMax: 600 },
    { type: 'Walking', cat: 'Physical', calMin: 100, calMax: 250 },
    { type: 'Cycling', cat: 'Physical', calMin: 250, calMax: 500 },
    { type: 'Swimming', cat: 'Physical', calMin: 350, calMax: 600 },
    { type: 'Yoga', cat: 'Mental', calMin: 100, calMax: 300 },
    { type: 'Weight Training', cat: 'Physical', calMin: 200, calMax: 450 },
    { type: 'Basketball', cat: 'Physical', calMin: 350, calMax: 650 },
    { type: 'Soccer', cat: 'Physical', calMin: 400, calMax: 700 },
    { type: 'Tennis', cat: 'Physical', calMin: 300, calMax: 550 },
    { type: 'Dance', cat: 'Physical', calMin: 200, calMax: 450 },
    { type: 'Meditation', cat: 'Mental', calMin: 20, calMax: 80 },
    { type: 'Hiking', cat: 'Physical', calMin: 350, calMax: 600 },
  ];
  for (let i = 0; i < 50; i++) {
    const t = pick(types);
    const duration = rand(15, 90);
    const moodBefore = rand(1, 5);
    const moodAfter = Math.min(5, moodBefore + rand(0, 2));
    activities.push({
      id: uid(), studentId: `STU-${rand(1000, 9999)}`,
      studentName: `${pick(FIRST)} ${pick(LAST)}`,
      type: t.type, category: t.cat, duration,
      calories: Math.round(duration * (t.calMin + Math.random() * (t.calMax - t.calMin)) / 60),
      date: `2026-08-${String(rand(1, 24)).padStart(2, '0')}`,
      distance: t.type === 'Running' || t.type === 'Cycling' || t.type === 'Walking' ? round1(1 + Math.random() * 10) : undefined,
      moodBefore, moodAfter,
      rating: rand(3, 5),
    });
  }
  return activities;
}

// ── Challenges ─────────────────────────────────────────────────────────────

function generateChallenges(): WellnessChallenge[] {
  return [
    { id: uid(), title: '30-Day Step Challenge', description: 'Walk 10,000 steps daily for 30 days.', category: 'Physical', status: 'Active', startDate: '2026-08-01', endDate: '2026-08-31', targetValue: 300000, currentValue: 210000, unit: 'steps', participantCount: 156, maxParticipants: 200, prize: 'Fitness Tracker', difficulty: 'Medium' },
    { id: uid(), title: 'Mindfulness Marathon', description: 'Meditate for 10 minutes daily for 21 days.', category: 'Mental', status: 'Active', startDate: '2026-08-10', endDate: '2026-08-31', targetValue: 210, currentValue: 130, unit: 'sessions', participantCount: 89, maxParticipants: 100, prize: 'Yoga Mat + Book', difficulty: 'Easy' },
    { id: uid(), title: 'Hydration Hero', description: 'Drink 8 glasses of water daily for 14 days.', category: 'Nutritional', status: 'Completed', startDate: '2026-07-15', endDate: '2026-07-28', targetValue: 14, currentValue: 14, unit: 'days', participantCount: 210, maxParticipants: 250, prize: 'Water Bottle', difficulty: 'Easy' },
    { id: uid(), title: '5K Fun Run', description: 'Complete a 5K run. All levels welcome.', category: 'Physical', status: 'Upcoming', startDate: '2026-09-15', endDate: '2026-09-15', targetValue: 5, currentValue: 0, unit: 'km', participantCount: 78, maxParticipants: 150, prize: 'Medal + Gift Card', difficulty: 'Medium' },
    { id: uid(), title: 'Sleep Champion', description: 'Get 7+ hours of sleep for 21 consecutive nights.', category: 'Sleep', status: 'Active', startDate: '2026-08-01', endDate: '2026-08-21', targetValue: 21, currentValue: 16, unit: 'nights', participantCount: 67, maxParticipants: 100, prize: 'Sleep Tracker', difficulty: 'Medium' },
    { id: uid(), title: 'Budget Boss', description: 'Track and stay under your monthly budget for 30 days.', category: 'Financial', status: 'Active', startDate: '2026-08-01', endDate: '2026-08-31', targetValue: 30, currentValue: 20, unit: 'days', participantCount: 45, maxParticipants: 75, prize: '$50 Dining Card', difficulty: 'Hard' },
    { id: uid(), title: 'Social Butterfly', description: 'Attend 5 campus wellness events this month.', category: 'Social', status: 'Upcoming', startDate: '2026-09-01', endDate: '2026-09-30', targetValue: 5, currentValue: 0, unit: 'events', participantCount: 34, maxParticipants: 60, prize: 'Campus Merch Bundle', difficulty: 'Easy' },
  ];
}

// ── Mental Health Resources ────────────────────────────────────────────────

function generateMentalHealthResources(): MentalHealthResource[] {
  return [
    { id: uid(), title: 'Campus Counseling Center', type: 'Counseling', resourceType: 'In-Person', description: 'Free one-on-one counseling sessions for all enrolled students.', provider: 'Health Services', isFree: true, rating: 4.7, usageCount: 342, category: 'Mental', availability: 'Mon-Fri 9am-5pm' },
    { id: uid(), title: 'Stress Management Workshop', type: 'Workshop', resourceType: 'In-Person', description: 'Learn practical stress management techniques and coping strategies.', provider: 'Wellness Center', isFree: true, rating: 4.5, usageCount: 156, category: 'Mental', availability: 'Every Tuesday 4pm' },
    { id: uid(), title: 'Peer Support Network', type: 'Peer Support', resourceType: 'Online', description: 'Connect with trained peer supporters for confidential conversations.', provider: 'Student Affairs', isFree: true, rating: 4.8, usageCount: 234, category: 'Mental', availability: '24/7 Online' },
    { id: uid(), title: 'Headspace App — Free for Students', type: 'Self-Help', resourceType: 'App', description: 'Guided meditation, sleep stories, and focus music. Free with .edu email.', provider: 'Headspace', isFree: true, rating: 4.9, usageCount: 567, category: 'Mental', availability: '24/7' },
    { id: uid(), title: 'Anxiety Support Group', type: 'Support Group', resourceType: 'In-Person', description: 'Weekly facilitated group for students managing anxiety.', provider: 'Counseling Center', isFree: true, rating: 4.6, usageCount: 89, category: 'Mental', availability: 'Every Thursday 5pm' },
    { id: uid(), title: 'Crisis Hotline — 988', type: 'Crisis Support', resourceType: 'Hotline', description: '24/7 crisis support. Call or text 988 for immediate help.', provider: 'National', isFree: true, rating: 5.0, usageCount: 0, category: 'Mental', contactInfo: '988', availability: '24/7' },
  ];
}

// ── Health Events ──────────────────────────────────────────────────────────

function generateHealthEvents(): HealthEvent[] {
  return [
    { id: uid(), title: 'Yoga in the Park', description: 'Free outdoor yoga session. All levels welcome. Mats provided.', category: 'Physical', date: '2026-09-05', time: '07:00', location: 'Quad Lawn', organizer: 'Wellness Center', capacity: 50, registered: 38, isVirtual: false, tags: ['yoga', 'outdoor', 'free'] },
    { id: uid(), title: 'Mental Health Awareness Week', description: 'A week of workshops, panels, and resources on mental health topics.', category: 'Mental', date: '2026-09-15', time: '09:00', location: 'Student Center', organizer: 'Counseling Center', capacity: 200, registered: 145, isVirtual: false, tags: ['mental health', 'awareness', 'workshop'] },
    { id: uid(), title: 'Nutrition Workshop', description: 'Learn to meal prep on a student budget. Healthy recipes and tips.', category: 'Nutritional', date: '2026-09-10', time: '12:00', location: 'Cafeteria', organizer: 'Health Services', capacity: 40, registered: 32, isVirtual: false, tags: ['nutrition', 'meal prep', 'free'] },
    { id: uid(), title: 'Campus 5K Fun Run', description: 'Annual 5K run/walk. Everyone welcome. Finishers get a medal.', category: 'Physical', date: '2026-09-20', time: '08:00', location: 'Track Field', organizer: 'Athletics', capacity: 200, registered: 167, isVirtual: false, tags: ['run', '5k', 'medal'] },
    { id: uid(), title: 'Sleep Hygiene Webinar', description: 'Expert tips for better sleep as a college student.', category: 'Sleep', date: '2026-09-12', time: '18:00', location: 'Online (Zoom)', organizer: 'Wellness Center', capacity: 100, registered: 56, isVirtual: true, tags: ['sleep', 'webinar', 'free'] },
    { id: uid(), title: 'Budgeting for Students Workshop', description: 'Practical financial wellness tips for managing money in college.', category: 'Financial', date: '2026-09-25', time: '14:00', location: 'Room 201', organizer: 'Financial Aid', capacity: 60, registered: 41, isVirtual: false, tags: ['finance', 'budgeting', 'workshop'] },
  ];
}

// ── Trends ─────────────────────────────────────────────────────────────────

function generateTrends(): WellnessTrend[] {
  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  let cal = 350, mood = 3.4, mins = 180, students = 120, challenges = 8, events = 15;
  return months.map((month) => {
    cal = Math.max(250, Math.min(500, cal + rand(-20, 25)));
    mood = Math.max(2.8, Math.min(4.2, mood + (-0.05 + Math.random() * 0.12)));
    mins = Math.max(120, Math.min(280, mins + rand(-15, 20)));
    students = Math.max(80, Math.min(200, students + rand(-5, 8)));
    challenges = Math.max(5, Math.min(15, challenges + rand(-1, 2)));
    events = Math.max(8, Math.min(25, events + rand(-2, 3)));
    return { month, avgCalories: cal, avgMood: round1(mood), totalMinutes: mins, activeStudents: students, challengesCompleted: challenges, eventsAttended: events };
  });
}

// ── Category Stats ─────────────────────────────────────────────────────────

function generateCategoryStats(): CategoryStats[] {
  const cats: WellnessCategory[] = ['Physical', 'Mental', 'Nutritional', 'Social', 'Sleep', 'Financial'];
  return cats.map(category => ({
    category,
    activityCount: rand(20, 80),
    totalMinutes: rand(500, 3000),
    avgRating: round1(3.5 + Math.random() * 1.5),
    avgMoodImprovement: round1(0.3 + Math.random() * 1.2),
    studentCount: rand(30, 150),
  })).sort((a, b) => b.activityCount - a.activityCount);
}

// ── Insights ───────────────────────────────────────────────────────────────

function generateInsights(): WellnessInsight[] {
  return [
    { id: uid(), title: 'Running most popular activity', description: '32% of all logged activities are running. Track season starting soon.', type: 'positive', metric: 'Share', value: '32%', trend: 'up' },
    { id: uid(), title: 'Mood improves 1.2 points after exercise', description: 'Average mood jumps from 2.8 to 4.0 after physical activity.', type: 'positive', metric: 'Mood Boost', value: '+1.2', trend: 'up' },
    { id: uid(), title: '30-Day Step Challenge 70% complete', description: '156 participants averaging 7,000 steps/day. On track to finish.', type: 'positive', metric: 'Progress', value: '70%', trend: 'up' },
    { id: uid(), title: 'Mental health resources underused', description: 'Only 12% of students have used counseling services. Awareness needed.', type: 'warning', metric: 'Usage', value: '12%', trend: 'down' },
    { id: uid(), title: 'Sleep challenge at 76%', description: '67 students tracking sleep. Average 6.8 hours — below recommended 7+.', type: 'info', metric: 'Avg Sleep', value: '6.8h', trend: 'stable' },
    { id: uid(), title: '5K Fun Run 84% registered', description: '167 of 200 spots filled. Consider opening more slots.', type: 'positive', metric: 'Registration', value: '84%', trend: 'up' },
  ];
}

// ── Dashboard Aggregator ───────────────────────────────────────────────────

export function getWellnessTrackerData() {
  const activities = generateActivities();
  const challenges = generateChallenges();
  const mentalHealthResources = generateMentalHealthResources();
  const healthEvents = generateHealthEvents();
  const trends = generateTrends();
  const categoryStats = generateCategoryStats();
  const insights = generateInsights();

  const summary: WellnessSummary = {
    totalActivities: activities.length,
    totalStudents: new Set(activities.map(a => a.studentId)).size,
    avgCalories: Math.round(activities.reduce((s, a) => s + a.calories, 0) / activities.length),
    avgMood: round1(activities.reduce((s, a) => s + a.moodAfter, 0) / activities.length),
    activeChallenges: challenges.filter(c => c.status === 'Active').length,
    totalParticipants: challenges.reduce((s, c) => s + c.participantCount, 0),
    mentalHealthResources: mentalHealthResources.length,
    upcomingEvents: healthEvents.length,
    avgDuration: Math.round(activities.reduce((s, a) => s + a.duration, 0) / activities.length),
    topActivity: 'Running' as ActivityType,
  };

  return { activities, challenges, mentalHealthResources, healthEvents, trends, categoryStats, insights, summary };
}
