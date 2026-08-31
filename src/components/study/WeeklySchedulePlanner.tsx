import { useState } from "react";
import {
  CalendarDays,
  Plus,
  Trash2,
  X,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  BarChart3,
  Sparkles,
} from "lucide-react";
import {
  useWeeklySchedule,
  type DayOfWeek,
  type ScheduleEntry,
  minutesToTimeStr,
} from "../../hooks/useWeeklySchedule";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7..22

function formatDuration(startH: number, startM: number, endH: number, endM: number): string {
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  const diff = end - start;
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface AddEntryModalProps {
  days: DayOfWeek[];
  colors: string[];
  types: Record<ScheduleEntry["type"], { label: string; icon: string }>;
  onAdd: (data: Omit<ScheduleEntry, "id">) => void;
  onClose: () => void;
}

function AddEntryModal({ days, colors, types, onAdd, onClose }: AddEntryModalProps) {
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [instructor, setInstructor] = useState("");
  const [location, setLocation] = useState("");
  const [day, setDay] = useState<DayOfWeek>("Mon");
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [type, setType] = useState<ScheduleEntry["type"]>("lecture");
  const [color, setColor] = useState(colors[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) return;
    onAdd({
      courseName: courseName.trim(),
      courseCode: courseCode.trim() || courseName.trim().slice(0, 6).toUpperCase(),
      instructor: instructor.trim(),
      location: location.trim(),
      day,
      startHour,
      startMinute,
      endHour,
      endMinute,
      color,
      type,
    });
    onClose();
  };

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = [0, 15, 30, 45];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-bold text-slate-100">Add Class</h4>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Course Name</label>
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g. Data Structures"
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Course Code</label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="CS201"
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ScheduleEntry["type"])}
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {Object.entries(types).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.icon} {val.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Instructor</label>
              <input
                type="text"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="Prof. Smith"
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Room 301"
                className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Day</label>
            <div className="grid grid-cols-7 gap-1">
              {days.slice(0, 5).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={`text-[10px] font-mono rounded-lg py-1.5 border transition-all ${
                    day === d
                      ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                      : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Start Time</label>
              <div className="flex gap-1">
                <select
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-2 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
                <select
                  value={startMinute}
                  onChange={(e) => setStartMinute(Number(e.target.value))}
                  className="w-20 bg-slate-800 border border-slate-600 rounded-xl px-2 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {minuteOptions.map((m) => (
                    <option key={m} value={m}>:{String(m).padStart(2, "0")}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">End Time</label>
              <div className="flex gap-1">
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-2 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {hourOptions.map((h) => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
                <select
                  value={endMinute}
                  onChange={(e) => setEndMinute(Number(e.target.value))}
                  className="w-20 bg-slate-800 border border-slate-600 rounded-xl px-2 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {minuteOptions.map((m) => (
                    <option key={m} value={m}>:{String(m).padStart(2, "0")}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Color</label>
            <div className="flex gap-1.5">
              {colors.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg ${c} transition-all ${
                    color === c ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110" : "opacity-60 hover:opacity-100"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose} className="flex-1 text-xs text-slate-500 hover:text-slate-300 py-2.5 rounded-xl border border-slate-700 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={!courseName.trim()} className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-xs rounded-xl py-2.5 transition-colors">
            Add Class
          </button>
        </div>
      </form>
    </div>
  );
}

export default function WeeklySchedulePlanner() {
  const { entries, stats, addEntry, removeEntry, clearAllData, getEntriesForDay, nextColor, allDays, slotColors, entryTypes, minutesToTime } = useWeeklySchedule();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | "all">("all");
  const [hoveredEntry, setHoveredEntry] = useState<ScheduleEntry | null>(null);

  const displayDays = selectedDay === "all" ? allDays.slice(0, 5) : [selectedDay];

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6 shadow-xl max-w-3xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/15 border border-violet-500/20">
            <CalendarDays size={18} className="text-violet-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Weekly Schedule</h3>
            <p className="text-[10px] text-slate-500 font-mono">
              {stats.coursesCount} courses · {stats.totalHoursPerWeek.toFixed(1)}h/week
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-xs font-bold rounded-xl px-3 py-2 transition-all"
          >
            <Plus size={14} />
            Add
          </button>
          <button onClick={clearAllData} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors" aria-label="Clear all">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2.5 py-1">
          <Sparkles size={10} className="text-violet-400" />
          <span className="text-[10px] font-mono text-violet-300">{stats.coursesCount} courses</span>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1">
          <Clock size={10} className="text-blue-400" />
          <span className="text-[10px] font-mono text-blue-300">{stats.totalHoursPerWeek.toFixed(1)}h/week</span>
        </div>
        {stats.freeDays.length > 0 && (
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
            <CalendarDays size={10} className="text-emerald-400" />
            <span className="text-[10px] font-mono text-emerald-300">Free: {stats.freeDays.join(", ")}</span>
          </div>
        )}
        {stats.conflicts.length > 0 && (
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1">
            <AlertTriangle size={10} className="text-red-400" />
            <span className="text-[10px] font-mono text-red-300">{stats.conflicts.length} conflict{stats.conflicts.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Conflict Warnings */}
      {stats.conflicts.length > 0 && (
        <div className="mb-4 bg-red-500/5 border border-red-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-[10px] font-bold text-red-300 uppercase">Time Conflicts</span>
          </div>
          {stats.conflicts.map((c, i) => (
            <div key={i} className="text-[10px] text-red-300/80 mb-1">
              <span className="font-bold">{c.entryA.courseName}</span> overlaps with <span className="font-bold">{c.entryB.courseName}</span> on <span className="font-mono">{c.entryA.day}</span> ({c.overlapMinutes}min overlap)
            </div>
          ))}
        </div>
      )}

      {/* Day Filter */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setSelectedDay("all")}
          className={`text-[10px] font-mono rounded-lg px-2.5 py-1 border transition-all ${
            selectedDay === "all"
              ? "bg-slate-700 border-slate-600 text-slate-200"
              : "bg-slate-800/50 border-slate-700/40 text-slate-500 hover:text-slate-300"
          }`}
        >
          All Week
        </button>
        {allDays.slice(0, 5).map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDay(d)}
            className={`text-[10px] font-mono rounded-lg px-2.5 py-1 border transition-all ${
              selectedDay === d
                ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                : "bg-slate-800/50 border-slate-700/40 text-slate-500 hover:text-slate-300"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Schedule Grid */}
      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Day Headers */}
            <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `60px repeat(${displayDays.length}, 1fr)` }}>
              <div />
              {displayDays.map((d) => (
                <div key={d} className="text-center text-[10px] font-mono text-slate-400 uppercase py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Time Slots */}
            <div className="space-y-px">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="grid gap-1 items-start"
                  style={{ gridTemplateColumns: `60px repeat(${displayDays.length}, 1fr)` }}
                >
                  <div className="text-[9px] font-mono text-slate-600 pt-0.5 text-right pr-2">
                    {minutesToTimeStr(hour * 60)}
                  </div>
                  {displayDays.map((d) => {
                    const dayEntries = getEntriesForDay(d);
                    const entryAtHour = dayEntries.find(
                      (e) => e.startHour === hour && e.startMinute === 0,
                    );
                    const entrySpan = entryAtHour
                      ? Math.ceil(durationMinutes(entryAtHour) / 60)
                      : 0;

                    if (entryAtHour && entryAtHour.startHour === hour) {
                      return (
                        <div
                          key={d}
                          className={`${entryAtHour.color} rounded-lg p-2 cursor-pointer hover:brightness-110 transition-all relative group`}
                          style={{ gridRow: `span ${entrySpan}` }}
                          onMouseEnter={() => setHoveredEntry(entryAtHour)}
                          onMouseLeave={() => setHoveredEntry(null)}
                        >
                          <div className="text-[10px] font-bold text-white leading-tight">
                            {entryAtHour.courseName}
                          </div>
                          <div className="text-[8px] text-white/70 font-mono mt-0.5">
                            {minutesToTimeStr(entryAtHour.startHour * 60 + entryAtHour.startMinute)} - {minutesToTimeStr(entryAtHour.endHour * 60 + entryAtHour.endMinute)}
                          </div>
                          {entryAtHour.location && (
                            <div className="text-[8px] text-white/60 mt-0.5">
                              📍 {entryAtHour.location}
                            </div>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeEntry(entryAtHour.id); }}
                            className="absolute top-1 right-1 p-0.5 rounded bg-black/30 text-white/50 hover:text-white hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-all"
                            aria-label="Remove class"
                          >
                            <X size={8} />
                          </button>
                        </div>
                      );
                    }

                    // Check if this slot is inside a span of an earlier entry
                    const isInsideSpan = dayEntries.some((e) => {
                      const eStart = e.startHour;
                      const eEnd = e.startHour + Math.ceil(durationMinutes(e) / 60);
                      return hour >= eStart && hour < eEnd && hour !== eStart;
                    });

                    if (isInsideSpan) return <div key={d} />;

                    return (
                      <div key={d} className="h-6 bg-slate-800/20 rounded" />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10">
          <CalendarDays size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-xs text-slate-500 mb-1">No classes scheduled</p>
          <p className="text-[10px] text-slate-600">Click "Add" to build your weekly schedule</p>
        </div>
      )}

      {/* Tooltip */}
      {hoveredEntry && (
        <div className="mt-3 bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs">
          <div className="font-bold text-slate-200 mb-1">{hoveredEntry.courseCode} — {hoveredEntry.courseName}</div>
          <div className="flex items-center gap-3 text-slate-400">
            {hoveredEntry.instructor && (
              <span className="flex items-center gap-1"><User size={10} /> {hoveredEntry.instructor}</span>
            )}
            {hoveredEntry.location && (
              <span className="flex items-center gap-1"><MapPin size={10} /> {hoveredEntry.location}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={10} /> {formatDuration(hoveredEntry.startHour, hoveredEntry.startMinute, hoveredEntry.endHour, hoveredEntry.endMinute)}
            </span>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddEntryModal
          days={allDays}
          colors={slotColors}
          types={entryTypes}
          onAdd={(data) => {
            const nextC = nextColor();
            addEntry({ ...data, color: data.color || nextC });
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
