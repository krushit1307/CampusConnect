import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';

/* ─────────────────────── TYPES ─────────────────────── */
interface Shuttle {
  id: number;
  name: string;
  route: string;
  status: 'active' | 'delayed' | 'offline';
  capacity: number;
  riders: number;
  nextStop: string;
  eta: number;
  speed: number;
  driver: string;
  color: string;
  stops: { name: string; time: string; x: number; y: number; riders: number }[];
}

interface ShuttleStop {
  id: number;
  name: string;
  x: number;
  y: number;
  facilities: string[];
}

/* ─────────────────────── MOCK DATA ─────────────────────── */
const STOPS: ShuttleStop[] = [
  { id: 1, name: 'Main Gate', x: 50, y: 250, facilities: ['Parking', 'ATM', 'Cafe'] },
  { id: 2, name: 'Academic Block A', x: 120, y: 180, facilities: ['Library', 'Labs', 'Canteen'] },
  { id: 3, name: 'Academic Block B', x: 200, y: 130, facilities: ['Auditorium', 'Computer Lab'] },
  { id: 4, name: 'Student Center', x: 280, y: 170, facilities: ['Food Court', 'Gym', 'Bookstore'] },
  { id: 5, name: 'Engineering Building', x: 350, y: 220, facilities: ['Workshop', 'Innovation Hub'] },
  { id: 6, name: 'Sports Complex', x: 320, y: 300, facilities: ['Swimming Pool', 'Courts', 'Track'] },
  { id: 7, name: 'Hostel Block', x: 180, y: 320, facilities: ['Laundry', 'Common Room'] },
  { id: 8, name: 'Medical Center', x: 100, y: 350, facilities: ['Pharmacy', 'First Aid'] },
  { id: 9, name: 'Research Park', x: 380, y: 120, facilities: ['Incubator', 'Meeting Rooms'] },
  { id: 10, name: 'Admin Block', x: 230, y: 250, facilities: ['Registrar', 'Finance', 'HR'] },
];

const SHUTTLES: Shuttle[] = [
  {
    id: 1, name: 'Blue Line', route: 'Main Gate → Academic → Student Center → Research Park',
    status: 'active', capacity: 40, riders: 28, nextStop: 'Academic Block A', eta: 3, speed: 25,
    driver: 'Rajesh K.', color: '#3b82f6',
    stops: [
      { name: 'Main Gate', time: '08:00', x: 50, y: 250, riders: 5 },
      { name: 'Academic Block A', time: '08:05', x: 120, y: 180, riders: 12 },
      { name: 'Academic Block B', time: '08:10', x: 200, y: 130, riders: 8 },
      { name: 'Student Center', time: '08:15', x: 280, y: 170, riders: 3 },
      { name: 'Research Park', time: '08:22', x: 380, y: 120, riders: 0 },
    ],
  },
  {
    id: 2, name: 'Green Line', route: 'Hostel → Sports → Engineering → Admin',
    status: 'active', capacity: 35, riders: 22, nextStop: 'Sports Complex', eta: 5, speed: 30,
    driver: 'Suresh M.', color: '#22c55e',
    stops: [
      { name: 'Hostel Block', time: '07:45', x: 180, y: 320, riders: 10 },
      { name: 'Sports Complex', time: '07:52', x: 320, y: 300, riders: 4 },
      { name: 'Engineering Building', time: '07:58', x: 350, y: 220, riders: 6 },
      { name: 'Admin Block', time: '08:05', x: 230, y: 250, riders: 2 },
    ],
  },
  {
    id: 3, name: 'Red Line', route: 'Medical → Main Gate → Academic → Student Center',
    status: 'delayed', capacity: 30, riders: 18, nextStop: 'Main Gate', eta: 8, speed: 15,
    driver: 'Vikram S.', color: '#ef4444',
    stops: [
      { name: 'Medical Center', time: '08:00', x: 100, y: 350, riders: 3 },
      { name: 'Main Gate', time: '08:08', x: 50, y: 250, riders: 8 },
      { name: 'Academic Block A', time: '08:15', x: 120, y: 180, riders: 5 },
      { name: 'Student Center', time: '08:22', x: 280, y: 170, riders: 2 },
    ],
  },
  {
    id: 4, name: 'Yellow Line', route: 'Research Park → Engineering → Sports → Hostel',
    status: 'active', capacity: 35, riders: 31, nextStop: 'Engineering Building', eta: 2, speed: 22,
    driver: 'Anita P.', color: '#f59e0b',
    stops: [
      { name: 'Research Park', time: '07:30', x: 380, y: 120, riders: 14 },
      { name: 'Engineering Building', time: '07:38', x: 350, y: 220, riders: 9 },
      { name: 'Sports Complex', time: '07:45', x: 320, y: 300, riders: 5 },
      { name: 'Hostel Block', time: '07:52', x: 180, y: 320, riders: 3 },
    ],
  },
  {
    id: 5, name: 'Express', route: 'Main Gate → Academic B → Research Park',
    status: 'offline', capacity: 45, riders: 0, nextStop: '—', eta: 0, speed: 0,
    driver: 'Off Duty', color: '#6b7280',
    stops: [
      { name: 'Main Gate', time: '09:00', x: 50, y: 250, riders: 0 },
      { name: 'Academic Block B', time: '09:10', x: 200, y: 130, riders: 0 },
      { name: 'Research Park', time: '09:20', x: 380, y: 120, riders: 0 },
    ],
  },
];

