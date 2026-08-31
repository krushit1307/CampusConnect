/**
 * Campus Event Calendar — Service Layer
 *
 * Mock events, RSVPs, venue bookings, trends, club activity, and insights.
 */

import {
  CampusEvent, EventRSVP, VenueBooking, EventTrend,
  ClubActivity, EventInsight, EventSummary,
  EventCategory, EventStatus, RSVPStatus, VenueType, RecurringPattern,
} from './eventCalendarTypes';

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const round1 = (n: number) => Math.round(n * 10) / 10;
const uid = () => Math.random().toString(36).substring(2, 10);

const FIRST = ['Aisha','Brent','Carmen','David','Elena','Faisal','Grace','Hiroshi','Ines','James','Kavita','Liam','Mei','Nadia','Oscar','Priya','Quinn','Ravi','Sofia','Tariq','Uma','Victor','Wendy','Xavier','Yuki','Zara'];
const LAST = ['Patel','Kim','Mueller','Santos','Nakamura','Okafor','Silva','Singh','Johansson','Tanaka','Chen','Rodriguez','Ali','Nguyen','Kowalski','Ibrahim','Kapoor','Olsen','Sato','Garcia','Das','Brown','Lee'];
const CLUBS = ['CS Club', 'Robotics', 'Debate Society', 'Music Ensemble', 'Photography Club', 'AI Research', 'Entrepreneurship Cell', 'Literary Society', 'Dance Crew', 'Environmental Club'];
const VENUES = ['Main Auditorium', 'Room 201', 'Quad Lawn', 'CS Lab 3', 'Gymnasium', 'Student Center', 'Library Hall', 'Online (Zoom)', 'Cafeteria', 'Rooftop Garden'];
const TAGS = ['free', 'food', 'certificates', 'networking', 'beginners', 'advanced', 'team', 'solo', 'prizes', 'credits'];

// ── Events ─────────────────────────────────────────────────────────────────

