/**
 * Study Group Scheduler — Service Layer
 *
 * Mock groups, members, sessions, notes, activity, trends, and insights.
 */

import {
  StudyGroup, GroupMember, StudySession, SharedNote, GroupActivity,
  CollaborationTrend, SubjectStats, StudyGroupSummary, StudyInsight,
  Subject, GroupStatus, SessionStatus, MemberRole, NoteType,
} from './studyGroupTypes';

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const round1 = (n: number) => Math.round(n * 10) / 10;
const uid = () => Math.random().toString(36).substring(2, 10);

const FIRST = ['Aisha','Brent','Carmen','David','Elena','Faisal','Grace','Hiroshi','Ines','James','Kavita','Liam','Mei','Nadia','Oscar','Priya','Quinn','Ravi','Sofia','Tariq','Uma','Victor','Wendy','Xavier','Yuki','Zara'];
const LAST = ['Patel','Kim','Mueller','Santos','Nakamura','Okafor','Silva','Singh','Johansson','Tanaka','Chen','Rodriguez','Ali','Nguyen','Kowalski','Ibrahim','Kapoor','Olsen','Sato','Garcia','Das','Brown','Lee'];

// ── Groups ─────────────────────────────────────────────────────────────────

function generateGroups(): StudyGroup[] {
  const groups: Omit<StudyGroup, 'id'>[] = [
    { name: 'Algo Masters', subject: 'Algorithms', status: 'Active', description: 'Deep dive into algorithm design, analysis, and competitive programming.', owner: 'Aisha Patel', memberCount: 12, maxMembers: 15, tags: ['competitive', 'advanced', 'CP'], createdAt: '2026-07-01', nextSession: '2026-09-05', totalSessions: 18, avgAttendance: 85, totalNotes: 24, weeklyGoal: 6, actualWeeklyHours: 5.5 },
    { name: 'DS Debuggers', subject: 'Data Structures', status: 'Active', description: 'Hands-on practice with trees, graphs, hash maps, and heaps.', owner: 'David Mueller', memberCount: 10, maxMembers: 12, tags: ['hands-on', 'intermediate'], createdAt: '2026-07-15', nextSession: '2026-09-04', totalSessions: 14, avgAttendance: 78, totalNotes: 18, weeklyGoal: 5, actualWeeklyHours: 4.2 },
    { name: 'Linear Algebra Collective', subject: 'Linear Algebra', status: 'Active', description: 'Matrix operations, eigenvalues, and applications in ML.', owner: 'Mei Nakamura', memberCount: 8, maxMembers: 10, tags: ['math', 'ML', 'visual'], createdAt: '2026-08-01', nextSession: '2026-09-06', totalSessions: 8, avgAttendance: 90, totalNotes: 15, weeklyGoal: 4, actualWeeklyHours: 4.0 },
    { name: 'OS Kernel Hacking', subject: 'Operating Systems', status: 'Active', description: 'Linux kernel internals, system calls, and process management.', owner: 'Victor Singh', memberCount: 6, maxMembers: 8, tags: ['linux', 'advanced', 'kernel'], createdAt: '2026-08-10', nextSession: '2026-09-07', totalSessions: 6, avgAttendance: 82, totalNotes: 10, weeklyGoal: 5, actualWeeklyHours: 3.8 },
    { name: 'ML Study Circle', subject: 'Machine Learning', status: 'Active', description: 'Paper readings, implementation challenges, and model competitions.', owner: 'Elena Santos', memberCount: 14, maxMembers: 15, tags: ['papers', 'implementation', 'competitions'], createdAt: '2026-06-15', nextSession: '2026-09-03', totalSessions: 22, avgAttendance: 72, totalNotes: 35, weeklyGoal: 8, actualWeeklyHours: 7.0 },
    { name: 'Calc Crew', subject: 'Calculus', status: 'Active', description: 'Multi-variable calculus, series, and real analysis.', owner: 'Grace Kim', memberCount: 7, maxMembers: 10, tags: ['math', 'intermediate'], createdAt: '2026-08-05', totalSessions: 10, avgAttendance: 88, totalNotes: 12, weeklyGoal: 4, actualWeeklyHours: 3.5 },
    { name: 'DB Query Wizards', subject: 'Databases', status: 'Recruiting', description: 'SQL optimization, NoSQL patterns, and database design.', owner: 'Bella Rodriguez', memberCount: 5, maxMembers: 10, tags: ['SQL', 'NoSQL', 'design'], createdAt: '2026-08-20', totalSessions: 4, avgAttendance: 80, totalNotes: 8, weeklyGoal: 4, actualWeeklyHours: 3.0 },
    { name: 'Physics Thinkers', subject: 'Physics', status: 'Paused', description: 'Quantum mechanics and thermodynamics problem sets.', owner: 'Tariq Khan', memberCount: 6, maxMembers: 8, tags: ['quantum', 'thermo'], createdAt: '2026-07-20', totalSessions: 12, avgAttendance: 65, totalNotes: 14, weeklyGoal: 5, actualWeeklyHours: 0 },
    { name: 'Stats & Probability Hub', subject: 'Statistics', status: 'Active', description: 'Statistical methods, probability theory, and R/Python implementation.', owner: 'Nadia Chen', memberCount: 9, maxMembers: 12, tags: ['R', 'Python', 'probability'], createdAt: '2026-07-25', nextSession: '2026-09-08', totalSessions: 15, avgAttendance: 76, totalNotes: 20, weeklyGoal: 5, actualWeeklyHours: 4.5 },
    { name: 'Network Navigators', subject: 'Networking', status: 'Completed', description: 'TCP/IP deep dive, socket programming, and network security.', owner: 'James Singh', memberCount: 8, maxMembers: 10, tags: ['TCP/IP', 'sockets', 'security'], createdAt: '2026-05-01', totalSessions: 20, avgAttendance: 80, totalNotes: 22, weeklyGoal: 5, actualWeeklyHours: 0 },
  ];
  return groups.map(g => ({ ...g, id: uid() }));
}