const SHUTTLE_SCHEDULE = [
  { time: '07:00', blue: true, green: true, red: false, yellow: true, express: false },
  { time: '07:30', blue: false, green: true, red: false, yellow: true, express: false },
  { time: '08:00', blue: true, green: true, red: true, yellow: false, express: true },
  { time: '08:30', blue: true, green: true, red: true, yellow: true, express: true },
  { time: '09:00', blue: true, green: true, red: true, yellow: true, express: true },
  { time: '09:30', blue: true, green: false, red: true, yellow: true, express: false },
  { time: '10:00', blue: true, green: true, red: true, yellow: true, express: true },
  { time: '12:00', blue: true, green: true, red: true, yellow: true, express: true },
  { time: '13:00', blue: true, green: true, red: true, yellow: true, express: false },
  { time: '14:00', blue: true, green: true, red: true, yellow: true, express: true },
  { time: '16:00', blue: true, green: true, red: true, yellow: true, express: true },
  { time: '17:00', blue: true, green: true, red: true, yellow: true, express: true },
  { time: '18:00', blue: true, green: false, red: true, yellow: true, express: false },
  { time: '19:00', blue: true, green: true, red: true, yellow: true, express: false },
  { time: '20:00', blue: true, green: true, red: false, yellow: true, express: false },
  { time: '21:00', blue: true, green: false, red: false, yellow: false, express: false },
];

const SHUTTLE_STATS = {
  totalRides: 1247,
  avgRidersPerDay: 89,
  onTimeRate: 92,
  avgWaitTime: 6,
  peakHour: '08:00 - 09:00',
  totalCapacity: 175,
  activeShuttles: 4,
};