function generateEvents(): CampusEvent[] {
  const events: Omit<CampusEvent, 'id'>[] = [
    { title: 'Hackathon 2026: Build the Future', description: '48-hour hackathon with $5K in prizes. Build innovative solutions for campus problems.', category: 'Workshop', status: 'Upcoming', date: '2026-09-15', startTime: '09:00', endTime: '09:00', venue: 'Main Auditorium', venueType: 'Auditorium', organizer: 'CS Club', organizerClub: 'CS Club', maxCapacity: 200, currentRSVPs: 165, waitlistCount: 23, recurring: 'None', tags: ['prizes', 'team', 'food'], isFeatured: true, contactEmail: 'csclub@campus.edu' },
    { title: 'Career Fair — Fall 2026', description: 'Meet recruiters from 50+ companies. Bring your resume and dress professionally.', category: 'Career Fair', status: 'Upcoming', date: '2026-09-20', startTime: '10:00', endTime: '16:00', venue: 'Gymnasium', venueType: 'Gym', organizer: 'Career Services', maxCapacity: 500, currentRSVPs: 420, waitlistCount: 0, recurring: 'Semester', tags: ['networking', 'career', 'resumes'], isFeatured: true, contactEmail: 'career@campus.edu' },
    { title: 'Guest Lecture: AI Ethics', description: 'Prof. Sarah Chen from MIT discusses responsible AI development and deployment.', category: 'Academic', status: 'Upcoming', date: '2026-09-10', startTime: '14:00', endTime: '16:00', venue: 'Room 201', venueType: 'Classroom', organizer: 'AI Research', organizerClub: 'AI Research', maxCapacity: 80, currentRSVPs: 67, waitlistCount: 5, recurring: 'None', tags: ['AI', 'ethics', 'lecture'], isFeatured: false, contactEmail: 'airesearch@campus.edu' },
    { title: 'Intramural Soccer Tournament', description: 'Inter-department soccer tournament. Form teams of 11 players.', category: 'Sports', status: 'Upcoming', date: '2026-09-05', startTime: '16:00', endTime: '20:00', venue: 'Quad Lawn', venueType: 'Outdoor', organizer: 'Sports Committee', maxCapacity: 120, currentRSVPs: 96, waitlistCount: 0, recurring: 'Monthly', tags: ['team', 'outdoor', 'fitness'], isFeatured: false, contactEmail: 'sports@campus.edu' },
    { title: 'Music Night: Open Mic', description: 'Bring your guitar, voice, or just your ears. All genres welcome!', category: 'Cultural', status: 'Upcoming', date: '2026-09-12', startTime: '18:00', endTime: '21:00', venue: 'Student Center', venueType: 'Cafeteria', organizer: 'Music Ensemble', organizerClub: 'Music Ensemble', maxCapacity: 60, currentRSVPs: 45, waitlistCount: 0, recurring: 'Bi-Weekly', tags: ['music', 'open mic', 'free'], isFeatured: false, contactEmail: 'music@campus.edu' },
    { title: 'Startup Pitch Competition', description: 'Present your startup idea to VCs and industry mentors. Top 3 get incubation support.', category: 'Workshop', status: 'Upcoming', date: '2026-09-25', startTime: '13:00', endTime: '17:00', venue: 'Main Auditorium', venueType: 'Auditorium', organizer: 'Entrepreneurship Cell', organizerClub: 'Entrepreneurship Cell', maxCapacity: 150, currentRSVPs: 110, waitlistCount: 15, recurring: 'None', tags: ['startup', 'pitch', 'networking', 'prizes'], isFeatured: true, contactEmail: 'ecell@campus.edu' },
    { title: 'Photography Walk', description: 'Explore campus with your camera. Theme: Urban Nature. Best photo wins a lens.', category: 'Club Meeting', status: 'Upcoming', date: '2026-09-08', startTime: '07:00', endTime: '10:00', venue: 'Quad Lawn', venueType: 'Outdoor', organizer: 'Photography Club', organizerClub: 'Photography Club', maxCapacity: 30, currentRSVPs: 28, waitlistCount: 4, recurring: 'Weekly', tags: ['photography', 'outdoor', 'prizes'], isFeatured: false, contactEmail: 'photo@campus.edu' },
    { title: 'Debate Championship', description: 'Annual inter-college debate championship. Topics: Climate Policy, AI Regulation.', category: 'Academic', status: 'Upcoming', date: '2026-09-18', startTime: '10:00', endTime: '18:00', venue: 'Library Hall', venueType: 'Auditorium', organizer: 'Debate Society', organizerClub: 'Debate Society', maxCapacity: 100, currentRSVPs: 78, waitlistCount: 10, recurring: 'Semester', tags: ['debate', 'competition', 'certificates'], isFeatured: false, contactEmail: 'debate@campus.edu' },
    { title: 'Community Cleanup Drive', description: 'Volunteer to clean up the campus and surrounding neighborhood. Refreshments provided.', category: 'Volunteer', status: 'Completed', date: '2026-08-20', startTime: '08:00', endTime: '12:00', venue: 'Quad Lawn', venueType: 'Outdoor', organizer: 'Environmental Club', organizerClub: 'Environmental Club', maxCapacity: 80, currentRSVPs: 72, waitlistCount: 0, recurring: 'Monthly', tags: ['volunteer', 'outdoor', 'food'], isFeatured: false, contactEmail: 'envclub@campus.edu' },
    { title: 'Yoga & Meditation Session', description: 'Start your week with mindfulness. All levels welcome. Mats provided.', category: 'Sports', status: 'Completed', date: '2026-08-25', startTime: '07:00', endTime: '08:00', venue: 'Rooftop Garden', venueType: 'Outdoor', organizer: 'Wellness Committee', maxCapacity: 40, currentRSVPs: 35, waitlistCount: 0, recurring: 'Weekly', tags: ['yoga', 'wellness', 'free'], isFeatured: false, contactEmail: 'wellness@campus.edu' },
    { title: 'Resume Building Workshop', description: 'Learn to craft a winning resume. Bring your laptop. Templates provided.', category: 'Workshop', status: 'Completed', date: '2026-08-15', startTime: '14:00', endTime: '16:00', venue: 'CS Lab 3', venueType: 'Lab', organizer: 'Career Services', maxCapacity: 40, currentRSVPs: 38, waitlistCount: 2, recurring: 'Monthly', tags: ['career', 'resume', 'certificates'], isFeatured: false, contactEmail: 'career@campus.edu' },
    { title: 'Cultural Fest: Diwali Celebration', description: 'Celebrate Diwali with performances, food stalls, rangoli competition, and fireworks.', category: 'Cultural', status: 'Upcoming', date: '2026-10-20', startTime: '17:00', endTime: '22:00', venue: 'Main Auditorium', venueType: 'Auditorium', organizer: 'Cultural Committee', maxCapacity: 300, currentRSVPs: 245, waitlistCount: 30, recurring: 'None', tags: ['cultural', 'food', 'performances', 'free'], isFeatured: true, contactEmail: 'cultural@campus.edu' },
    { title: 'Blockchain Workshop', description: 'Hands-on workshop: Build a DApp from scratch. Prerequisites: basic JS.', category: 'Workshop', status: 'Cancelled', date: '2026-09-01', startTime: '10:00', endTime: '14:00', venue: 'CS Lab 3', venueType: 'Lab', organizer: 'CS Club', organizerClub: 'CS Club', maxCapacity: 30, currentRSVPs: 22, waitlistCount: 0, recurring: 'None', tags: ['blockchain', 'advanced', 'hands-on'], isFeatured: false, contactEmail: 'csclub@campus.edu' },
  ];
  return events.map(e => ({ ...e, id: uid() }));
}

