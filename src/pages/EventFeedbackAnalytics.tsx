import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';

/* ─────────────────────── TYPES ─────────────────────── */
interface EventFeedback {
  id: number;
  eventName: string;
  eventDate: string;
  category: string;
  organizer: string;
  totalResponses: number;
  avgRating: number;
  wouldRecommend: number;
  sentiment: { positive: number; neutral: number; negative: number };
  categories: { [key: string]: number };
  highlights: string[];
  improvements: string[];
  feedbackEntries: { rating: number; comment: string; sentiment: string; date: string; anonymous: boolean }[];
}

/* ─────────────────────── MOCK DATA ─────────────────────── */
const EVENTS: EventFeedback[] = [
  {
    id: 1, eventName: 'Annual Tech Summit 2026', eventDate: '2026-08-15', category: 'Technology', organizer: 'CS Department',
    totalResponses: 185, avgRating: 4.6, wouldRecommend: 92,
    sentiment: { positive: 156, neutral: 22, negative: 7 },
    categories: { 'Content Quality': 4.7, 'Speaker Expertise': 4.8, 'Venue': 4.2, 'Organization': 4.5, 'Networking': 4.3, 'Value': 4.6 },
    highlights: ['Excellent keynote speakers', 'Great networking opportunities', 'Hands-on workshops were amazing', 'Well-organized schedule'],
    improvements: ['More vegetarian food options', 'Better Wi-Fi in workshop rooms', 'Need larger auditorium for keynote'],
    feedbackEntries: [
      { rating: 5, comment: 'Amazing event! The AI workshop was mind-blowing. Best tech event I have attended.', sentiment: 'positive', date: '2026-08-15', anonymous: false },
      { rating: 4, comment: 'Good overall but the Wi-Fi was spotty during the cloud computing session.', sentiment: 'positive', date: '2026-08-15', anonymous: true },
      { rating: 3, comment: 'Content was great but venue was too crowded. Need bigger space next year.', sentiment: 'neutral', date: '2026-08-16', anonymous: false },
      { rating: 5, comment: 'The networking dinner was incredible! Met my future co-founder there.', sentiment: 'positive', date: '2026-08-16', anonymous: false },
      { rating: 2, comment: 'Too many parallel sessions. Had to miss several talks I wanted to attend.', sentiment: 'negative', date: '2026-08-16', anonymous: true },
    ],
  },
  {
    id: 2, eventName: 'Cultural Night Fiesta', eventDate: '2026-08-20', category: 'Cultural', organizer: 'Cultural Committee',
    totalResponses: 220, avgRating: 4.8, wouldRecommend: 96,
    sentiment: { positive: 201, neutral: 15, negative: 4 },
    categories: { 'Entertainment': 4.9, 'Diversity': 4.8, 'Venue': 4.6, 'Organization': 4.7, 'Food': 4.5, 'Atmosphere': 4.9 },
    highlights: ['Incredible dance performances', 'Beautiful cultural diversity showcase', 'Amazing food stalls from 12 countries', 'Live music was phenomenal'],
    improvements: ['More seating available', 'Earlier start time for families', 'Better parking management'],
    feedbackEntries: [
      { rating: 5, comment: 'Best cultural night ever! The Korean and Indian performances were outstanding.', sentiment: 'positive', date: '2026-08-20', anonymous: false },
      { rating: 5, comment: 'My family loved it! The kids activities were a great addition.', sentiment: 'positive', date: '2026-08-20', anonymous: false },
      { rating: 4, comment: 'Great event but ran out of seats by 7 PM. Need more chairs.', sentiment: 'positive', date: '2026-08-21', anonymous: true },
      { rating: 5, comment: 'The food was amazing! Tried dishes from 5 different countries.', sentiment: 'positive', date: '2026-08-21', anonymous: false },
    ],
  },
  {
    id: 3, eventName: 'Career Fair & Job Expo', eventDate: '2026-08-22', category: 'Career', organizer: 'Placement Cell',
    totalResponses: 310, avgRating: 4.1, wouldRecommend: 78,
    sentiment: { positive: 215, neutral: 62, negative: 33 },
    categories: { 'Company Variety': 4.3, 'Job Opportunities': 4.0, 'Organization': 3.8, 'Resume Review': 4.2, 'Mock Interviews': 4.4, 'Venue': 3.9 },
    highlights: ['50+ companies participated', 'Mock interviews were very helpful', 'Resume review sessions were excellent', 'Good mix of startups and MNCs'],
    improvements: ['Better crowd management', 'More company booths', 'Longer event duration needed', 'Pre-event company list should be shared earlier'],
    feedbackEntries: [
      { rating: 4, comment: 'Got 3 interview calls! Great opportunity but very crowded.', sentiment: 'positive', date: '2026-08-22', anonymous: false },
      { rating: 3, comment: 'Waited 45 minutes for one company booth. Need better queue management.', sentiment: 'neutral', date: '2026-08-22', anonymous: true },
      { rating: 2, comment: 'Many companies listed on the website were not present at the fair.', sentiment: 'negative', date: '2026-08-23', anonymous: true },
      { rating: 5, comment: 'Mock interview with Google engineer was the highlight. So helpful!', sentiment: 'positive', date: '2026-08-23', anonymous: false },
    ],
  },
  {
    id: 4, eventName: 'Freshman Welcome Week', eventDate: '2026-08-10', category: 'Social', organizer: 'Student Council',
    totalResponses: 280, avgRating: 4.4, wouldRecommend: 88,
    sentiment: { positive: 230, neutral: 38, negative: 12 },
    categories: { 'Fun Activities': 4.6, 'Orientation Info': 4.3, 'Peer Mentoring': 4.5, 'Campus Tour': 4.2, 'Ice Breakers': 4.7, 'Swag': 4.1 },
    highlights: ['Ice breaker games were so fun', 'Great peer mentoring program', 'Campus tour was informative', 'Free swag was a nice touch'],
    improvements: ['More time for campus tour', 'Better organized registration process', 'Need more shaded areas for outdoor activities'],
    feedbackEntries: [
      { rating: 5, comment: 'Made so many friends during welcome week! The ice breakers were genius.', sentiment: 'positive', date: '2026-08-10', anonymous: false },
      { rating: 4, comment: 'Good orientation but the registration was chaotic. Need better system.', sentiment: 'positive', date: '2026-08-10', anonymous: false },
      { rating: 4, comment: 'The campus tour was great but too hot. Need more water stations.', sentiment: 'positive', date: '2026-08-11', anonymous: true },
      { rating: 3, comment: 'Some sessions were too long and boring. Need more interactive content.', sentiment: 'neutral', date: '2026-08-11', anonymous: true },
    ],
  },
  {
    id: 5, eventName: 'HackFusion 2026', eventDate: '2026-08-25', category: 'Technology', organizer: 'Coding Club',
    totalResponses: 142, avgRating: 4.7, wouldRecommend: 94,
    sentiment: { positive: 128, neutral: 11, negative: 3 },
    categories: { 'Challenge Quality': 4.8, 'Mentorship': 4.6, 'Prizes': 4.5, 'Food & Snacks': 4.3, 'Venue Comfort': 4.4, 'Sponsors': 4.7 },
    highlights: ['Amazing problem statements', 'Incredible mentors from FAANG', 'Great prize pool', 'Non-stop food and energy drinks'],
    improvements: ['More power outlets', 'Better air conditioning', 'Earlier announcement of themes'],
    feedbackEntries: [
      { rating: 5, comment: 'Best hackathon ever! Our team won 2nd place. The mentors were incredibly helpful.', sentiment: 'positive', date: '2026-08-25', anonymous: false },
      { rating: 5, comment: '36 hours of pure coding bliss. The challenge problems were perfectly scoped.', sentiment: 'positive', date: '2026-08-26', anonymous: false },
      { rating: 4, comment: 'Great event but need more power strips. Had to share outlets with 4 people.', sentiment: 'positive', date: '2026-08-26', anonymous: true },
      { rating: 4, comment: 'The judging criteria could have been clearer from the start.', sentiment: 'positive', date: '2026-08-26', anonymous: true },
    ],
  },
];