/* ─────────────────────── SVG COMPONENTS ─────────────────────── */
function CampusMap({ shuttles, selectedShuttle }: { shuttles: Shuttle[]; selectedShuttle: number | null }) {
  const width = 420;
  const height = 380;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-2xl bg-gray-900 border border-gray-200 dark:border-gray-800" style={{ height: '300px' }}>
      {/* Background grid */}
      {Array.from({ length: 20 }, (_, i) => (
        <React.Fragment key={i}>
          <line x1={i * 20} y1={0} x2={i * 20} y2={height} stroke="#1f2937" strokeWidth="0.5" />
          <line x1={0} y1={i * 20} x2={width} y2={i * 20} stroke="#1f2937" strokeWidth="0.5" />
        </React.Fragment>
      ))}

      {/* Routes */}
      {shuttles.filter(s => s.status !== 'offline').map(s => (
        <polyline key={s.id} points={s.stops.map(st => `${st.x},${st.y}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray="8,4" opacity={selectedShuttle && selectedShuttle !== s.id ? 0.2 : 0.6} />
      ))}

      {/* Stops */}
      {STOPS.map(stop => (
        <g key={stop.id}>
          <circle cx={stop.x} cy={stop.y} r="8" fill="#374151" stroke="#6b7280" strokeWidth="1.5" />
          <circle cx={stop.x} cy={stop.y} r="3" fill="#a855f7" />
          <text x={stop.x} y={stop.y - 12} textAnchor="middle" fill="#d1d5db" fontSize="7" fontWeight="bold">{stop.name}</text>
        </g>
      ))}

      {/* Shuttles */}
      {shuttles.filter(s => s.status !== 'offline').map(s => {
        const currentStop = s.stops[Math.min(Math.floor(s.stops.length * 0.4), s.stops.length - 1)];
        const nextIdx = Math.min(Math.floor(s.stops.length * 0.4) + 1, s.stops.length - 1);
        const nextStop = s.stops[nextIdx];
        const progress = 0.4;
        const x = currentStop.x + (nextStop.x - currentStop.x) * progress;
        const y = currentStop.y + (nextStop.y - currentStop.y) * progress;
        const isSelected = selectedShuttle === s.id;
        return (
          <g key={s.id} opacity={selectedShuttle && !isSelected ? 0.3 : 1}>
            <circle cx={x} cy={y} r={isSelected ? 10 : 7} fill={s.color} stroke="white" strokeWidth="2" />
            <text x={x} y={y + 3} textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">{s.id}</text>
          </g>
        );
      })}
    </svg>
  );
}

function OccupancyBar({ riders, capacity, color }: { riders: number; capacity: number; color: string }) {
  const pct = (riders / capacity) * 100;
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : color;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-gray-500">{riders}/{capacity} riders</span>
        <span className="font-bold" style={{ color: barColor }}>{Math.round(pct)}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    active: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: '🟢', label: 'Active' },
    delayed: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: '🟡', label: 'Delayed' },
    offline: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: '⚫', label: 'Offline' },
  };
  const c = config[status as keyof typeof config] || config.offline;
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.bg} ${c.text}`}>{c.icon} {c.label}</span>;
}

/* ─────────────────────── MAIN COMPONENT ─────────────────────── */
export default function CampusShuttleTracker() {
  const [activeTab, setActiveTab] = useState('live');
  const [selectedShuttle, setSelectedShuttle] = useState<number | null>(null);
  const [selectedStop, setSelectedStop] = useState<number | null>(null);

  const selectedShuttleData = selectedShuttle ? SHUTTLES.find(s => s.id === selectedShuttle) : null;
  const selectedStopData = selectedStop ? STOPS.find(s => s.id === selectedStop) : null;

  const nextShuttlesForStop = useMemo(() => {
    if (!selectedStopData) return [];
    return SHUTTLES.filter(s => s.status !== 'offline' && s.stops.some(st => st.name === selectedStopData.name))
      .map(s => ({ shuttle: s, eta: Math.floor(Math.random() * 10) + 2 }))
      .sort((a, b) => a.eta - b.eta);
  }, [selectedStopData]);

  const tabs = [
    { id: 'live', label: '🗺️ Live Map' },
    { id: 'shuttles', label: '🚌 Shuttles' },
    { id: 'schedule', label: '📅 Schedule' },
    { id: 'stats', label: '📊 Stats' },
  ];

  return (
    <>
      <Helmet><title>Campus Shuttle Tracker — CampusConnect</title></Helmet>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4 md:p-8 space-y-6 max-w-6xl mx-auto">

        <div>
          <span className="text-xs font-mono font-bold uppercase text-purple-400">.campus transit</span>
          <h1 className="text-2xl md:text-3xl font-black mt-1">🚌 Campus Shuttle Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track {SHUTTLE_STATS.activeShuttles} active shuttles across {STOPS.length} stops with real-time ETA</p>
        </div>

        {/* QUICK STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
            <div className="text-2xl font-black text-emerald-500">{SHUTTLE_STATS.activeShuttles}</div>
            <div className="text-xs text-gray-500">Active Shuttles</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
            <div className="text-2xl font-black text-purple-500">{SHUTTLE_STATS.avgWaitTime} min</div>
            <div className="text-xs text-gray-500">Avg Wait Time</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
            <div className="text-2xl font-black text-blue-500">{SHUTTLE_STATS.onTimeRate}%</div>
            <div className="text-xs text-gray-500">On-Time Rate</div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
            <div className="text-2xl font-black text-amber-500">{SHUTTLE_STATS.avgRidersPerDay}</div>
            <div className="text-xs text-gray-500">Avg Riders/Day</div>
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

        {/* ═══════════ LIVE MAP TAB ═══════════ */}
        {activeTab === 'live' && (
          <div className="space-y-4">
            <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-bold mb-3">🗺️ Campus Map — Live Shuttle Positions</h3>
              <CampusMap shuttles={SHUTTLES} selectedShuttle={selectedShuttle} />
              <div className="flex flex-wrap gap-2 mt-3">
                {SHUTTLES.map(s => (
                  <button key={s.id} onClick={() => setSelectedShuttle(selectedShuttle === s.id ? null : s.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 border ${selectedShuttle === s.id ? 'border-purple-500 bg-purple-500/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                    <StatusBadge status={s.status} />
                  </button>
                ))}
              </div>
            </div>

            {/* SHUTTLE DETAIL */}
            {selectedShuttleData && (
              <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedShuttleData.color }} />
                    <h3 className="text-sm font-bold">{selectedShuttleData.name}</h3>
                    <StatusBadge status={selectedShuttleData.status} />
                  </div>
                  <span className="text-xs text-gray-500">{selectedShuttleData.driver}</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">{selectedShuttleData.route}</p>
                <OccupancyBar riders={selectedShuttleData.riders} capacity={selectedShuttleData.capacity} color={selectedShuttleData.color} />
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="text-center p-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                    <div className="text-lg font-bold text-purple-400">{selectedShuttleData.eta} min</div>
                    <div className="text-[10px] text-gray-500">ETA to {selectedShuttleData.nextStop}</div>
                  </div>
                  <div className="text-center p-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                    <div className="text-lg font-bold text-blue-400">{selectedShuttleData.speed} km/h</div>
                    <div className="text-[10px] text-gray-500">Current Speed</div>
                  </div>
                  <div className="text-center p-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                    <div className="text-lg font-bold text-emerald-400">{selectedShuttleData.stops.length}</div>
                    <div className="text-[10px] text-gray-500">Stops on Route</div>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {selectedShuttleData.stops.map((stop, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedShuttleData.color }} />
                      <span className="flex-1 font-bold">{stop.name}</span>
                      <span className="text-gray-500">{stop.time}</span>
                      {stop.riders > 0 && <span className="text-[10px] text-gray-400">👥 {stop.riders}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STOP SELECTOR */}
            <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-bold mb-3">🚏 Next Shuttles by Stop</h3>
              <select value={selectedStop || ''} onChange={e => setSelectedStop(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm mb-3">
                <option value="">Select a stop...</option>
                {STOPS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {nextShuttlesForStop.length > 0 && (
                <div className="space-y-2">
                  {nextShuttlesForStop.map((ns, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ns.shuttle.color }} />
                      <span className="text-xs font-bold flex-1">{ns.shuttle.name}</span>
                      <span className="text-xs text-gray-500">{ns.shuttle.riders}/{ns.shuttle.capacity}</span>
                      <span className="text-sm font-bold text-purple-400">{ns.eta} min</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════ SHUTTLES TAB ═══════════ */}
        {activeTab === 'shuttles' && (
          <div className="space-y-3">
            {SHUTTLES.map(s => (
              <div key={s.id} className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color }} />
                    <div>
                      <h3 className="text-sm font-bold">{s.name}</h3>
                      <div className="text-[10px] text-gray-500">{s.route}</div>
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <OccupancyBar riders={s.riders} capacity={s.capacity} color={s.color} />
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="p-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                    <div className="text-xs font-bold text-purple-400">{s.eta > 0 ? `${s.eta} min` : '—'}</div>
                    <div className="text-[10px] text-gray-500">ETA</div>
                  </div>
                  <div className="p-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                    <div className="text-xs font-bold text-blue-400">{s.speed > 0 ? `${s.speed} km/h` : '—'}</div>
                    <div className="text-[10px] text-gray-500">Speed</div>
                  </div>
                  <div className="p-2 bg-gray-200 dark:bg-gray-800 rounded-lg">
                    <div className="text-xs font-bold text-emerald-400">{s.driver}</div>
                    <div className="text-[10px] text-gray-500">Driver</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.stops.map((stop, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-800 rounded text-[10px] text-gray-400">
                      {stop.name} ({stop.time})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════ SCHEDULE TAB ═══════════ */}
        {activeTab === 'schedule' && (
          <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-bold mb-3">📅 Shuttle Schedule</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left p-2 text-gray-500">Time</th>
                    <th className="text-center p-2"><span className="text-blue-400">● Blue</span></th>
                    <th className="text-center p-2"><span className="text-emerald-400">● Green</span></th>
                    <th className="text-center p-2"><span className="text-red-400">● Red</span></th>
                    <th className="text-center p-2"><span className="text-amber-400">● Yellow</span></th>
                    <th className="text-center p-2"><span className="text-gray-400">● Express</span></th>
                  </tr>
                </thead>
                <tbody>
                  {SHUTTLE_SCHEDULE.map((row, i) => (
                    <tr key={i} className="border-b border-gray-200 dark:border-gray-800">
                      <td className="p-2 font-bold">{row.time}</td>
                      <td className="text-center p-2">{row.blue ? '🟢' : '—'}</td>
                      <td className="text-center p-2">{row.green ? '🟢' : '—'}</td>
                      <td className="text-center p-2">{row.red ? '🟢' : '—'}</td>
                      <td className="text-center p-2">{row.yellow ? '🟢' : '—'}</td>
                      <td className="text-center p-2">{row.express ? '🟢' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════ STATS TAB ═══════════ */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
                <div className="text-2xl font-black text-purple-500">{SHUTTLE_STATS.totalRides.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Total Rides (Month)</div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
                <div className="text-2xl font-black text-emerald-500">{SHUTTLE_STATS.onTimeRate}%</div>
                <div className="text-xs text-gray-500">On-Time Performance</div>
              </div>
              <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 text-center">
                <div className="text-2xl font-black text-blue-500">{SHUTTLE_STATS.totalCapacity}</div>
                <div className="text-xs text-gray-500">Total Capacity</div>
              </div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-bold mb-3">📊 Route Performance</h3>
              <div className="space-y-3">
                {SHUTTLES.filter(s => s.status !== 'offline').map(s => {
                  const occupancy = Math.round((s.riders / s.capacity) * 100);
                  return (
                    <div key={s.id}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-xs font-bold flex-1">{s.name}</span>
                        <span className="text-[10px] text-gray-500">{s.riders}/{s.capacity}</span>
                        <span className="text-xs font-bold" style={{ color: occupancy >= 90 ? '#ef4444' : occupancy >= 70 ? '#f59e0b' : '#22c55e' }}>{occupancy}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${occupancy}%`, backgroundColor: s.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-bold mb-3">💡 Insights</h3>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                  <span className="font-bold text-purple-400">🕐 Peak Hour:</span> <span className="text-gray-300">{SHUTTLE_STATS.peakHour} — 78% average occupancy across all routes</span>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <span className="font-bold text-emerald-400">📈 Growth:</span> <span className="text-gray-300">Ridership increased 15% from last month. Yellow Line is the most used route.</span>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <span className="font-bold text-amber-400">⚠️ Alert:</span> <span className="text-gray-300">Red Line experiencing 8-min delays due to road construction near Medical Center.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