// ── RSVPs ──────────────────────────────────────────────────────────────────

function generateRSVPs(events: CampusEvent[]): EventRSVP[] {
  const rsvps: EventRSVP[] = [];
  const statuses: RSVPStatus[] = ['Going', 'Maybe', 'Not Going', 'Waitlisted'];
  for (const event of events.slice(0, 8)) {
    for (let i = 0; i < rand(5, 12); i++) {
      const status = pick(statuses);
      rsvps.push({
        id: uid(), eventId: event.id, eventTitle: event.title,
        studentId: `STU-${rand(1000, 9999)}`,
        studentName: `${pick(FIRST)} ${pick(LAST)}`,
        studentEmail: `${pick(FIRST).toLowerCase()}@campus.edu`,
        status, checkedIn: status === 'Going' && Math.random() > 0.3,
        rsvpedAt: `2026-08-${String(rand(1, 28)).padStart(2, '0')}`,
        feedback: status === 'Going' && Math.random() > 0.6 ? pick(['Great event!', 'Looking forward to it', 'Can\'t wait!', 'Amazing organizer']) : undefined,
        rating: status === 'Going' && Math.random() > 0.5 ? rand(3, 5) : undefined,
      });
    }
  }
  return rsvps;
}

// ── Venue Bookings ─────────────────────────────────────────────────────────

function generateVenueBookings(): VenueBooking[] {
  const equipment = ['Projector', 'Microphone', 'Whiteboard', 'Speakers', 'WiFi', 'Power Strips', 'Stage Lighting'];
  return VENUES.map((venue, i) => ({
    id: uid(), venue, venueType: pick(['Auditorium', 'Classroom', 'Outdoor', 'Lab', 'Gym', 'Cafeteria'] as VenueType[]),
    eventId: uid(), eventTitle: `${pick(['Workshop', 'Lecture', 'Meeting', 'Event'])} in ${venue}`,
    date: `2026-09-${String(rand(1, 28)).padStart(2, '0')}`,
    startTime: `${rand(8, 16)}:00`, endTime: `${rand(14, 21)}:00`,
    isAvailable: Math.random() > 0.4, bookedBy: pick(CLUBS),
    capacity: rand(30, 300),
    equipment: equipment.slice(0, rand(2, 5)),
  }));
}

// ── Trends ─────────────────────────────────────────────────────────────────