// ── Members ────────────────────────────────────────────────────────────────

function generateMembers(groups: StudyGroup[]): GroupMember[] {
  const members: GroupMember[] = [];
  for (const group of groups) {
    const count = Math.min(group.memberCount, 5);
    for (let i = 0; i < count; i++) {
      const role: MemberRole = i === 0 ? 'Owner' : i === 1 ? 'Admin' : 'Member';
      members.push({
        id: uid(), groupId: group.id, studentId: `STU-${rand(1000, 9999)}`,
        name: `${pick(FIRST)} ${pick(LAST)}`,
        email: `${pick(FIRST).toLowerCase()}@campus.edu`,
        role, joinedAt: `2026-${String(rand(5, 8)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
        sessionsAttended: rand(3, group.totalSessions),
        totalSessions: group.totalSessions,
        contributionScore: rand(40, 100), isActive: Math.random() > 0.2,
      });
    }
  }
  return members;
}

// ── Sessions ───────────────────────────────────────────────────────────────

function generateSessions(groups: StudyGroup[]): StudySession[] {
  const sessions: StudySession[] = [];
  const topics: Record<Subject, string[]> = {
    'Algorithms': ['Graph Algorithms', 'Dynamic Programming', 'Greedy Methods', 'Divide & Conquer'],
    'Data Structures': ['Binary Trees', 'Hash Maps', 'Graph Representations', 'Heap Operations'],
    'Linear Algebra': ['Eigenvalues', 'Matrix Decomposition', 'Vector Spaces'],
    'Calculus': ['Integration Techniques', 'Series Convergence', 'Partial Derivatives'],
    'Operating Systems': ['Process Scheduling', 'Memory Management', 'File Systems'],
    'Databases': ['SQL Joins', 'Index Optimization', 'Normalization'],
    'Machine Learning': ['Neural Networks', 'Decision Trees', 'SVM', 'Feature Engineering'],
    'Physics': ['Quantum States', 'Thermodynamic Laws', 'Wave Mechanics'],
    'Statistics': ['Hypothesis Testing', 'Regression Analysis', 'Bayesian Methods'],
    'Networking': ['TCP/IP Stack', 'Socket Programming', 'Network Security'],
    'Compiler Design': ['Lexical Analysis', 'Parsing', 'Code Generation'],
    'Economics': ['Market Equilibrium', 'Game Theory', 'Macro Indicators'],
  };
  const locations = ['Room 201', 'CS Lab 3', 'Library Study Room A', 'Online (Zoom)', 'Quad Lawn', 'Student Center'];

  for (const group of groups.filter(g => g.status === 'Active')) {
    for (let i = 0; i < Math.min(group.totalSessions, 5); i++) {
      const status: SessionStatus = i < 3 ? 'Completed' : i === 3 ? 'Scheduled' : 'Scheduled';
      sessions.push({
        id: uid(), groupId: group.id, groupName: group.name, subject: group.subject,
        title: `${pick(topics[group.subject] || ['Study Session'])} Session`,
        description: `Review and practice ${pick(topics[group.subject] || ['topics']).toLowerCase()}.`,
        status, date: `2026-${String(rand(8, 9)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
        startTime: `${rand(14, 18)}:00`, endTime: `${rand(16, 20)}:00`,
        location: pick(locations), isVirtual: Math.random() > 0.6,
        host: group.owner, attendees: status === 'Completed' ? rand(4, group.memberCount) : 0,
        expectedAttendees: group.memberCount,
        topicsCovered: [pick(topics[group.subject] || ['Review'])],
        rating: status === 'Completed' ? rand(3, 5) : undefined,
      });
    }
  }
  return sessions;
}

// ── Notes ──────────────────────────────────────────────────────────────────

function generateNotes(groups: StudyGroup[]): SharedNote[] {
  const notes: SharedNote[] = [];
  const noteTitles: Record<Subject, string[]> = {
    'Algorithms': ['Sorting Cheat Sheet', 'Graph Traversal Notes', 'DP Pattern Guide'],
    'Data Structures': ['Tree Traversal Methods', 'Hash Map Implementation', 'Heap Operations'],
    'Machine Learning': ['ML Pipeline Overview', 'Feature Engineering Guide', 'Model Comparison'],
    'Linear Algebra': ['Matrix Operations Reference', 'Eigenvalue Decomposition'],
  };
  for (const group of groups.slice(0, 6)) {
    for (let i = 0; i < rand(2, 4); i++) {
      notes.push({
        id: uid(), groupId: group.id, groupName: group.name,
        title: pick(noteTitles[group.subject] || ['Study Notes']),
        type: pick(['Lecture Notes', 'Problem Set', 'Flashcards', 'Summary', 'Past Exam'] as NoteType[]),
        subject: group.subject,
        uploadedBy: `${pick(FIRST)} ${pick(LAST)}`,
        uploadedAt: `2026-${String(rand(7, 8)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
        fileSize: `${rand(100, 5000)} KB`,
        downloads: rand(5, 50),
        rating: round1(3.5 + Math.random() * 1.5),
        tags: [group.subject.toLowerCase(), pick(['notes', 'problems', 'summary', 'cheatsheet'])],
      });
    }
  }
  return notes;
}

// ── Activity ───────────────────────────────────────────────────────────────

function generateActivity(groups: StudyGroup[]): GroupActivity[] {
  const activities: GroupActivity[] = [];
  const types: { type: GroupActivity['type']; icon: string }[] = [
    { type: 'session', icon: '📅' }, { type: 'note', icon: '📝' },
    { type: 'member', icon: '👤' }, { type: 'milestone', icon: '🏆' },
    { type: 'goal', icon: '🎯' },
  ];
  const descriptions = [
    'completed a study session', 'shared new notes', 'joined the group',
    'achieved 10 sessions milestone', 'reached weekly study goal',
    'hosted a practice quiz', 'uploaded past exam', 'recruited a new member',
  ];
  for (const group of groups.slice(0, 6)) {
    for (let i = 0; i < rand(3, 6); i++) {
      const t = pick(types);
      activities.push({
        id: uid(), groupId: group.id, groupName: group.name,
        type: t.type, icon: t.icon,
        description: `${pick(FIRST)} ${pick(LAST)} ${pick(descriptions)}`,
        timestamp: `2026-08-${String(rand(1, 24)).padStart(2, '0')}T${String(rand(8, 20)).padStart(2, '0')}:00Z`,
      });
    }
  }
  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ── Trends ─────────────────────────────────────────────────────────────────

function generateTrends(): CollaborationTrend[] {
  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  let groups = 18, sessions = 40, notes = 60, att = 72, members = 80;
  return months.map((month) => {
    groups = Math.max(12, Math.min(25, groups + rand(-2, 3)));
    sessions = Math.max(30, Math.min(60, sessions + rand(-4, 6)));
    notes = Math.max(40, Math.min(100, notes + rand(-5, 8)));
    att = Math.max(60, Math.min(90, att + rand(-3, 4)));
    members = Math.max(60, Math.min(130, members + rand(-3, 5)));
    return { month, totalGroups: groups, totalSessions: sessions, totalNotes: notes, avgAttendance: att, activeMembers: members };
  });
}

// ── Subject Stats ──────────────────────────────────────────────────────────

function generateSubjectStats(groups: StudyGroup[]): SubjectStats[] {
  const subjects: Subject[] = ['Algorithms', 'Data Structures', 'Linear Algebra', 'Calculus', 'Operating Systems', 'Databases', 'Machine Learning', 'Physics', 'Statistics', 'Networking'];
  return subjects.map(subject => {
    const subjGroups = groups.filter(g => g.subject === subject);
    return {
      subject, groupCount: subjGroups.length || rand(1, 3),
      totalMembers: subjGroups.reduce((s, g) => s + g.memberCount, 0) || rand(5, 15),
      avgAttendance: Math.round(subjGroups.reduce((s, g) => s + g.avgAttendance, 0) / Math.max(subjGroups.length, 1)) || rand(65, 90),
      totalNotes: subjGroups.reduce((s, g) => s + g.totalNotes, 0) || rand(5, 20),
      avgSessionRating: round1(3.5 + Math.random() * 1.5),
    };
  }).sort((a, b) => b.groupCount - a.groupCount);
}

// ── Insights ───────────────────────────────────────────────────────────────

function generateInsights(): StudyInsight[] {
  return [
    { id: uid(), title: 'ML Study Circle most active', description: '22 sessions held with 72 avg attendance. Highest note contribution (35 notes).', type: 'positive', metric: 'Sessions', value: '22', trend: 'up' },
    { id: uid(), title: 'Physics group paused', description: 'Physics Thinkers hasn\'t met in 3 weeks. Average attendance was low (65%).', type: 'warning', metric: 'Status', value: 'Paused', trend: 'down' },
    { id: uid(), title: 'DB Query Wizards recruiting', description: 'Only 5/10 members. Consider promoting in CS department channels.', type: 'info', metric: 'Capacity', value: '5/10', trend: 'stable' },
    { id: uid(), title: 'Note sharing up 40%', description: 'More students sharing notes this semester. Past exams are most downloaded.', type: 'positive', metric: 'Notes', value: '+40%', trend: 'up' },
    { id: uid(), title: 'Avg attendance at 80%', description: 'Overall attendance rate is healthy. Groups with owners > 85% attendance do best.', type: 'positive', metric: 'Attendance', value: '80%', trend: 'up' },
    { id: uid(), title: 'Weekend sessions underperform', description: 'Saturday sessions have 55% attendance vs 83% on weekdays.', type: 'warning', metric: 'Weekend Attendance', value: '55%', trend: 'down' },
  ];
}

// ── Dashboard Aggregator ───────────────────────────────────────────────────

export function getStudyGroupData() {
  const groups = generateGroups();
  const members = generateMembers(groups);
  const sessions = generateSessions(groups);
  const notes = generateNotes(groups);
  const activity = generateActivity(groups);
  const trends = generateTrends();
  const subjectStats = generateSubjectStats(groups);
  const insights = generateInsights();

  const summary: StudyGroupSummary = {
    totalGroups: groups.length,
    activeGroups: groups.filter(g => g.status === 'Active').length,
    recruitingGroups: groups.filter(g => g.status === 'Recruiting').length,
    totalMembers: groups.reduce((s, g) => s + g.memberCount, 0),
    totalSessions: groups.reduce((s, g) => s + g.totalSessions, 0),
    totalNotes: groups.reduce((s, g) => s + g.totalNotes, 0),
    avgAttendance: Math.round(groups.filter(g => g.status === 'Active').reduce((s, g) => s + g.avgAttendance, 0) / Math.max(groups.filter(g => g.status === 'Active').length, 1)),
    avgSessionRating: round1(sessions.filter(s => s.rating).reduce((s, se) => s + (se.rating || 0), 0) / Math.max(sessions.filter(s => s.rating).length, 1)),
    topSubject: 'Algorithms' as Subject,
    completionRate: Math.round(groups.filter(g => g.status === 'Completed').length / groups.length * 100),
  };

  return { groups, members, sessions, notes, activity, trends, subjectStats, insights, summary };
}