const CATEGORIES = ['All', 'Technology', 'Cultural', 'Career', 'Social'];
const SENTIMENT_COLORS = { positive: '#22c55e', neutral: '#3b82f6', negative: '#ef4444' };

/* ─────────────────────── SVG COMPONENTS ─────────────────────── */
function RatingRing({ value, max = 5, size = 80 }) {
  const pct = (value / max) * 100;
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = value >= 4.5 ? '#22c55e' : value >= 3.5 ? '#3b82f6' : value >= 2.5 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#374151" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="16" fontWeight="bold" className="transform rotate-90" style={{ transformOrigin: 'center' }}>{value}</text>
    </svg>
  );
}

function SentimentBar({ sentiment, total }: { sentiment: { positive: number; neutral: number; negative: number }; total: number }) {
  const pPct = (sentiment.positive / total) * 100;
  const nPct = (sentiment.neutral / total) * 100;
  const negPct = (sentiment.negative / total) * 100;
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-2.5">
        <div style={{ width: `${pPct}%`, backgroundColor: SENTIMENT_COLORS.positive }} />
        <div style={{ width: `${nPct}%`, backgroundColor: SENTIMENT_COLORS.neutral }} />
        <div style={{ width: `${negPct}%`, backgroundColor: SENTIMENT_COLORS.negative }} />
      </div>
      <div className="flex justify-between text-[9px] mt-1 text-gray-500">
        <span>😊 {Math.round(pPct)}%</span>
        <span>😐 {Math.round(nPct)}%</span>
        <span>😟 {Math.round(negPct)}%</span>
      </div>
    </div>
  );
}