function generateTrends(): EventTrend[] {
  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  let events = 25, attendees = 400;
  return months.map((month) => {
    events = Math.max(15, Math.min(45, events + rand(-3, 5)));
    attendees = Math.max(300, Math.min(700, attendees + rand(-40, 60)));
    return {
      month, totalEvents: events, totalAttendees: attendees,
      avgAttendance: Math.round(attendees / events),
      topCategory: pick(['Workshop', 'Social', 'Academic', 'Cultural'] as EventCategory[]),
      newClubs: rand(0, 3), repeatAttendees: Math.round(attendees * (0.3 + Math.random() * 0.3)),
    };
  });
}

// ── Club Activity ──────────────────────────────────────────────────────────

function generateClubActivity(): ClubActivity[] {
  return CLUBS.map(club => ({
    clubName: club,
    totalEvents: rand(3, 12),
    totalAttendees: rand(100, 600),
    avgRating: round1(3.5 + Math.random() * 1.5),
    upcomingEvents: rand(1, 5),
    memberCount: rand(20, 120),
    topCategory: pick(['Workshop', 'Social', 'Academic', 'Cultural', 'Sports'] as EventCategory[]),
    engagementScore: rand(45, 95),
  })).sort((a, b) => b.engagementScore - a.engagementScore);
}

// ── Insights ───────────────────────────────────────────────────────────────

function generateInsights(): EventInsight[] {
  return [
    { id: uid(), title: 'Hackathon 2026 almost full', description: '82% capacity reached with 3 weeks to go. Consider promoting to reach full capacity.', type: 'warning', metric: 'Capacity', value: '82%', trend: 'up' },
    { id: uid(), title: 'Workshop attendance up 35%', description: 'Workshops are the most popular category this semester. 35% increase from last semester.', type: 'positive', metric: 'Attendance', value: '+35%', trend: 'up' },
    { id: uid(), title: 'Career Fair at 84% capacity', description: '420 of 500 spots filled. Heavy demand from CS and Business students.', type: 'positive', metric: 'RSVPs', value: '420/500', trend: 'up' },
    { id: uid(), title: 'Blockchain Workshop cancelled', description: 'Low enrollment (22/30). Consider combining with another workshop next time.', type: 'info', metric: 'Cancellation', value: '1', trend: 'stable' },
    { id: uid(), title: 'CS Club leads engagement', description: 'Highest engagement score (92) among all clubs. 12 events this semester.', type: 'positive', metric: 'Club Score', value: '92/100', trend: 'up' },
    { id: uid(), title: 'Weekend events underperforming', description: 'Saturday/Sunday events average 45% attendance vs 78% on weekdays.', type: 'warning', metric: 'Weekend Attendance', value: '45%', trend: 'down' },
  ];
}

// ── Dashboard Aggregator ───────────────────────────────────────────────────

export function getEventCalendarData() {
  const events = generateEvents();
  const rsvps = generateRSVPs(events);
  const venueBookings = generateVenueBookings();
  const trends = generateTrends();
  const clubActivity = generateClubActivity();
  const insights = generateInsights();

  const summary: EventSummary = {
    totalEvents: events.length,
    upcomingEvents: events.filter(e => e.status === 'Upcoming').length,
    liveEvents: events.filter(e => e.status === 'Live').length,
    completedEvents: events.filter(e => e.status === 'Completed').length,
    totalRSVPs: events.reduce((s, e) => s + e.currentRSVPs, 0),
    avgAttendanceRate: Math.round(events.reduce((s, e) => s + (e.currentRSVPs / e.maxCapacity) * 100, 0) / events.length),
    totalVenues: venueBookings.length,
    totalClubs: clubActivity.length,
    avgRating: round1(clubActivity.reduce((s, c) => s + c.avgRating, 0) / clubActivity.length),
    capacityUtilization: Math.round(events.reduce((s, e) => s + e.currentRSVPs, 0) / events.reduce((s, e) => s + e.maxCapacity, 0) * 100),
    topCategory: 'Workshop' as EventCategory,
    totalAttendees: trends[trends.length - 1].totalAttendees,
  };

  return { events, rsvps, venueBookings, trends, clubActivity, insights, summary };
}