function CategoryRadar({ categories }: { categories: { [key: string]: number } }) {
  const keys = Object.keys(categories);
  const values = Object.values(categories);
  const maxVal = 5;
  const centerX = 120;
  const centerY = 100;
  const radius = 70;
  const angleStep = (2 * Math.PI) / keys.length;

  const points = values.map((v, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (v / maxVal) * radius;
    return `${centerX + r * Math.cos(angle)},${centerY + r * Math.sin(angle)}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 240 200" className="w-full" style={{ height: '200px' }}>
      {[1, 2, 3, 4, 5].map(level => (
        <polygon key={level} points={keys.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const r = (level / maxVal) * radius;
          return `${centerX + r * Math.cos(angle)},${centerY + r * Math.sin(angle)}`;
        }).join(' ')} fill="none" stroke="#374151" strokeWidth="0.5" />
      ))}
      <polygon points={points} fill="#a855f7" fillOpacity="0.2" stroke="#a855f7" strokeWidth="2" />
      {keys.map((key, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const labelR = radius + 18;
        return (
          <text key={key} x={centerX + labelR * Math.cos(angle)} y={centerY + labelR * Math.sin(angle)} textAnchor="middle" dominantBaseline="middle" fill="#9ca3af" fontSize="7">{key}</text>
        );
      })}
      {values.map((v, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const r = (v / maxVal) * radius;
        return <circle key={i} cx={centerX + r * Math.cos(angle)} cy={centerY + r * Math.sin(angle)} r="3" fill="#a855f7" />;
      })}
    </svg>
  );
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <span key={star} className={`${star <= rating ? 'text-amber-400' : 'text-gray-600'}`} style={{ fontSize: `${size}px` }}>★</span>
      ))}
    </div>
  );
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function EventFeedbackAnalytics() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState<EventFeedback | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState('all');

  const filteredEvents = useMemo(() =>
    selectedCategory === 'All' ? EVENTS : EVENTS.filter(e => e.category === selectedCategory),
    [selectedCategory]
  );

  const stats = useMemo(() => ({
    totalResponses: EVENTS.reduce((s, e) => s + e.totalResponses, 0),
    avgRating: (EVENTS.reduce((s, e) => s + e.avgRating, 0) / EVENTS.length).toFixed(1),
    avgRecommend: Math.round(EVENTS.reduce((s, e) => s + e.wouldRecommend, 0) / EVENTS.length),
    totalEvents: EVENTS.length,
    positiveSentiment: EVENTS.reduce((s, e) => s + e.sentiment.positive, 0),
    negativeSentiment: EVENTS.reduce((s, e) => s + e.sentiment.negative, 0),
  }), []);

  const filteredFeedback = useMemo(() => {
    if (!selectedEvent) return [];
    if (sentimentFilter === 'all') return selectedEvent.feedbackEntries;
    return selectedEvent.feedbackEntries.filter(f => f.sentiment === sentimentFilter);
  }, [selectedEvent, sentimentFilter]);

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'events', label: '🎪 Events' },
    { id: 'feedback', label: '💬 Feedback' },
  ];

  return (
    <>
      <Helmet><title>Event Feedback Analytics — CampusConnect</title></Helmet>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4 md:p-8 space-y-6 max-w-6xl mx-auto">

        <div>
          <span className="text-xs font-mono font-bold uppercase text-purple-400">.campus analytics</span>
          <h1 className="text-2xl md:text-3xl font-black mt-1">📊 Event Feedback Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Analyze feedback from {stats.totalEvents} events with {stats.totalResponses.toLocaleString()} responses across {CATEGORIES.length - 1} categories</p>
        </div>

        {/* QUICK STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
            <div className="text-2xl font-black text-purple-500">{stats.totalResponses.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Total Responses</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
            <div className="text-2xl font-black text-amber-500">⭐ {stats.avgRating}</div>
            <div className="text-xs text-gray-500">Avg Rating</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
            <div className="text-2xl font-black text-emerald-500">{stats.avgRecommend}%</div>
            <div className="text-xs text-gray-500">Would Recommend</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
            <div className="text-2xl font-black text-blue-500">{stats.totalEvents}</div>
            <div className="text-xs text-gray-500">Events Analyzed</div>
          </div>
        </div>

        {/* TAB NAV */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-800 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════ OVERVIEW TAB ═══════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* SENTIMENT OVERVIEW */}
            <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-bold mb-3">😊 Overall Sentiment</h3>
              <SentimentBar sentiment={{ positive: stats.positiveSentiment, neutral: EVENTS.reduce((s, e) => s + e.sentiment.neutral, 0), negative: stats.negativeSentiment }} total={stats.totalResponses} />
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="text-center p-2 bg-emerald-500/10 rounded-xl">
                  <div className="text-lg font-bold text-emerald-400">{stats.positiveSentiment}</div>
                  <div className="text-[10px] text-gray-500">😊 Positive</div>
                </div>
                <div className="text-center p-2 bg-blue-500/10 rounded-xl">
                  <div className="text-lg font-bold text-blue-400">{EVENTS.reduce((s, e) => s + e.sentiment.neutral, 0)}</div>
                  <div className="text-[10px] text-gray-500">😐 Neutral</div>
                </div>
                <div className="text-center p-2 bg-red-500/10 rounded-xl">
                  <div className="text-lg font-bold text-red-400">{stats.negativeSentiment}</div>
                  <div className="text-[10px] text-gray-500">😟 Negative</div>
                </div>
              </div>
            </div>

            {/* TOP EVENTS */}
            <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-bold mb-3">🏆 Top Rated Events</h3>
              <div className="space-y-2">
                {[...EVENTS].sort((a, b) => b.avgRating - a.avgRating).map((ev, i) => (
                  <div key={ev.id} className="flex items-center gap-3 p-3 bg-gray-200 dark:bg-gray-800 rounded-xl">
                    <span className="text-lg font-bold text-gray-400 w-6">#{i + 1}</span>
                    <div className="flex-1">
                      <div className="text-xs font-bold">{ev.eventName}</div>
                      <div className="text-[10px] text-gray-500">{ev.category} · {ev.totalResponses} responses</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating rating={Math.round(ev.avgRating)} />
                      <span className="text-sm font-bold text-amber-400">{ev.avgRating}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CATEGORY BREAKDOWN */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CATEGORIES.filter(c => c !== 'All').map(cat => {
                const catEvents = EVENTS.filter(e => e.category === cat);
                const avgRat = (catEvents.reduce((s, e) => s + e.avgRating, 0) / catEvents.length).toFixed(1);
                return (
                  <button key={cat} onClick={() => { setSelectedCategory(cat); setActiveTab('events'); }}
                    className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center hover:border-purple-500/50 transition">
                    <div className="text-xs font-bold">{cat}</div>
                    <div className="text-xl font-black text-purple-400 mt-1">{catEvents.length}</div>
                    <div className="text-[10px] text-gray-500">events · ⭐ {avgRat}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════ EVENTS TAB ═══════════ */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${selectedCategory === cat ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'}`}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              {filteredEvents.map(ev => (
                <div key={ev.id} className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-[10px] text-purple-400 uppercase font-bold">{ev.category} · {ev.organizer}</div>
                      <h3 className="text-sm font-bold mt-1">{ev.eventName}</h3>
                      <div className="text-[10px] text-gray-500 mt-0.5">📅 {ev.eventDate} · 👥 {ev.totalResponses} responses</div>
                    </div>
                    <RatingRing value={ev.avgRating} size={70} />
                  </div>
                  <SentimentBar sentiment={ev.sentiment} total={ev.totalResponses} />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                    {Object.entries(ev.categories).map(([cat, val]) => (
                      <div key={cat} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-500">{cat}</span>
                          <span className="font-bold text-purple-400">{val}</span>
                        </div>
                        <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${(val / 5) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { setSelectedEvent(ev); setActiveTab('feedback'); }}
                      className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition">View Feedback →</button>
                    <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold">👍 {ev.wouldRecommend}% recommend</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ FEEDBACK TAB ═══════════ */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            {selectedEvent ? (
              <>
                <button onClick={() => setActiveTab('events')} className="text-sm text-purple-400 hover:text-purple-300">← Back to Events</button>
                <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <h3 className="text-sm font-bold">{selectedEvent.eventName} — Feedback</h3>
                  <div className="flex gap-2 mt-3">
                    {['all', 'positive', 'neutral', 'negative'].map(s => (
                      <button key={s} onClick={() => setSentimentFilter(s)}
                        className={`px-3 py-1 rounded-full text-[10px] font-semibold transition ${sentimentFilter === s ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-400'}`}>
                        {s === 'all' ? 'All' : s === 'positive' ? '😊 Positive' : s === 'neutral' ? '😐 Neutral' : '😟 Negative'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                    <h4 className="text-xs font-bold mb-2 text-emerald-400">✨ Highlights</h4>
                    <div className="space-y-1">
                      {selectedEvent.highlights.map((h, i) => (
                        <div key={i} className="text-xs text-gray-300 p-2 bg-emerald-500/10 rounded-lg">✓ {h}</div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                    <h4 className="text-xs font-bold mb-2 text-amber-400">🔧 Improvements</h4>
                    <div className="space-y-1">
                      {selectedEvent.improvements.map((imp, i) => (
                        <div key={i} className="text-xs text-gray-300 p-2 bg-amber-500/10 rounded-lg">⚠ {imp}</div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {filteredFeedback.map((f, i) => (
                    <div key={i} className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <StarRating rating={f.rating} size={12} />
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-400' : f.sentiment === 'neutral' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                            {f.sentiment === 'positive' ? '😊' : f.sentiment === 'neutral' ? '😐' : '😟'} {f.sentiment}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500">{f.date} · {f.anonymous ? 'Anonymous' : 'Named'}</span>
                      </div>
                      <p className="text-xs text-gray-300 italic">"{f.comment}"</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">💬</div>
                <p className="text-sm font-bold">Select an event to view detailed feedback</p>
                <p className="text-xs text-gray-400 mt-1">Go to Events tab and click "View Feedback"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
